/**
 * POST /api/publish — Proxy server-side vers le backend principal.
 *
 * Sécurité :
 *  - Valide la session NextAuth (le navigateur ne peut pas falsifier userId)
 *  - Appel server-to-server avec OAUTH_TOKEN_SECRET (jamais exposé au client)
 *  - Le backend principal re-vérifie l'abonnement actif côté DB
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerTranslator } from "@/i18n/server";
import { apiErrorResponse } from "@/lib/api-error";

const LAURENA_API_URL =
  process.env.LAURENA_API_URL ?? "http://localhost:8000";

const SERVICE_SECRET =
  process.env.OAUTH_TOKEN_SECRET ??
  process.env.LAURENA_OAUTH_TOKEN_SECRET ??
  "";

export async function POST(request: Request) {
  const { t } = getServerTranslator(request);

  // ── 1. Vérifier la session NextAuth ──────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return apiErrorResponse(t, 401, "api.auth.unauthorized", {
      code: "AUTH_REQUIRED",
    });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return apiErrorResponse(t, 401, "api.auth.noUserId", {
      code: "AUTH_INVALID_SESSION",
    });
  }

  // ── 2. Parser le body ─────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorResponse(t, 400, "api.request.invalidJson", {
      code: "REQUEST_INVALID_JSON",
    });
  }

  const { files, slug, projectId } = body as {
    files: { path: string; content: string }[];
    slug?: string;
    projectId?: string;
  };

  if (!files?.length) {
    return apiErrorResponse(t, 400, "api.request.noFile", {
      code: "REQUEST_NO_FILES",
    });
  }

  // ── 3. Appel service-to-service vers laurenastudio ────────────────────────
  try {
    const res = await fetch(`${LAURENA_API_URL}/api/v1/builder/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_SECRET}`,
      },
      body: JSON.stringify({
        userId,
        files,
        ...(slug ? { slug } : {}),
        ...(projectId ? { projectId } : {}),
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[api/publish] Backend unreachable:", err);
    return apiErrorResponse(t, 502, "api.publish.backendUnavailableTryAgain", {
      code: "PUBLISH_BACKEND_UNAVAILABLE",
    });
  }
}
