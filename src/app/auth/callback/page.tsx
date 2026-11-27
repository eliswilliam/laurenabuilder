"use client";

/**
 * /auth/callback — OAuth2 callback page (client-side)
 *
 * FastAPI redirects here after validating the user's JWT:
 *   GET /auth/callback?code=<one-time-code>&state=<state>
 *
 * Steps:
 *   1. Validate state against sessionStorage (CSRF protection)
 *   2. Call signIn("laurena", { code }) → NextAuth exchanges code with FastAPI
 *   3. On success → redirect to "/"
 *   4. On failure → redirect to /auth/error
 */

import { useEffect, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/i18n/provider";

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");

    // No code → not coming from FastAPI → redirect to login entry point
    if (!code) {
      router.replace("/auth/login");
      return;
    }

    // SECURITY: Validation du state CSRF — strictement requise
    // Si le state est absent (URL ou sessionStorage), on rejette la requête.
    const savedState = sessionStorage.getItem("oauth_state");
    sessionStorage.removeItem("oauth_state");

    if (!state || !savedState || state !== savedState) {
      setErrorMsg(t("auth.callback.csrfFailed"));
      setStatus("error");
      return;
    }

    // Read where to redirect after login (set by /auth/login or the middleware)
    const returnTo = sessionStorage.getItem("oauth_return_to") ?? "/";
    sessionStorage.removeItem("oauth_return_to");

    signIn("laurena", { code, redirect: false })
      .then(async (result) => {
        if (result?.error) {
          setErrorMsg(result.error);
          setStatus("error");
        } else {
          // Check subscription status before redirecting — users without an active
          // plan are sent to /escolher-plano on the main domain immediately at login,
          // before they ever see /chat. The middleware is a second layer of protection.
          const session = await getSession();
          const planActive = (session?.user as { planActive?: boolean } | null)?.planActive;
          if (!planActive) {
            const mainDomain =
              process.env.NEXT_PUBLIC_MAIN_DOMAIN_URL ?? "https://laurenastudio.pro";
            window.location.href = `${mainDomain}/escolher-plano`;
            return;
          }
          router.replace(returnTo);
        }
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : t("auth.callback.unknownError"));
        setStatus("error");
      });
  }, [params, router, t]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-xl font-semibold text-destructive">
          {t("auth.callback.connectFailedTitle")}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">{errorMsg}</p>
        <a
          href={`${process.env.NEXT_PUBLIC_MAIN_DOMAIN_URL ?? "https://laurenastudio.pro"}/criar-site`}
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("auth.callback.backToMain")}
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{t("auth.callback.connecting")}</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
