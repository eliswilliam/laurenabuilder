"use client";

/**
 * /auth/login — OAuth2 entry point for the builder
 *
 * Reached when:
 *  a) The middleware detects an unauthenticated request to a protected route
 *  b) The user manually navigates here
 *
 * Steps:
 *  1. Read optional `return_to` param (original destination after login)
 *  2. Generate a random state, store in sessionStorage (CSRF protection)
 *  3. Store `return_to` in sessionStorage so the callback can redirect there
 *  4. Redirect browser to FastAPI /oauth/authorize on the main domain
 *     → FastAPI validates the JWT cookie → emits a one-time code
 *     → redirects back to /auth/callback?code=...&state=...
 */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/i18n/provider";

// Main domain URL (Vite frontend — proxies /api to FastAPI)
const MAIN_DOMAIN_URL =
  process.env.NEXT_PUBLIC_MAIN_DOMAIN_URL ?? "http://localhost:8080";

function LoginInner() {
  const params = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    const returnTo = params.get("return_to") ?? "/";

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_return_to", returnTo);

    // redirect_uri must be whitelisted in FastAPI OAUTH_ALLOWED_REDIRECT_URIS
    const redirectUri = `${window.location.origin}/auth/callback`;

    const authorizeUrl = new URL(`${MAIN_DOMAIN_URL}/api/v1/oauth/authorize`);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);

    window.location.href = authorizeUrl.toString();
  }, [params]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">
        {t("auth.login.redirecting")}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
