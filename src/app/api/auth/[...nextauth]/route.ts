/**
 * NextAuth v4 — Laurena credentials provider
 *
 * This is the ONLY auth method for the builder subdomain.
 * It never handles passwords or Google/Facebook directly — that is the
 * responsibility of the main domain (laurenastudio.pro / FastAPI).
 *
 * Flow:
 *   /auth/callback page calls signIn("laurena", { code })
 *   → authorize() exchanges the one-time code with FastAPI /oauth/token
 *   → returns user object → NextAuth creates a JWT session cookie
 */

import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Supports both env var names (LAURENA_API_URL is the canonical new name,
// but http://localhost:8000 is the safe default for local dev).
const LAURENA_API_URL =
  process.env.LAURENA_API_URL ?? "http://localhost:8000";

// Accept either name to be compatible with .env files that use OAUTH_TOKEN_SECRET
const LAURENA_OAUTH_TOKEN_SECRET =
  process.env.LAURENA_OAUTH_TOKEN_SECRET ??
  process.env.OAUTH_TOKEN_SECRET ??
  "";

// Re-verify subscription every 5 minutes (avoids stale planActive in JWT)
const PLAN_CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function refreshPlanActive(userId: string): Promise<{ planActive: boolean; planName: string; subscriptionId: string } | null> {
  try {
    const res = await fetch(
      `${LAURENA_API_URL}/api/v1/builder/subscription/${encodeURIComponent(userId)}`,
      {
        headers: { Authorization: `Bearer ${LAURENA_OAUTH_TOKEN_SECRET}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { plan_active: boolean; plan_name: string; subscription_id: string };
    return { planActive: data.plan_active, planName: data.plan_name, subscriptionId: data.subscription_id };
  } catch {
    return null; // réseau down → conserver la valeur actuelle
  }
}

export const authOptions: NextAuthOptions = {
  // JWT strategy — no database session table needed in MongoDB
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      id: "laurena",
      name: "Laurena",
      // credentials shape (used by NextAuth internals; actual call is from /auth/callback)
      credentials: {
        code: { label: "Authorization Code", type: "text" },
      },

      async authorize(credentials) {
        if (!credentials?.code) return null;

        try {
          const res = await fetch(
            `${LAURENA_API_URL}/api/v1/oauth/token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LAURENA_OAUTH_TOKEN_SECRET}`,
              },
              body: JSON.stringify({ code: credentials.code }),
            }
          );

          if (!res.ok) {
            // SECURITY: ne pas logger le body de la réponse (peut contenir des tokens)
            console.error("[NextAuth] oauth/token returned status:", res.status);
            return null;
          }

          const data = (await res.json()) as {
            user_id: string;
            email: string;
            name: string;
            avatar: string;
            subscription_id: string;
            plan_name: string;
            plan_active: boolean;
          };

          return {
            id: data.user_id,
            name: data.name,
            email: data.email,
            image: data.avatar || null,
            // subscription context — stored in JWT, never shared with browser as raw token
            subscriptionId: data.subscription_id,
            planName: data.plan_name,
            planActive: data.plan_active,
          };
        } catch (err) {
          console.error("[NextAuth] authorize error:", err);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: bake subscription context into JWT
        token.laurenaUserId      = user.id;
        token.name               = user.name;
        token.email              = user.email;
        token.picture            = user.image;
        token.subscriptionId     = (user as any).subscriptionId ?? "";
        token.planName           = (user as any).planName ?? "";
        token.planActive         = (user as any).planActive ?? false;
        token.planCheckedAt      = Date.now();
      } else {
        // Subsequent calls: re-verify planActive every 5 minutes
        const checkedAt = (token.planCheckedAt as number | undefined) ?? 0;
        if (Date.now() - checkedAt > PLAN_CHECK_INTERVAL_MS) {
          const userId = token.laurenaUserId as string | undefined;
          if (userId) {
            const fresh = await refreshPlanActive(userId);
            if (fresh !== null) {
              token.planActive     = fresh.planActive;
              token.planName       = fresh.planName;
              token.subscriptionId = fresh.subscriptionId;
            }
            // fresh === null means backend unreachable → keep existing value
          }
          token.planCheckedAt = Date.now();
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const u = session.user as typeof session.user & {
          id: string;
          subscriptionId: string;
          planName: string;
          planActive: boolean;
        };
        u.id             = token.laurenaUserId as string;
        u.subscriptionId = token.subscriptionId as string;
        u.planName       = token.planName as string;
        u.planActive     = token.planActive as boolean;
      }
      return session;
    },
  },

  pages: {
    // Use our custom callback page; no built-in sign-in page needed
    signIn: "/auth/callback",
    error: "/auth/error",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
