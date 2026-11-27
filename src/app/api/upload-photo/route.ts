/**
 * POST /api/upload-photo
 *
 * Accepts a multipart form with a "file" field (image).
 * Uploads it to Google Cloud Storage bucket builder_laurena/up/{userId}/{uuid}.{ext}
 * Returns { url: "https://storage.googleapis.com/builder_laurena/up/..." }
 *
 * Auth: NextAuth session + active subscription required.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { Storage } from "@google-cloud/storage"
import { getServerTranslator } from "@/i18n/server"
import { apiErrorResponse } from "@/lib/api-error"

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
}

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// SECURITY: Magic bytes validation — the browser-provided MIME type (fileEntry.type)
// can be spoofed. We verify the actual file content before storing it.
// Each entry: [hex signature bytes, accepted MIME types that match]
const MAGIC_SIGNATURES: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mime: "image/png"  },
  { bytes: [0xFF, 0xD8, 0xFF],                                  mime: "image/jpeg" },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],               mime: "image/gif"  }, // GIF87a
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],               mime: "image/gif"  }, // GIF89a
]

function detectMimeFromMagic(buf: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (sig.bytes.every((b, i) => buf[i] === b)) return sig.mime
  }
  // WebP: RIFF????WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp"
  return null
}

const uniformAccessByBucket = new Map<string, boolean>()

type ParsedServiceAccount = {
  credentials: Record<string, unknown>
  projectId?: string
  clientEmail?: string
  source: "GOOGLE_CREDENTIALS_JSON" | "GCP_SA_KEY"
}

function getConfiguredProjectId(): string | undefined {
  const project =
    (process.env.GOOGLE_CLOUD_PROJECT ?? "").trim() ||
    (process.env.GCP_PROJECT_ID ?? "").trim()
  return project || undefined
}

function parseJsonMaybeBase64(raw: string): Record<string, unknown> {
  let jsonStr = raw

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8")
    JSON.parse(decoded) // validate - throws if not valid JSON
    jsonStr = decoded
  } catch {
    // Not base64 - use as raw JSON.
  }

  return JSON.parse(jsonStr) as Record<string, unknown>
}

function parseEnvServiceAccounts(): ParsedServiceAccount[] {
  const entries: Array<{ source: ParsedServiceAccount["source"]; raw: string }> = [
    {
      source: "GOOGLE_CREDENTIALS_JSON",
      raw: (process.env.GOOGLE_CREDENTIALS_JSON ?? "").trim(),
    },
    {
      source: "GCP_SA_KEY",
      raw: (process.env.GCP_SA_KEY ?? "").trim(),
    },
  ]

  const out: ParsedServiceAccount[] = []

  for (const entry of entries) {
    if (!entry.raw) continue

    try {
      const credentials = parseJsonMaybeBase64(entry.raw)
      out.push({
        credentials,
        projectId:
          (typeof credentials.project_id === "string" ? credentials.project_id : undefined) ??
          getConfiguredProjectId(),
        clientEmail: typeof credentials.client_email === "string" ? credentials.client_email : undefined,
        source: entry.source,
      })
    } catch (err) {
      console.warn(`[upload-photo] Ignoring invalid ${entry.source}:`, err)
    }
  }

  return out
}

function buildStorageFromServiceAccount(parsed: ParsedServiceAccount): Storage {
  return new Storage({
    credentials: parsed.credentials,
    ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
  })
}

function buildADCStorage(): Storage {
  const projectId = getConfiguredProjectId()
  return new Storage({
    ...(projectId ? { projectId } : {}),
  })
}

function isPermissionDenied(err: unknown): boolean {
  const code = (err as { code?: number })?.code
  const message = err instanceof Error ? err.message : String(err)

  if (code === 403) return true
  return /storage\.objects\.create|permission\s+denied|does not have/i.test(message)
}

function isUniformAccessAclError(err: unknown): boolean {
  const code = (err as { code?: number })?.code
  const message = err instanceof Error ? err.message : String(err)
  return (
    code === 400 &&
    /uniform bucket-level access is enabled|cannot update access control/i.test(message)
  )
}

async function hasUniformBucketLevelAccess(storage: Storage, bucketName: string): Promise<boolean> {
  const cached = uniformAccessByBucket.get(bucketName)
  if (typeof cached === "boolean") {
    return cached
  }

  try {
    const [meta] = await storage.bucket(bucketName).getMetadata()
    const enabledRaw = (meta as {
      iamConfiguration?: { uniformBucketLevelAccess?: { enabled?: boolean | string } }
    })?.iamConfiguration?.uniformBucketLevelAccess?.enabled
    const enabled = enabledRaw === true || enabledRaw === "true"
    uniformAccessByBucket.set(bucketName, enabled)
    return enabled
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[upload-photo] bucket metadata check failed for ${bucketName}: ${message}`)
    return false
  }
}

async function buildReadableUrl(gcsFile: ReturnType<Storage["bucket"]>["file"], publicUrl: string) {
  try {
    const [signedUrl] = await gcsFile.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 24 * 60 * 60 * 1000,
    })
    return { url: signedUrl, isSignedUrl: true }
  } catch (signedErr) {
    const message = signedErr instanceof Error ? signedErr.message : String(signedErr)
    console.warn(`[upload-photo] signed URL fallback failed: ${message}`)
    return { url: publicUrl, isSignedUrl: false }
  }
}

async function uploadWithStorage(options: {
  storage: Storage
  bucketName: string
  objectPath: string
  buffer: Buffer
  contentType: string
}): Promise<{ url: string; isSignedUrl: boolean }> {
  const { storage, bucketName, objectPath, buffer, contentType } = options
  const gcsFile = storage.bucket(bucketName).file(objectPath)
  const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`

  await gcsFile.save(buffer, {
    metadata: { contentType },
    resumable: false,
  })

  if (await hasUniformBucketLevelAccess(storage, bucketName)) {
    // Uniform bucket-level access disables object ACL methods like makePublic.
    return buildReadableUrl(gcsFile, publicUrl)
  }

  // Some buckets use object-level ACLs, others use uniform bucket-level access.
  // Try makePublic when allowed, but do not fail if ACLs are disabled.
  try {
    await gcsFile.makePublic()
    return { url: publicUrl, isSignedUrl: false }
  } catch (aclErr) {
    if (isUniformAccessAclError(aclErr)) {
      uniformAccessByBucket.set(bucketName, true)
      return buildReadableUrl(gcsFile, publicUrl)
    }

    const message = aclErr instanceof Error ? aclErr.message : String(aclErr)
    console.warn(`[upload-photo] makePublic skipped: ${message}`)
    return buildReadableUrl(gcsFile, publicUrl)
  }
}

export async function POST(request: Request) {
  const { t } = getServerTranslator(request)

  // 1. Require authenticated session with an active subscription.
  // The middleware exempts all /api/ routes, so this endpoint must verify
  // planActive independently. Without this check, any authenticated user
  // (even with an expired plan) can upload files to GCS.
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return apiErrorResponse(t, 401, "api.auth.unauthorized", {
      code: "AUTH_REQUIRED",
    })
  }

  const planActive = (session.user as { planActive?: boolean }).planActive
  if (!planActive) {
    return NextResponse.json(
      { error: "An active subscription is required.", code: "PLAN_REQUIRED" },
      { status: 403 }
    )
  }

  const userId = (session.user as { id?: string }).id ?? "anon"

  // 2. Parse multipart form
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return apiErrorResponse(t, 400, "api.request.invalidRequest", {
      code: "REQUEST_INVALID_FORM_DATA",
    })
  }

  const fileEntry = formData.get("file")
  if (!fileEntry || !(fileEntry instanceof Blob)) {
    return apiErrorResponse(t, 400, "api.request.noFile", {
      code: "UPLOAD_NO_FILE",
    })
  }

  // 3. Validate declared MIME type
  const contentType = (fileEntry.type || "").toLowerCase()
  const ext = ALLOWED_TYPES[contentType]
  if (!ext) {
    return apiErrorResponse(t, 400, "api.upload.typeNotAllowed", {
      code: "UPLOAD_UNSUPPORTED_FILE_TYPE",
    })
  }

  const arrayBuffer = await fileEntry.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (buffer.length > MAX_BYTES) {
    return apiErrorResponse(t, 413, "api.upload.fileTooLarge", {
      code: "UPLOAD_FILE_TOO_LARGE",
    })
  }

  // SECURITY: Magic bytes validation — verify actual file content, not just the
  // browser-provided MIME type which can be trivially spoofed.
  const detectedMime = detectMimeFromMagic(buffer)
  const normalizedDeclared = contentType === "image/jpg" ? "image/jpeg" : contentType
  if (!detectedMime || detectedMime !== normalizedDeclared) {
    return apiErrorResponse(t, 400, "api.upload.typeNotAllowed", {
      code: "UPLOAD_MAGIC_BYTES_MISMATCH",
    })
  }

  // 4. Upload to GCS
  const bucketName = (process.env.GCS_BUCKET ?? "builder_laurena").trim() || "builder_laurena"
  const configuredPrefix = (process.env.GCS_UPLOAD_PREFIX ?? "up").trim()
  const prefix = configuredPrefix.replace(/^\/+|\/+$/g, "") || "up"
  // SECURITY: UUID filename — never use timestamp or user-provided name to avoid
  // predictable paths and path traversal attacks.
  const objectPath = `${prefix}/${userId}/${crypto.randomUUID()}.${ext}`

  try {
    const parsedAccounts = parseEnvServiceAccounts()
    const candidates: Array<{ name: string; storage: Storage; principal?: string }> = []

    for (const parsed of parsedAccounts) {
      candidates.push({
        name: parsed.source,
        storage: buildStorageFromServiceAccount(parsed),
        principal: parsed.clientEmail,
      })
    }

    // Always keep ADC fallback as second attempt for local/dev environments.
    candidates.push({
      name: "ADC",
      storage: buildADCStorage(),
    })

    let lastError: unknown = null
    let uploadedUrl: string | null = null
    let uploadedIsSignedUrl = false
    let permissionErrorPrincipal: string | undefined

    for (const candidate of candidates) {
      try {
        const uploaded = await uploadWithStorage({
          storage: candidate.storage,
          bucketName,
          objectPath,
          buffer,
          contentType,
        })
        uploadedUrl = uploaded.url
        uploadedIsSignedUrl = uploaded.isSignedUrl
        lastError = null
        break
      } catch (err) {
        lastError = err
        console.error(`[upload-photo] GCS error via ${candidate.name}:`, err)

        if (isPermissionDenied(err) && candidate.principal) {
          permissionErrorPrincipal = candidate.principal
        }
      }
    }

    if (lastError) {
      if (isPermissionDenied(lastError)) {
        return apiErrorResponse(t, 403, "api.upload.permissionDenied", {
          code: "UPLOAD_GCS_PERMISSION_DENIED",
          params: {
            principal: permissionErrorPrincipal ? ` (${permissionErrorPrincipal})` : "",
            bucket: bucketName,
          },
          extra: {
            bucket: bucketName,
            objectPath,
          },
        })
      }

      throw lastError
    }

    // When GCS returns a temporary signed URL (Uniform Bucket Level Access),
    // replace it with a permanent proxy URL so the signed URL is never embedded
    // in generated site code or exposed to the AI.
    let url = uploadedUrl ?? `https://storage.googleapis.com/${bucketName}/${objectPath}`
    if (uploadedIsSignedUrl) {
      const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
      url = baseUrl
        ? `${baseUrl}/api/media?path=${encodeURIComponent(objectPath)}`
        : `https://storage.googleapis.com/${bucketName}/${objectPath}`
    }

    console.log(`[upload-photo] Uploaded → ${url}`)
    return NextResponse.json({
      url,
      isSignedUrl: false,
      bucket: bucketName,
      objectPath,
    })
  } catch (err) {
    console.error("[upload-photo] GCS error:", err)
    return apiErrorResponse(t, 500, "api.upload.failed", {
      code: "UPLOAD_GCS_FAILED",
    })
  }
}
