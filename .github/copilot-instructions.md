# Copilot / AI Agent Instructions for miaomo.ai

Short, actionable guidance to help AI agents be productive in this repository.

## Big picture
- This is a Next.js (app router) web app (see [package.json](package.json)) built on Next 16 with an `app/` directory. The app is wrapped with an `AuthProvider` in [app/layout.tsx](app/layout.tsx#L1) so authentication context is available throughout the UI.
- Frontend UI components live in `components/` (examples: [components/Auth.tsx](components/Auth.tsx#L1), [components/FileUpload.tsx](components/FileUpload.tsx#L1)).
- Server logic is implemented as Next.js Route Handlers under `app/api/` (examples: [app/api/chat/route.ts](app/api/chat/route.ts#L1), [app/api/ocr/url/route.ts](app/api/ocr/url/route.ts#L1)). Some routes set `runtime = "nodejs"` and raise `maxDuration` for longer server operations.

## Key integrations & external services
- Firebase for auth, Firestore and Storage: initialized in [lib/firebase/firebase.ts](lib/firebase/firebase.ts#L1). Environment keys are `NEXT_PUBLIC_FIREBASE_*`.
- Google Document AI (`@google-cloud/documentai`) is used in OCR route. Required env vars: `DOC_AI_LOCATION`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `DOC_AI_PROCESSOR_ID`, and `NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID`. The route fetches a storage URL, converts it to bytes, and calls `processDocument()` — see [app/api/ocr/url/route.ts](app/api/ocr/url/route.ts#L1).
- AI SDKs: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai` are present. The chat route uses streaming via `streamText()` and an Anthropic model: see [app/api/chat/route.ts](app/api/chat/route.ts#L1).

## Request/response shapes and examples
- POST /api/chat: JSON body { "messages": UIMessage[] } — route converts messages with `convertToModelMessages()` then streams a model response. See [app/api/chat/route.ts](app/api/chat/route.ts#L1).
- POST /api/ocr/url: JSON body { "url": string, "mimeType": string } — returns `{ fullText, pages }`. The route validates mime types and returns helpful error JSON on failure. See [app/api/ocr/url/route.ts](app/api/ocr/url/route.ts#L1).

## Patterns & conventions
- UI components using browser-only APIs include a top line `"use client"` (see `components/*`). Keep server-only code out of those files.
- Shared client-side initialization (Firebase) lives in `lib/` and exports named instances (`auth`, `db`, `storage`). Import from `@/lib/firebase/firebase`.
- Auth context: use `useAuth()` (from `components/Auth.tsx`) rather than directly querying Firebase in UI components.
- Local state: some UI components intentionally persist small metadata to `localStorage` (see `components/FileUpload.tsx`). Be defensive when reading localStorage (try/catch) as done there.

## Developer workflows & commands
- Install & run: this repo uses `pnpm` (see `packageManager` in [package.json](package.json)). Typical flow:

```bash
pnpm install
pnpm dev     # runs next dev
pnpm build
pnpm start
pnpm lint
```

- Environment: create `.env.local` from `.env.example` (README mentions this). Key env vars are listed above — ensure `GOOGLE_PRIVATE_KEY` is stored with escaped newlines or wrapped in quotes; the code strips wrapping quotes and replaces `\\n` with real newlines before use.

## Safety notes for edits
- Route handlers may run in Node runtime and require secrets — avoid leaking secrets into client bundles. If a change touches an API route, confirm exported `runtime` and env usage.
- The OCR flow downloads files via a storage URL and loads the bytes into memory before calling Document AI — changes to large-file handling should consider streaming and memory usage.

## Where to look for examples
- App layout & auth context: [app/layout.tsx](app/layout.tsx#L1) and [components/Auth.tsx](components/Auth.tsx#L1)
- Server routes: [app/api/chat/route.ts](app/api/chat/route.ts#L1) and [app/api/ocr/url/route.ts](app/api/ocr/url/route.ts#L1)
- Firebase init: [lib/firebase/firebase.ts](lib/firebase/firebase.ts#L1)

## If you need to make changes
- Follow the pattern: small, focused PRs. Keep client/server separation clear. If adding env vars, update `.env.example` and README.

---
If anything here is unclear or you want more detail on a specific area (routing, AI SDK usage, or environment setup), tell me which part to expand.
