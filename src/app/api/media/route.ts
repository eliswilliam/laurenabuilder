/**
 * GET /api/media?path=up/{userId}/{uuid}.{ext}
 *
 * Public proxy for user-uploaded images stored in GCS.
 * Generates a fresh short-lived signed URL server-side and redirects to it.
 *
 * This endpoint is intentionally unauthenticated — images are used in
 * generated sites visited by end users who have no session.
 *
 * Security:
 * - Path must start with "up/" (the upload prefix)
 * - No path traversal ("..") allowed
 * - Only image extensions allowed
 */

import { NextRequest, NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"

const BUCKET_NAME = (process.env.GCS_BUCKET ?? "builder_laurena").trim() || "builder_laurena"

// Only allow paths that look like: up/<userId>/<uuid>.<ext>
const SAFE_PATH_RE = /^up\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|gif)$/i

function buildStorage(): Storage {
  const raw = (process.env.GOOGLE_CREDENTIALS_JSON ?? process.env.GCP_SA_KEY ?? "").trim()
  if (!raw) return new Storage()

  try {
    let jsonStr = raw
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf-8")
      JSON.parse(decoded)
      jsonStr = decoded
    } catch { /* not base64 */ }

    const credentials = JSON.parse(jsonStr) as Record<string, unknown>
    const projectId = typeof credentials.project_id === "string"
      ? credentials.project_id
      : (process.env.GOOGLE_CLOUD_PROJECT ?? "").trim() || undefined

    return new Storage({ credentials, ...(projectId ? { projectId } : {}) })
  } catch {
    return new Storage()
  }
}

export async function GET(req: NextRequest) {
  const pathParam = (req.nextUrl.searchParams.get("path") ?? "").trim()

  // Security: validate path strictly before touching GCS
  if (!pathParam || pathParam.includes("..") || !SAFE_PATH_RE.test(pathParam)) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const storage = buildStorage()
    const gcsFile = storage.bucket(BUCKET_NAME).file(pathParam)

    // Check the file exists before generating a signed URL
    const [exists] = await gcsFile.exists()
    if (!exists) {
      return new NextResponse("Not found", { status: 404 })
    }

    // Fresh signed URL valid for 1 hour — only used for this redirect, never stored
    const [signedUrl] = await gcsFile.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    })

    return NextResponse.redirect(signedUrl, {
      status: 307,
      headers: {
        // Allow browsers to cache the redirect for 30 minutes
        "Cache-Control": "public, max-age=1800",
      },
    })
  } catch (err) {
    console.error("[media] error generating signed URL:", err)
    return new NextResponse("Not found", { status: 404 })
  }
}
