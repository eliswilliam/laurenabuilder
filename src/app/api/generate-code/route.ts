import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleAuth } from "google-auth-library";
import { SYSTEM_PROMPT } from "@/prompts/system_prompt";
import { getServerTranslator } from "@/i18n/server";
import { apiErrorResponse, buildApiErrorPayload } from "@/lib/api-error";

// SECURITY: taille maximale du body JSON (2 MB)
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
// SECURITY: longueur maximale d'un prompt utilisateur (dernier message)
const MAX_PROMPT_LENGTH = 32_000;
// SECURITY: longueur maximale du snapshot codebase envoyé dans le contexte IA
const MAX_CODEBASE_LENGTH = 200_000;

// SECURITY: In-memory rate limiter — 10 requests per user per 60 seconds.
// Prevents cost abuse on the AI generation endpoint (each call hits Gemini/Vertex).
// Note: resets on server restart; use Redis for multi-replica environments.
const _RATE_LIMIT_MAX = 10;
const _RATE_LIMIT_WINDOW_MS = 60_000;
const _rateLimitStore = new Map<string, number[]>();

function _checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (_rateLimitStore.get(userId) ?? []).filter(
    (t) => now - t < _RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= _RATE_LIMIT_MAX) {
    _rateLimitStore.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  _rateLimitStore.set(userId, timestamps);
  return true;
}

export const runtime = "nodejs";

interface RequestBody {
  messages: BuilderMessage[];
  codebaseInfo: string;
  attachments?: BuilderAttachment[];
}

interface BuilderMessage {
  role: string;
  content: unknown;
}

interface BuilderAttachment {
  url?: string;
  fileUrl?: string;
  file_url?: string;
}

interface StreamChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  text?: string;
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

// ─── Pexels image fetching ─────────────────────────────────────────────────

const PEXELS_STOP_WORDS = new Set([
  // Portuguese
  "para", "com", "site", "criar", "quero", "que", "uma", "meu", "minha",
  "fazer", "pagina", "preciso", "isso", "sobre", "como", "seu", "sua",
  "nos", "nao", "mais", "por", "ser", "ter", "mas", "quando", "onde",
  "criar", "quero", "preciso", "uma", "meu", "minha",
  // English generics
  "and", "the", "for", "with", "this", "that", "from", "web", "website",
  "create", "build", "make", "landing", "page", "pages", "site", "app",
  "need", "want", "please", "just", "also", "very", "really", "good",
]);

