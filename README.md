# Kortex AI

A full-stack RAG (Retrieval-Augmented Generation) application that lets you upload a PDF and have an intelligent conversation with it. Built from scratch — no LangChain, no abstractions — to deeply understand every step of the RAG pipeline.

![Stack](https://img.shields.io/badge/Next.js-16-black?style=flat-square) ![Stack](https://img.shields.io/badge/Express-5-black?style=flat-square) ![Stack](https://img.shields.io/badge/TypeScript-full--stack-blue?style=flat-square) ![Stack](https://img.shields.io/badge/Pinecone-vector--db-green?style=flat-square) ![Stack](https://img.shields.io/badge/Groq-LLM-orange?style=flat-square)

---

## What it does

1. Upload a PDF (up to 10 MB)
2. Backend extracts text page-by-page, cleans it, and splits it into semantic chunks
3. Each chunk is embedded using HuggingFace (`BAAI/bge-small-en-v1.5`) and stored in Pinecone
4. Ask questions — the question is embedded, top-K similar chunks are retrieved, and Groq generates a grounded answer
5. The UI shows the full RAG pipeline live: what was extracted, how many chunks, embedding dimensions, retrieval steps, and per-step timing

---

## Project structure

```
PDF RAG/
├── backend/          # Node.js + Express + TypeScript API
├── frontend/         # Next.js 16 + React 19 UI
└── docs/
    ├── BACKEND_FLOW.md
    └── GENAI_RAG_CONCEPTS.md
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| UI Components | shadcn/ui, Radix UI, Lucide icons |
| Backend | Node.js, Express 5, TypeScript |
| PDF parsing | pdf-parse |
| Embeddings | HuggingFace Inference API — `BAAI/bge-small-en-v1.5` (384-dim) |
| Vector DB | Pinecone |
| LLM | Groq — `llama-3.3-70b-versatile` |
| Markdown | react-markdown |

---

## Backend

### Setup

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend env example: [backend/.env.example](backend/.env.example)

### Environment variables

```env
GROQ_API_KEY=
HF_TOKEN=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=

# Optional overrides
PORT=5000
GROQ_MODEL=llama-3.3-70b-versatile
CHUNK_SIZE=500
CHUNK_OVERLAP=100
HF_BATCH_SIZE=5
GROQ_CONTEXT_CHUNKS=4
```

### API routes — base: `/api/pdf`

| Method | Route | Description |
|---|---|---|
| `POST` | `/upload` | Upload a PDF file (multipart/form-data, field: `pdf`) |
| `POST` | `/extract-and-chunk` | Extract text and create semantic chunks |
| `POST` | `/generate-embeddings` | Embed all chunks and store in Pinecone |
| `POST` | `/retrieve-chunks` | Query Pinecone for top-K similar chunks |
| `POST` | `/ask-question` | Full RAG pipeline — returns answer + sources + pipeline trace |
| `POST` | `/suggest-questions` | Generate 3 suggested questions from document content |
| `GET` | `/pinecone-stats` | Index stats and namespace record count |

### Example: upload + process

```powershell
# 1. Upload
curl.exe -X POST http://localhost:5000/api/pdf/upload `
  -F "pdf=@C:/path/to/document.pdf"

# 2. Generate embeddings (use filename from upload response)
curl.exe -X POST http://localhost:5000/api/pdf/generate-embeddings `
  -H "Content-Type: application/json" `
  -d "{\"filename\":\"1234567890-document.pdf\"}"

# 3. Ask a question
curl.exe -X POST http://localhost:5000/api/pdf/ask-question `
  -H "Content-Type: application/json" `
  -d "{\"filename\":\"1234567890-document.pdf\",\"question\":\"What is this document about?\",\"mode\":\"document\"}"
```

### Q&A modes

| Mode | Behaviour |
|---|---|
| `document` | Answers grounded strictly in retrieved PDF chunks |
| `general` | Answers from model's general knowledge, no retrieval |

### RAG pipeline (document mode)

```
Question
  → embed with BAAI/bge-small-en-v1.5
  → query Pinecone (top-K chunks)
  → build context from retrieved chunks
  → Groq generates grounded answer
  → return answer + sources + per-step timing
```

### Backend architecture

```
src/
├── config/
│   ├── index.ts              # Centralized config + env defaults
│   └── multer.config.ts      # File upload config
├── controllers/
│   ├── pdfUpload.controller.ts
│   ├── chunkingController.ts
│   ├── embeddingController.ts
│   ├── retrievalController.ts
│   ├── qaController.ts
│   └── suggestionsController.ts
├── services/
│   ├── pdfExtraction.service.ts   # pdf-parse + page-aware extraction
│   ├── textCleaning.service.ts    # encoding fixes, noise removal, dedup
│   ├── chunkingService.ts         # semantic-recursive chunking + overlap
│   ├── batchEmbedding.service.ts  # HF batched embeddings (5/batch, 1s delay)
│   ├── pinecone.service.ts        # upsert, query, stats
│   └── groq.service.ts            # RAG answer, general answer, suggestions
├── routes/
│   └── pdf.routes.ts
└── utils/
    ├── validation.ts         # ensureFilename, buildSafeFilePath, getTopK
    └── errorHandler.ts       # ApiError class + global error middleware
```

### Token budget

| Model | Limit | Usage |
|---|---|---|
| `BAAI/bge-small-en-v1.5` | 512 tokens input | Chunks capped at 500 chars (~375 tokens) ✅ |
| `llama-3.3-70b-versatile` | 128k context, 6k TPM (free) | ~2,000 token context + 1,024 max output ✅ |
| Suggestions call | same model | 4 chunks context + 120 max output tokens ✅ |

---

## Frontend

### Setup

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Frontend env example: [frontend/.env.example](frontend/.env.example)

Open [http://localhost:3000](http://localhost:3000)

### Frontend architecture

```
app/
  page.tsx              # Main layout — lazy loads panels
  layout.tsx            # ThemeProvider + TooltipProvider + Toaster

components/
  upload/
    UploadZone.tsx          # Drag-and-drop file picker, error + ready states
    UploadProgress.tsx      # Step progress bar (33% → 66% → 100%)
    PipelineStatsPanel.tsx  # Animated reveal: pages, chunks, dimensions, vectors
  chat/
    ChatPanel.tsx           # Scrollable chat history + auto-scroll
    ChatMessage.tsx         # Markdown rendering, error bubble styling
    ChatInput.tsx           # Textarea + document/general mode toggle + send
    SourcesAccordion.tsx    # Collapsible source chunks with page + score
    RetrievalTrace.tsx      # Live animated RAG pipeline steps while waiting
    SuggestedQuestions.tsx  # 3 clickable starter question pills
  shared/
    StatusBadge.tsx         # Pipeline status pill in header
    ThinkingIndicator.tsx   # Bouncing dots loading animation
    ThemeProvider.tsx       # next-themes wrapper
    ThemeToggle.tsx         # Sun/moon dark mode toggle

hooks/
  usePdfPipeline.ts     # Upload → embed state machine + suggestions fetch
  useChat.ts            # Chat history, optimistic messages, ask logic

lib/
  api.ts                # All axios calls + error interceptor
  types.ts              # Shared TypeScript types
```

### Key UX features

- **Live pipeline reveal** — after processing, sidebar shows animated checkmarks: PDF extracted → chunks created → embeddings generated → vectors stored, with real stats (pages, chunks, dimensions, vectors)
- **AI thinking trace** — while waiting for an answer, animated steps show the RAG pipeline live (embedding → Pinecone search → chunks retrieved → building context → generating answer). Disappears once the answer arrives
- **Optimistic UI** — assistant message appears instantly with thinking animation, replaced by the real answer
- **Suggested questions** — 3 auto-generated starter questions appear after processing, fetched non-blocking so they don't delay the ready state
- **Document / General mode toggle** — switch between grounded PDF answers and general knowledge
- **Dark mode** — full dark/light/system theme support via next-themes
- **Error handling** — client-side file validation, backend error messages surfaced cleanly, error chat bubbles styled distinctly from normal answers

---

## Running both together

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Backend runs on `http://localhost:5000`
Frontend runs on `http://localhost:3000`

### Environment files

- Backend secrets live in `backend/.env` and should be copied from `backend/.env.example`
- Frontend public config lives in `frontend/.env.local` and should be copied from `frontend/.env.example`
- Do not commit real API keys or private URLs into source files; keep them in env files only

---

## Why no LangChain

Every step is implemented manually to understand what's actually happening:

- **Chunking** — semantic-recursive splitting (paragraph → sentence → line → space → hard break) with configurable overlap
- **Embeddings** — direct HuggingFace Inference API calls with batching, rate limiting, and response shape normalization
- **Vector storage** — direct Pinecone SDK with deterministic vector IDs for idempotent upserts
- **Retrieval** — direct cosine similarity search via Pinecone query
- **Generation** — direct Groq SDK with grounded system prompt, token budgets enforced

This makes every failure debuggable and every parameter tunable without digging through framework internals.
