# miaomo.ai

AI-powered PDF workspace — upload PDFs, run OCR, and chat with your documents using Claude + Pinecone RAG.

## Tech Stack

- **Frontend**: Next.js (App Router), Tailwind CSS, Radix UI
- **Auth & Storage**: Firebase Auth, Firebase Storage, Firestore
- **AI**: Anthropic Claude (chat), Google Gemini (embeddings), Pinecone (vector DB)
- **OCR**: Google Document AI
- **Backend**: Firebase Cloud Functions (PDF ingestion pipeline)

---

## Prerequisites

Before you start, install:

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation) — `npm install -g pnpm`
- [Firebase CLI](https://firebase.google.com/docs/cli) — `npm install -g firebase-tools`
- [Java JDK 21+](https://adoptium.net/) — required for the Firebase emulators (Firestore + Storage)

---

## First-Time Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd miaomo.ai

# Install Next.js app dependencies
pnpm install

# Install Cloud Functions dependencies
npm install --prefix functions
```

### 2. Set up environment variables

```bash
# Copy both example files
cp .env.example .env.local
cp functions/.env.example functions/.env
```

Then open `.env.local` and `functions/.env` and fill in all the values. See the comments in each file for where to find each key.

### 3. Log in to Firebase

```bash
firebase login
```

---

## Running Locally

### Start the Firebase Emulators (in one terminal)

```bash
firebase emulators:start
```

This starts:
| Emulator   | URL                              |
|------------|----------------------------------|
| UI (all)   | http://localhost:4000            |
| Functions  | http://localhost:5001            |
| Firestore  | http://localhost:8080            |
| Storage    | http://localhost:9199            |

### Start the Next.js dev server (in a second terminal)

```bash
pnpm dev
```

App is at **http://localhost:3000**

### Connect the app to local emulators (optional)

In `.env.local`, set:
```
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
```

This routes all Firebase calls (Auth, Firestore, Storage) through local emulators instead of production. **Remember to set it back to `false` when you're done testing.**

---

## Testing the Cloud Function

The Cloud Function (`onUploadFinalized`) triggers whenever a PDF is uploaded to Storage at the path:
```
workspaces/{workspaceId}/files/{fileId}/original.pdf
```

**Option A — Upload through the Emulator UI:**
1. Start emulators (`firebase emulators:start`)
2. Open http://localhost:4000/storage
3. Upload a PDF to `workspaces/test-workspace/files/test-file-1/original.pdf`
4. Watch the function logs in the emulator terminal

**Option B — Run the pipeline test script directly (no emulators needed):**
```bash
cd functions
npm run build
node --env-file=.env lib/test-ingest.js C:/path/to/your/test.pdf
```
This runs the full pipeline (parse → chunk → embed → Pinecone upsert) against your real API keys and prints step-by-step output.

---

## Deploying

### Deploy Cloud Functions only
```bash
cd functions
npm run build
firebase deploy --only functions
```

### Deploy everything
```bash
firebase deploy
```

> **Note:** Deploying functions requires the secrets (`PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `GOOGLE_API_KEY`) to be set in Google Cloud Secret Manager for project `miaomo-64d4f`.

---

## Project Structure

```
miaomo.ai/
├── app/                  # Next.js pages (App Router)
│   ├── api/chat/         # Streaming chat endpoint (Anthropic Claude)
│   └── api/ocr/url/      # OCR endpoint (Google Document AI)
├── components/           # React components
├── lib/firebase/         # Firebase client initialization
├── functions/            # Firebase Cloud Functions (separate Node project)
│   ├── src/              # TypeScript source
│   │   ├── index.ts      # Storage trigger entry point
│   │   ├── embeddings.ts # Gemini embedding client
│   │   ├── pinecone.ts   # Pinecone vector DB client
│   │   └── ingest/       # PDF parsing and chunking
│   └── lib/              # Compiled JS output (gitignored)
├── firebase.json         # Firebase project config + emulator ports
├── firestore.rules       # Firestore security rules
└── storage.rules         # Storage security rules
```

---

## Common Issues

**Port 8080 already in use (Firestore emulator)**
A previous emulator run left a zombie Java process. Kill it:
```bash
netstat -ano | findstr ":8080"
taskkill /PID <pid> /F
```

**`firebase: command not found`**
```bash
npm install -g firebase-tools
```

**Emulators crash immediately**
Java is required. Install [Temurin JDK 21](https://adoptium.net/) and open a new terminal.