async function fetchPexelsImages(
  prompt: string,
  apiKey: string,
  maxImages = 8
): Promise<string[]> {
  if (!apiKey || !prompt.trim()) return [];

  // Extract meaningful keywords
  const words = (prompt.match(/[A-Za-zÀ-ÿ]{3,}/g) || []);
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const w of words) {
    const lw = w.toLowerCase();
    if (!PEXELS_STOP_WORDS.has(lw) && !seen.has(lw)) {
      seen.add(lw);
      keywords.push(lw);
    }
  }

  // Build 3 distinct search queries for variety
  const queries: string[] = [];
  if (keywords.length >= 4) {
    queries.push(keywords.slice(0, 4).join(" "));
    queries.push(keywords.slice(0, 3).join(" ") + " professional");
    const rest = keywords.slice(4, 8).join(" ");
    if (rest) queries.push(rest);
  } else if (keywords.length > 0) {
    queries.push(keywords.join(" "));
    queries.push(keywords.join(" ") + " professional photography");
    queries.push(keywords[0] + " business");
  } else {
    queries.push(prompt.trim().slice(0, 80));
    queries.push("professional business photography");
  }

  const urls: string[] = [];
  const usedUrls = new Set<string>();

  for (const q of queries) {
    if (urls.length >= maxImages) break;
    try {
      const resp = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=4&page=1&orientation=landscape`,
        {
          headers: { Authorization: apiKey },
          // Edge runtime supports fetch with signal
        }
      );
      if (!resp.ok) continue;
      const data = await resp.json() as {
        photos?: Array<{ src?: { large2x?: string; large?: string; medium?: string } }>;
      };
      for (const photo of data.photos ?? []) {
        const url =
          photo?.src?.large2x ||
          photo?.src?.large ||
          photo?.src?.medium;
        if (
          url &&
          typeof url === "string" &&
          url.startsWith("https://images.pexels.com") &&
          !usedUrls.has(url)
        ) {
          usedUrls.add(url);
          urls.push(url);
          if (urls.length >= maxImages) break;
        }
      }
    } catch {
      // Silently skip — Pexels is a best-effort enhancement
    }
  }

  return urls;
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractAttachmentUrls(attachments: BuilderAttachment[] | undefined): string[] {
  if (!Array.isArray(attachments)) {
    return [];
  }

  const urls: string[] = [];
  const seen = new Set<string>();

  for (const item of attachments) {
    const raw = (item?.url || item?.fileUrl || item?.file_url || "").trim();
    if (!raw) continue;

    // Keep URLs only. We currently store uploaded chat images as public HTTPS links.
    if (!/^https?:\/\//i.test(raw)) continue;

    if (!seen.has(raw)) {
      seen.add(raw);
      urls.push(raw);
    }
  }

  return urls.slice(0, 12);
}

function parseCredentialsFromEnv(t: TranslateFn): Record<string, unknown> | undefined {
  const rawCreds = (
    process.env.GOOGLE_CREDENTIALS_JSON ||
    process.env.GCP_SA_KEY ||
    ""
  ).trim();

  if (!rawCreds) {
    return undefined;
  }

  try {
    let jsonStr = rawCreds;
    try {
      const decoded = Buffer.from(rawCreds, "base64").toString("utf-8");
      JSON.parse(decoded);
      jsonStr = decoded;
    } catch {
      // Not base64 - continue with raw JSON.
    }
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error(t("api.generate.invalidCredentialsJson"));
  }
}

async function getVertexAccessToken(
  t: TranslateFn,
  credentials?: Record<string, unknown>
): Promise<string> {
  const auth = new GoogleAuth({
    ...(credentials ? { credentials } : {}),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const tokenResult = await client.getAccessToken();
  const accessToken = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;

  if (!accessToken) {
    throw new Error(t("api.generate.oauthTokenFailed"));
  }

  return accessToken;
}

function extractChunkText(chunk: StreamChunk): string {
  if (typeof chunk.text === "string" && chunk.text) {
    return chunk.text;
  }

  const candidates = Array.isArray(chunk.candidates) ? chunk.candidates : [];
  let text = "";

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) {
      continue;
    }
    for (const part of parts) {
      if (typeof part?.text === "string") {
        text += part.text;
      }
    }
  }

  return text;
}

async function* parseProviderSSE(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let lineEnd = buffer.indexOf("\n");
    while (lineEnd !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);

      if (!line.startsWith("data:")) {
        lineEnd = buffer.indexOf("\n");
        continue;
      }

      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") {
        lineEnd = buffer.indexOf("\n");
        continue;
      }

      try {
        const chunk = JSON.parse(raw) as StreamChunk;
        const text = extractChunkText(chunk);
        if (text) {
          yield text;
        }
      } catch {
        // Ignore malformed provider chunks.
      }

      lineEnd = buffer.indexOf("\n");
    }
  }
}

function sse(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function classifyErrorKey(message: string): string {
  if (/rate.?limit|too many requests|429/i.test(message)) {
    return "api.generate.streamingOverloaded";
  }
  if (/overloaded|503|service.?unavailable|model.?overload/i.test(message)) {
    return "api.generate.streamingOverloaded";
  }
  if (/quota|resource.?exhausted/i.test(message)) {
    return "api.generate.streamingQuota";
  }
  return "api.generate.streamingUnknown";
}

function isTransientError(message: string): boolean {
  return (
    /rate.?limit|too many requests|429/i.test(message) ||
    /overloaded|503|service.?unavailable|model.?overload/i.test(message)
  );
}

function buildGeminiContents(
  messages: BuilderMessage[],
  codebaseInfo: string,
  uploadedImageUrls: string[]
) {
  const uploadedImagesBlock =
    uploadedImageUrls.length > 0
      ? "\n\nUser-uploaded images (use these exact URLs in <img src=\"...\"> when relevant):\n" +
        uploadedImageUrls.map((url) => `- ${url}`).join("\n")
      : "";

  const allMessages: BuilderMessage[] = [
    {
      role: "user",
      content:
        `This is my codebase. ${codebaseInfo || "(empty codebase)"}` + uploadedImagesBlock,
    },
    { role: "assistant", content: "I'm ready to help" },
    ...messages,
  ];

  return allMessages
    .map((msg) => {
      const text = extractMessageText(msg.content).trim();
      if (!text) return null;

      const role = msg.role === "assistant" ? "model" : "user";
      return {
        role,
        parts: [{ text }],
      };
    })
    .filter((entry): entry is { role: "model" | "user"; parts: Array<{ text: string }> } => Boolean(entry));
}

async function requestProviderStream(options: {
  modelId: string;
  gcpProject: string;
  gcpLocation: string;
  maxOutputTokens: number;
  dynamicSystem: string;
  contents: Array<{ role: "model" | "user"; parts: Array<{ text: string }> }>;
  signal: AbortSignal;
  t: TranslateFn;
}): Promise<Response> {
  const {
    modelId,
    gcpProject,
    gcpLocation,
    maxOutputTokens,
    dynamicSystem,
    contents,
    signal,
    t,
  } = options;

  const body = {
    contents,
    systemInstruction: {
      role: "system",
      parts: [{ text: dynamicSystem }],
    },
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      maxOutputTokens,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
    ],
  };

  if (gcpProject) {
    const credentials = parseCredentialsFromEnv(t);
    const accessToken = await getVertexAccessToken(t, credentials);
    const url =
      `https://${gcpLocation}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(gcpProject)}` +
      `/locations/${encodeURIComponent(gcpLocation)}/publishers/google/models/${encodeURIComponent(modelId)}` +
      `:streamGenerateContent?alt=sse`;

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  }

  const apiKey = (
    process.env.GOOGLE_CLOUD_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();

  if (!apiKey) {
    throw new Error(t("api.generate.providerConfigMissing"));
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}` +
    `:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { t } = getServerTranslator(request);

  // SECURITY: Authentification requise — endpoint protégé
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return apiErrorResponse(t, 401, "api.auth.unauthorized", {
      code: "AUTH_REQUIRED",
    });
  }

  // SECURITY: Active subscription required.
  // The middleware exempts all /api/ routes, so each paid API endpoint must
  // verify planActive independently. Without this check, users with expired
  // subscriptions can still consume AI generation (real cost).
  const planActive = (session.user as { planActive?: boolean }).planActive;
  if (!planActive) {
    return NextResponse.json(
      { error: "An active subscription is required.", code: "PLAN_REQUIRED" },
      { status: 403 }
    );
  }

  // SECURITY: Rate limiting — max 10 AI generation requests per user per minute.
  const userId = (session.user as { id?: string }).id ?? session.user.email ?? "unknown";
  if (!_checkRateLimit(userId)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  // SECURITY: Vérifier la taille du Content-Length avant de lire le body
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_REQUEST_BYTES) {
    return apiErrorResponse(t, 413, "api.generate.requestTooLarge", {
      code: "REQUEST_TOO_LARGE",
    });
  }

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return apiErrorResponse(t, 400, "api.request.invalidJson", {
      code: "REQUEST_INVALID_JSON",
    });
  }

  const { messages, codebaseInfo, attachments } = jsonBody as RequestBody;

  if (!Array.isArray(messages)) {
    return apiErrorResponse(t, 400, "api.generate.messagesArray", {
      code: "REQUEST_INVALID_MESSAGES",
    });
  }

  // SECURITY: Limiter la longueur du dernier message utilisateur
  const lastMsg = [...messages].reverse().find((m) => m.role === "user");
  if (lastMsg) {
    const text = typeof lastMsg.content === "string"
      ? lastMsg.content
      : JSON.stringify(lastMsg.content);
    if (text.length > MAX_PROMPT_LENGTH) {
      return apiErrorResponse(t, 400, "api.generate.promptTooLong", {
        code: "REQUEST_PROMPT_TOO_LONG",
        params: { max: MAX_PROMPT_LENGTH },
      });
    }
  }

  // SECURITY: Limiter la taille du snapshot codebase (contexte IA)
  // Un codebaseInfo trop grand peut saturer la fenêtre de contexte Gemini
  // et causer des coûts excessifs ou des timeouts.
  if (typeof codebaseInfo === "string" && codebaseInfo.length > MAX_CODEBASE_LENGTH) {
    return apiErrorResponse(t, 400, "api.generate.promptTooLong", {
      code: "REQUEST_CODEBASE_TOO_LARGE",
      params: { max: MAX_CODEBASE_LENGTH },
    });
  }

  // ── Model selection — mirrors novidade_ai_service.py settings.NOVIDADE_GEMINI_MODEL ──
  const modelId =
    process.env.NOVIDADE_GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    process.env.GOOGLE_MODEL ||
    "gemini-2.5-flash-lite";

  // ── Max output tokens — mirrors NOVIDADE_GEMINI_MAX_OUTPUT_TOKENS (default 65535) ──
  const maxOutputTokens = parseInt(
    process.env.NOVIDADE_GEMINI_MAX_OUTPUT_TOKENS || "65535",
    10
  );

  // ── Provider selection — mirrors novidade_ai_service.py _build_client() ──
  // Vertex AI mode when GOOGLE_CLOUD_PROJECT is set.
  // Developer API fallback when only an API key is available.
  const gcpProject = (process.env.GOOGLE_CLOUD_PROJECT ?? "").trim();
  const gcpLocation = (process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1").trim() || "us-central1";

  // Extract the last user message text for Pexels search
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const promptText = extractMessageText(lastUserMsg?.content).trim();

  // Fetch Pexels images (best-effort — doesn't block if Pexels is down)
  const pexelsKey = process.env.PEXELS_API_KEY || "";
  const pexelsImages = await fetchPexelsImages(promptText, pexelsKey);
  const uploadedImages = extractAttachmentUrls(attachments);

  // Build dynamic system prompt with real image URLs when available
  let dynamicSystem = SYSTEM_PROMPT;
  if (uploadedImages.length > 0) {
    dynamicSystem +=
      `\n\n<uploaded_image_resources>\n` +
      `CRITICAL: Prefer these user-uploaded images first. Use these exact URLs in <img src=\"...\"> tags when relevant.\n` +
      `Do not invent user image URLs.\n` +
      uploadedImages.map((url, i) => `  ${i + 1}. ${url}`).join("\n") +
      `\n</uploaded_image_resources>`;
  }

  if (pexelsImages.length > 0) {
    dynamicSystem +=
      `\n\n<image_resources>\n` +
      `CRITICAL — MANDATORY: You MUST use these Pexels URLs in <img> tags throughout the generated site.\n` +
      `Place them across ALL visual sections: hero banner, feature cards, about section, gallery, team, backgrounds.\n` +
      `Use EVERY URL at least once. Reuse them in multiple sections if needed — they are real hosted photos.\n` +
      `ABSOLUTE PROHIBITION: do NOT use placehold.co, picsum.photos, unsplash.com, via.placeholder.com, or any invented/fallback URL when these images are provided.\n` +
      pexelsImages.map((url, i) => `  ${i + 1}. ${url}`).join("\n") +
      `\n</image_resources>`;
  }

  const contents = buildGeminiContents(messages, codebaseInfo, uploadedImages);

  // ── Retry with exponential backoff (handles 429 / 503 / transient errors) ──
  const MAX_ATTEMPTS = 4;
  const RETRY_DELAYS = [1500, 4000, 9000, 18000];
  const encoder = new TextEncoder();

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let emittedText = false;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const providerResponse = await requestProviderStream({
            modelId,
            gcpProject,
            gcpLocation,
            maxOutputTokens,
            dynamicSystem,
            contents,
            signal: request.signal,
            t,
          });

          if (!providerResponse.ok) {
            const errorText = await providerResponse.text();
            throw new Error(errorText || `Provider request failed (${providerResponse.status})`);
          }

          if (!providerResponse.body) {
            throw new Error("Provider returned an empty streaming body.");
          }

          for await (const delta of parseProviderSSE(providerResponse.body)) {
            if (!delta) continue;
            emittedText = true;
            full += delta;
            controller.enqueue(encoder.encode(sse({ type: "text-delta", delta })));
          }

          controller.enqueue(
            encoder.encode(
              sse({
                type: "done",
                message: {
                  role: "assistant",
                  content: full,
                },
              })
            )
          );
          controller.close();
          return;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[generate-code] Error on attempt ${attempt + 1}/${MAX_ATTEMPTS}:`, msg);

          if (!emittedText && isTransientError(msg) && attempt < MAX_ATTEMPTS - 1) {
            const delay = RETRY_DELAYS[attempt];
            console.warn(`[generate-code] Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          controller.enqueue(
            encoder.encode(
              sse({
                type: "error",
                ...buildApiErrorPayload(t, classifyErrorKey(msg), {
                  code: "GENERATE_STREAM_FAILED",
                }),
              })
            )
          );
          controller.close();
          return;
        }
      }

      controller.enqueue(
        encoder.encode(
          sse({
            type: "error",
            ...buildApiErrorPayload(t, "api.generate.internalServerError", {
              code: "GENERATE_INTERNAL_ERROR",
            }),
          })
        )
      );
      controller.close();
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
