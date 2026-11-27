"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/i18n/provider";

const MAIN_DOMAIN =
  process.env.NEXT_PUBLIC_MAIN_DOMAIN_URL ?? "http://localhost:8080";

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  OAuthSignin: "auth.error.oauthSignin",
  OAuthCallback: "auth.error.oauthCallback",
  OAuthCreateAccount: "auth.error.oauthCreateAccount",
  Callback: "auth.error.callback",
  AccessDenied: "auth.error.accessDenied",
  Verification: "auth.error.verification",
  Default: "auth.error.default",
};

function ErrorInner() {
  const params = useSearchParams();
  const { t } = useI18n();
  const errorCode = params.get("error") ?? "Default";
  const message = t(ERROR_MESSAGE_KEYS[errorCode] ?? ERROR_MESSAGE_KEYS.Default);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-xl font-semibold text-destructive">
        {t("auth.error.title")}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <a
        href={`${MAIN_DOMAIN}/criar-site`}
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t("auth.error.backToMain")}
      </a>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorInner />
    </Suspense>
  );
}
