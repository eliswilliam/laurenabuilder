Laurena Builder — AI-Powered Website & App Generator
================================================================

Describe it. See it. Publish it.
An AI web application builder where a single prompt generates a
complete React app running live in the browser without writing a
single line of code.

Live demo : https://dev.laurenastudio.pro


────────────────────────────────────────────────────────────────
The Problem
────────────────────────────────────────────────────────────────

Most people have ideas for websites or apps, but do not know how
to code. Existing no-code tools are either too rigid (drag-and-drop
templates) or too technical. Standalone AI assistants require
separate subscriptions and do not integrate into a broader product
ecosystem.

Laurena Builder solves this by providing a dedicated AI builder
integrated directly into Laurena Studio (https://laurenastudio.pro),
a creative platform for content creators.


────────────────────────────────────────────────────────────────
What It Does
────────────────────────────────────────────────────────────────

The user types a prompt such as
"create a landing page for my bakery with a contact form and photo
gallery" and within seconds receives:

  - A functional React application rendered live in the browser
  - Full source code available to inspect and download
  - The ability to click any element on screen and edit it
    visually without writing code
  - One-click publishing to a unique public URL
  - Automatically saved version history


────────────────────────────────────────────────────────────────
Key Features
────────────────────────────────────────────────────────────────

AI Code Generation (Streaming)

  Prompts are sent to Gemini via a Next.js streaming endpoint.
  The AI streams generated files in real time using structured tags.
  A custom parser extracts the files and populates an in-memory
  Virtual File System in the browser.


100% In-Browser Compilation

  All generated files are compiled directly inside the browser
  using esbuild-wasm running in a Web Worker. There is no server-side
  build step — the bundle is injected into an iframe for an instant
  live preview, with dynamic npm package resolution.


No-Code Visual Editor

  Every element in the generated interface receives a unique
  identifier. Clicking an element in the preview opens an editing
  panel in the app. Edits are applied as Babel AST transformations
  directly to the source code, avoiding fragile string manipulation
  or file corruption. Each edit re-triggers the bundler for an
  almost instantaneous preview update.


Persistence & Publishing

  Projects are persisted in a database via Prisma ORM. File
  snapshots are versioned in cloud storage, and publishing deploys
  the project to a unique public URL.


Authentication & Billing

  Google OAuth and email magic links via NextAuth, plus cross-domain
  Single Sign-On (SSO) with the main Laurena Studio platform and
  Stripe subscription integration.


────────────────────────────────────────────────────────────────
Tech Stack
────────────────────────────────────────────────────────────────

  Framework              Next.js 15 (App Router), React 19
  Language               TypeScript
  Artificial Intelligence Google Gemini (Vertex AI / Generative AI)
  In-browser Bundler     esbuild-wasm (Web Worker)
  Code Transformation    Babel AST
  Database               MongoDB via Prisma
  Authentication         NextAuth (Google OAuth + cross-domain OAuth2)
  Storage                Google Cloud Storage / S3 + isomorphic-git
  Payments               Stripe
  Styling                TailwindCSS + shadcn/ui
  Deployment             Cloud (CI/CD via GitHub Actions)


────────────────────────────────────────────────────────────────
Architecture Overview
────────────────────────────────────────────────────────────────

  User prompt
      |
      v
  Streaming endpoint  ->  AI generates files in real time
      |
      v
  Custom parser  ->  extracts file contents
      |
      v
  Virtual File System (browser memory)
      |
      v
  esbuild-wasm (Web Worker)  ->  JS bundle
      |
      v
  iframe  ->  live preview
      |
      v
  Click element  ->  AST patch  ->  re-bundle
      |
      v
  Save  ->  version snapshot  ->  cloud storage
      |
      v
  Publish  ->  public URL


────────────────────────────────────────────────────────────────
Technical Highlights
────────────────────────────────────────────────────────────────

Zero-server build
  The entire compilation cycle (parse, bundle, render) happens in
  the browser. The server only streams text from the AI.

AST-based editing
  Instead of manipulating strings or re-prompting the AI on every
  edit, changes are applied as deterministic patches on the code's
  Abstract Syntax Tree, preserving formatting and structure.

Cross-domain authentication
  The builder operates as a separate application authenticated by
  an OAuth2 server on the main domain using short-TTL one-time
  authorization code exchange.

Git-like storage snapshots
  Project state is versioned as snapshots in cloud storage,
  providing version history and rollback capabilities.


────────────────────────────────────────────────────────────────
Part of Laurena Studio
────────────────────────────────────────────────────────────────

Laurena Builder is the website creation module of Laurena Studio
(https://laurenastudio.pro), an all-in-one platform for creators
featuring AI content generation, social media scheduling, media
library management, analytics, and more.
