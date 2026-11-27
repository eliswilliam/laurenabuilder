/**
 * Next.js Edge Middleware — Global Route Protection
 *
 * Every route on this subdomain is private by default.
 * Only /auth/* routes (callback, login, error) are public.
 *
 * Unauthenticated requests → /auth/login?return_to=<original path>
 * /auth/login triggers the OAuth2 flow with the main domain (FastAPI).
 */

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that do NOT require authentication
const PUBLIC_PREFIXES = [
  "/auth/",      // /auth/login, /auth/callback, /auth/error
  "/api/auth/",  // NextAuth endpoints (/api/auth/session, /api/auth/callback/laurena …)
  "/api/",       // All other API routes (generate-code, stripe webhooks, etc.)
  "/_next/",     // Next.js internals (redundant with matcher but safe to include)
];

// Exact public paths (landing page is public so unauthenticated users can see it)
const PUBLIC_EXACT = ["/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes
  const isPublic =
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublic) return NextResponse.next();

  // Verify the NextAuth JWT (set after /auth/callback succeeds)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("return_to", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated but no active subscription → send to escolher-plano on main domain
  if (!token.planActive) {
    const mainDomain =
      process.env.NEXT_PUBLIC_MAIN_DOMAIN_URL ?? "https://laurenastudio.pro";
    return NextResponse.redirect(`${mainDomain}/escolher-plano`);
  }

  return NextResponse.next();
}

// Run on every route EXCEPT Next.js internals and static files
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|ingest/).*)",
  ],
};
