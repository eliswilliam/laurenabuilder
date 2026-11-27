/**
 * GET /api/publish/jobs/[jobId] — Poll le statut d'un job de publication.
 * Proxy server-side vers /api/v1/builder/publish/jobs/{jobId}.
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { t } = getServerTranslator(request);

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return apiErrorResponse(t, 401, "api.auth.unauthorized", {
      code: "AUTH_REQUIRED",
    });
  }

  const { jobId } = await params;

  // SECURITY: validation basique du format jobId (UUID v4)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return apiErrorResponse(t, 400, "api.publish.invalidJobId", {
      code: "PUBLISH_INVALID_JOB_ID",
    });
  }

  // SECURITY: passer l'userId au backend pour validation d'ownership (anti-IDOR)
  const userId = (session.user as { id?: string }).id ?? "";

  try {
    const res = await fetch(
      `${LAURENA_API_URL}/api/v1/builder/publish/jobs/${jobId}`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_SECRET}`,
          "X-Laurena-User-Id": userId,
        },
        cache: "no-store",
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[api/publish/jobs] Backend unreachable:", err instanceof Error ? err.message : "unknown");
    return apiErrorResponse(t, 502, "api.publish.backendUnavailable", {
      code: "PUBLISH_BACKEND_UNAVAILABLE",
    });
  }
}
