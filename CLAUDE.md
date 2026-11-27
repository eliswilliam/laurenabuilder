# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

Laurena Builder is an AI-powered website and application generator where users describe what they want and an AI generates frontend React code, which is bundled in-browser and rendered live. Users can also click elements directly to edit them without code.

## Commands

Requires **Node >= 22** (enforced via `engines` in `package.json`).

```bash
# Development — workspace convention is port 2020 (matches Azure routing for dev.laurenastudio.pro)
npm run dev -- -p 2020

# Build (runs prisma generate, scaffold generation, then next build)
npm run build

# Generate scaffold (must run after modifying /scaffold directory)
npm run generate:scaffold

# Tests (vitest + jsdom + @testing-library/react)
npm test                 # one-shot
npm run test:watch       # watch mode
npm run test:coverage    # coverage report
# Run a single test file: npx vitest run src/features/chat/chatStore.test.ts

# Lint
npm run lint
```

## Environment Setup

Copy `env.example` → `.env` and fill in:
- **Required for AI generation**: `GOOGLE_GENERATIVE_AI_API_KEY` (uses Gemini, defaults to `gemini-2.5-flash-lite`)
- **Auth**: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`
- **Database**: `DATABASE_URL` (Prisma/MongoDB)
- **Storage**: `SPACES_ENDPOINT`, `SPACES_BUCKET`, `SPACES_KEY`, `SPACES_SECRET` (DigitalOcean Spaces)
- **Payments**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Architecture

### Core Flow

1. **User sends a prompt** → `useChatPanel` (`src/features/chat/useChatPanel.tsx`) calls `/api/generate-code`
2. **AI generates code** → The edge route (`src/app/api/generate-code/route.ts`) streams a Gemini response containing `<laurenaAction type="file" filePath="...">` XML tags
3. **Response is parsed** → `responseProcessor.ts` extracts files from those tags
4. **VFS is updated** → `useFileManager` (`src/vfs/manager.tsx`) stores files in React state (in-browser, max 10MB / 300 files)
5. **Files are bundled** → `src/bundler/bundle_files.ts` uses **esbuild-wasm** in a Web Worker to bundle VFS files into a JS bundle
6. **Preview renders** → The bundle is injected into an iframe for live preview

### Virtual File System (VFS)

All generated files live in browser memory as `Record<string, string>` (path → content). The VFS is initialized from the scaffold (a pre-built React+shadcn template). The `FileManagerProvider` wraps the chat page and exposes `useFileManager()`.

### Scaffold

The `/scaffold` directory contains the default template (React app with shadcn/ui). `npm run generate:scaffold` converts it into `src/scaffold.generated.js` — a JS module exporting all file contents. **Always run this after modifying `/scaffold`.**

### No-Code Editor

- Users click elements in the preview iframe → the iframe posts a message → `emitElementSelection` (Zustand store in `src/lib/element-selection-stream.ts`) updates global state
- `useEditingPanel` (`src/features/editor/useEditingPanel.tsx`) reads selection and writes AST patches back to the VFS using Babel (`src/features/editor/codeTransformers/`)
- Each element in generated code gets a unique `data-id` attribute (injected via `src/vfs/dom_ids.ts`) to enable selection

### Key Directories

| Path | Purpose |
|------|---------|
| `src/app/api/generate-code/` | AI streaming endpoint (edge runtime, Gemini) |
| `src/app/api/publish/` | Publish a project → uploads bundled site to object storage |
| `src/app/api/upload-photo/`, `src/app/api/media/` | User asset uploads |
| `src/app/api/auth/` | NextAuth handlers (Google OAuth + custom "laurena" credentials provider) |
| `src/vfs/` | Virtual filesystem: manager (React Context + `useState`), DOM ID injection, codebase utils |
| `src/bundler/` | esbuild-wasm bundler + unpkg resolver plugin |
| `src/features/chat/` | Chat UI, hook, AI response parser, chat store (Zustand, has tests) |
| `src/features/editor/` | No-code editing panel, code transformers (Babel AST) |
| `src/prompts/` | LLM system prompt |
| `scaffold/` | Default template files (React + shadcn); compiled to `src/scaffold.generated.js` |
| `src/lib/git-utils.ts` | VFS → git snapshot → DigitalOcean Spaces (for saving/deploy) |
| `middleware.ts` | Edge middleware: protects every route except `/`, `/auth/*`, `/api/*` |

### AI Response Format

The LLM is prompted to emit files using:
```xml
<laurenaAction type="file" filePath="/src/App.tsx">
...file content...
</laurenaAction>
```

`responseProcessor.ts` parses these tags with regex and returns `{ filesToCreate: Record<string, string> }`.

### Auth & Database

- **Cross-domain OAuth2**: this app is a subdomain (`dev.laurenastudio.pro`) of a larger product. Sign-in is delegated to the FastAPI auth server on `laurenastudio.pro` via a one-time code exchange — see `src/app/auth/login/page.tsx` (redirect out) and `src/app/auth/callback/page.tsx` (calls `signIn("laurena", { code })`). There is no local credentials UI; NextAuth Google OAuth + magic links are also configured but the primary path is the "laurena" credentials provider.
- **Global route protection** via `middleware.ts`. Every route except `/`, `/auth/*`, `/api/*`, and Next.js internals requires a NextAuth JWT. If the JWT lacks `planActive`, the user is redirected to `${NEXT_PUBLIC_MAIN_DOMAIN_URL}/escolher-plano` on the main domain — billing lives there, not here.
- **Prisma + MongoDB** (`prisma/schema.prisma`). The active project model is `Project` with related `Message[]` and `File[]`. A legacy `ChatSession` model still exists in the schema but new code should use `Project` / `Message` / `File`. Don't add fields to `ChatSession`.
- **Stripe** webhooks live under `src/app/api/` (the public middleware exemption for `/api/*` is so webhook delivery isn't blocked).

### Deployment notes (Azure App Service)

Production runs on Azure App Service Linux (`laurenabulder`, Node 22). The GitHub Actions workflow (`.github/workflows/main_laurenabulder.yml`) builds and zip-deploys with `SCM_DO_BUILD_DURING_DEPLOYMENT=false`. Azure auto-extracts a `node_modules.tar.gz` at startup, so the tar **must** be created with `tar -czf node_modules.tar.gz -C node_modules .` — the `-C` is critical. Without it the archive nests as `node_modules/node_modules/…` and the container fails with `sh: next: not found`.
