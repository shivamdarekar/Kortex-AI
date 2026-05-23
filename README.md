# Kortex AI

A full-stack AI platform with two independent features: a **PDF RAG chat** (upload a PDF, ask questions grounded in it) and a **Research Agent** (ask any question, get a web-sourced markdown report). Built from scratch — no LangChain abstractions in the PDF pipeline — to deeply understand every step of the RAG pipeline. The research agent uses LangChain's LCEL pipeline on top of Tavily search and Jina content extraction.

![Stack](https://img.shields.io/badge/Next.js-15-black?style=flat-square) ![Stack](https://img.shields.io/badge/Express-5-black?style=flat-square) ![Stack](https://img.shields.io/badge/TypeScript-full--stack-blue?style=flat-square) ![Stack](https://img.shields.io/badge/Pinecone-vector--db-green?style=flat-square) ![Stack](https://img.shields.io/badge/Groq-LLM-orange?style=flat-square) ![Stack](https://img.shields.io/badge/Tavily-web--search-purple?style=flat-square)

---

## What it does

### PDF RAG (`/`)
1. Upload a PDF (up to 10 MB)
2. Backend extracts text page-by-page, cleans it, and splits it into semantic chunks
3. Each chunk is embedded using HuggingFace (`BAAI/bge-small-en-v1.5`) and stored in Pinecone
4. Ask questions — the question is embedded, top-K similar chunks are retrieved, Groq generates a grounded answer
5. UI shows the full pipeline live: pages extracted, chunks created, embedding dimensions, vectors stored, per-step retrieval timing

### Research Agent (`/research`)
1. Type any research question
2. Backend searches the web via Tavily (up to 5 sources)
3. Each source URL is read and extracted via Jina Reader (Cheerio fallback)
4. Groq generates bullet-point key findings, then a full structured markdown report
5. UI animates through each pipeline stage live while the backend runs

---

## Project structure

```
Kortex AI/
├── backend/              # Node.js + Express 5 + TypeScript API
├── frontend/             # Next.js + React 19 UI
├── lanchain/             # LangChain reference demo (standalone)
│   ├── langchain-rag-demo.ts
│   └── README.md
├── BACKEND_FLOW.md       # Deep-dive: PDF RAG + Research Agent backend wiring
├── GENAI_RAG_CONCEPTS.md # RAG concepts, interview prep, glossary
└── LANGCHAIN_GUIDE.md    # LangChain concepts and when to use it
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React 19, TypeScript, Tailwind CSS v4 |
| UI Components | shadcn/ui, Radix UI, Lucide icons |
| Backend | Node.js, Express 5, TypeScript |
| PDF parsing | pdf-parse |
| Embeddings | HuggingFace Inference API — `BAAI/bge-small-en-v1.5` (384-dim) |
| Vector DB | Pinecone |
| LLM | Groq — `llama-3.3-70b-versatile` |
| Web search | Tavily API |
| Content extraction | Jina Reader API + Cheerio fallback |
| Research pipeline | LangChain LCEL (`@langchain/core`, `@langchain/groq`) |
| Markdown rendering | react-markdown |

---

## Backend

### Setup

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

### Environment variables

```env
# Required
GROQ_API_KEY=
HF_TOKEN=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=
TAVILY_API_KEY=

# Optional overrides
PORT=5000
GROQ_MODEL=llama-3.3-70b-versatile
CHUNK_SIZE=500
CHUNK_OVERLAP=100
HF_BATCH_SIZE=5
GROQ_CONTEXT_CHUNKS=4
UPLOADS_DIR=uploads
```

### API routes

#### PDF RAG — base: `/api/pdf`

| Method | Route | Description |
|---|---|---|
| `POST` | `/upload` | Upload a PDF (multipart/form-data, field: `pdf`) |
| `POST` | `/extract-and-chunk` | Extract text and create semantic chunks |
| `POST` | `/generate-embeddings` | Embed all chunks and store in Pinecone |
| `POST` | `/retrieve-chunks` | Query Pinecone for top-K similar chunks |
| `POST` | `/ask-question` | Full RAG pipeline — answer + sources + pipeline trace |
| `POST` | `/suggest-questions` | Generate 3 suggested questions from document content |
| `GET` | `/pinecone-stats` | Index stats and namespace record count |

#### Research Agent — base: `/api/research-agent`

| Method | Route | Description |
|---|---|---|
| `POST` | `/research` | Run full research workflow — returns summary + markdown report + sources |

### Q&A modes (PDF RAG)

| Mode | Behaviour |
|---|---|
| `document` | Answers grounded strictly in retrieved PDF chunks |
| `general` | Answers from model's general knowledge, no retrieval |

### Example: PDF RAG curl flow

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

### Example: Research Agent curl

```powershell
curl.exe -X POST http://localhost:5000/api/research-agent/research `
  -H "Content-Type: application/json" `
  -d "{\"query\":\"What are the tradeoffs of RAG vs fine-tuning?\"}"
```

### Backend architecture

```
src/
├── index.ts                        # Bootstrap: loads env, starts server
├── app.ts                          # Express wiring — mounts both module routers
├── config/
│   └── index.ts                    # Centralized config + env defaults
├── modules/
│   ├── pdf-rag/                    # Manual RAG pipeline (no LangChain)
│   │   ├── index.ts
│   │   ├── config/
│   │   │   └── multer.config.ts
│   │   ├── routes/
│   │   │   └── pdf.routes.ts
│   │   ├── controllers/
│   │   │   ├── pdfUpload.controller.ts
│   │   │   ├── chunkingController.ts
│   │   │   ├── embeddingController.ts
│   │   │   ├── retrievalController.ts
│   │   │   ├── qaController.ts
│   │   │   └── suggestionsController.ts
│   │   └── services/
│   │       ├── pdfExtraction.service.ts
│   │       ├── textCleaning.service.ts
│   │       ├── chunkingService.ts
│   │       ├── batchEmbedding.service.ts
│   │       ├── pinecone.service.ts
│   │       └── groq.service.ts
│   └── research-agent/             # LangChain LCEL research pipeline
│       ├── index.ts
│       ├── types.ts
│       ├── routes/
│       │   └── research.routes.ts
│       ├── controllers/
│       │   └── research.controller.ts
│       ├── workflows/
│       │   └── research.workflow.ts  # Orchestrates all 4 stages
│       ├── services/
│       │   ├── search.service.ts     # Tavily web search
│       │   ├── extraction.service.ts # Jina + Cheerio content extraction
│       │   ├── report.service.ts     # Evidence block + fallback report builder
│       │   └── llm.service.ts        # ChatGroq model factory
│       ├── tools/
│       │   ├── tavily.tool.ts        # Tavily API client
│       │   └── jina.tool.ts          # Jina Reader + Cheerio fallback
│       └── utils/
│           ├── env.ts                # getOptionalEnv helper
│           └── text.ts               # normalizeWhitespace, truncateText
└── utils/
    ├── validation.ts               # ensureFilename, buildSafeFilePath, getTopK
    └── errorHandler.ts             # ApiError class + global error middleware
```

### Research Agent pipeline

```
POST /api/research-agent/research  { query }
  → Tavily search (up to 5 sources)
  → Jina Reader extracts full page text per URL (Cheerio fallback)
  → buildEvidenceBlock() formats sources into numbered evidence
  → Groq: summary prompt → 4–6 bullet key findings
  → Groq: report prompt → full markdown report (Overview / Key Findings /
          Tradeoffs / Recommendation / Caveats / Sources)
  → return { query, summary, report, sources[], generatedAt, usedFallback }
```

If `GROQ_API_KEY` is missing, the workflow returns a fallback report with raw source links and skips LLM calls.

### Token budget

| Model | Limit | Usage |
|---|---|---|
| `BAAI/bge-small-en-v1.5` | 512 tokens input | Chunks capped at 500 chars (~375 tokens) ✅ |
| `llama-3.3-70b-versatile` (PDF RAG) | 128k context, 6k TPM free | ~2,000 token context + 1,024 max output ✅ |
| `llama-3.3-70b-versatile` (Research) | 128k context | Evidence capped at 1,500 chars/source × 5 sources ✅ |
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

Open [http://localhost:3000](http://localhost:3000) — PDF RAG  
Open [http://localhost:3000/research](http://localhost:3000/research) — Research Agent

### Environment variables

```env
NEXT_PUBLIC_PDF_RAG_API_URL=http://localhost:5000/api/pdf
NEXT_PUBLIC_RESEARCH_AGENT_API_URL=http://localhost:5000/api/research-agent
```

### Frontend architecture

```
app/
  page.tsx                  # PDF RAG page — lazy loads upload + chat panels
  research/
    page.tsx                # Research Agent page — lazy loads ResearchPanel
  layout.tsx                # ThemeProvider + TooltipProvider + Toaster
  globals.css

components/
  upload/                   # PDF RAG upload UI
    UploadZone.tsx           # Drag-and-drop file picker, error + ready states
    UploadProgress.tsx       # Step progress bar (33% → 66% → 100%)
    PipelineStatsPanel.tsx   # Animated reveal: pages, chunks, dimensions, vectors
  chat/                     # PDF RAG chat UI
    ChatPanel.tsx            # Scrollable chat history + auto-scroll
    ChatMessage.tsx          # Markdown rendering, error bubble styling
    ChatInput.tsx            # Textarea + document/general mode toggle + send
    SourcesAccordion.tsx     # Collapsible source chunks with page + score
    RetrievalTrace.tsx       # Live animated RAG pipeline steps while waiting
    SuggestedQuestions.tsx   # 3 clickable starter question pills
  research/                 # Research Agent UI
    ResearchPanel.tsx        # Orchestrates research messages + input
    ResearchMessage.tsx      # User query bubble or assistant report bubble
    ResearchInput.tsx        # Textarea + search button
    ResearchTrace.tsx        # Animated 4-stage pipeline trace while waiting
    ResearchReport.tsx       # Summary bullets + full markdown report + sources
  shared/
    StatusBadge.tsx          # PDF pipeline status pill in header
    ThinkingIndicator.tsx    # Bouncing dots loading animation
    ThemeProvider.tsx        # next-themes wrapper
    ThemeToggle.tsx          # Sun/moon dark mode toggle
  ui/                       # shadcn/ui primitives
    accordion.tsx, badge.tsx, button.tsx, card.tsx,
    input.tsx, progress.tsx, scroll-area.tsx,
    separator.tsx, textarea.tsx, tooltip.tsx

features/
  pdf-rag/                  # PDF RAG feature slice
    hooks/
      usePdfPipeline.ts     # Upload → embed state machine + suggestions fetch
      useChat.ts            # Chat history, optimistic messages, ask logic
    api.ts                  # Axios calls: upload, generateEmbeddings, askQuestion, suggestions
    types.ts                # PipelineStatus, ChatMessage, PipelineStats, etc.
  research-agent/           # Research Agent feature slice
    hooks/
      useResearchAgent.ts   # Optimistic state machine with 4 live stage transitions
    api.ts                  # Axios call: runResearch
    types.ts                # ResearchStatus, ResearchResult, ResearchMessage

lib/
  utils.ts                  # cn() utility
```

### PDF RAG data flow

```
User drops PDF
  → usePdfPipeline.process(file)
      → POST /api/pdf/upload              → { filename, originalName, size }
      → POST /api/pdf/generate-embeddings → PipelineStats (flattened)
      → POST /api/pdf/suggest-questions   → string[] (non-blocking, fire-and-forget)

filename passed as prop to ChatPanel → useChat(filename)
  → User sends question
      → POST /api/pdf/ask-question  { filename, question, mode, topK }
          → { answer, model, sources[], pipeline }
      → Optimistic message replaced in-place by id
```

### Research Agent data flow

```
User types query
  → useResearchAgent.research(query)
      → Optimistic message + ThinkingIndicator shown immediately
      → Status animates: searching → extracting → summarizing → reporting
      → POST /api/research-agent/research  { query }
          → { query, summary, report, sources[], generatedAt, usedFallback }
      → Optimistic message replaced in-place with ResearchReport
```

### Key UX features

- **Optimistic UI** — both features show an instant placeholder message with a thinking animation; replaced in-place when the real response arrives
- **Live pipeline trace (PDF RAG)** — while waiting for an answer, animated steps show embedding → Pinecone search → chunks retrieved → building context → generating answer
- **Live pipeline trace (Research)** — 4 animated stages: Searching the web → Extracting page content → Summarising evidence → Writing full report
- **PDF pipeline reveal** — after processing, sidebar shows animated checkmarks with real stats (pages, chunks, dimensions, vectors)
- **Suggested questions** — 3 auto-generated starter questions after PDF processing, fetched non-blocking
- **Document / General mode toggle** — switch between grounded PDF answers and general knowledge
- **Dark mode** — full dark/light/system theme support via next-themes
- **Separate routes** — PDF RAG at `/`, Research Agent at `/research` — isolated state, easy to debug independently

---

## Running both together

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Backend: `http://localhost:5000`  
Frontend: `http://localhost:3000`

---

## Why no LangChain in the PDF pipeline

Every step is implemented manually to understand what's actually happening:

- **Chunking** — semantic-recursive splitting (paragraph → sentence → line → space → hard break) with configurable overlap
- **Embeddings** — direct HuggingFace Inference API calls with batching and response shape normalization
- **Vector storage** — direct Pinecone SDK with deterministic vector IDs for idempotent upserts
- **Retrieval** — direct cosine similarity search via Pinecone query
- **Generation** — direct Groq SDK with grounded system prompt, token budgets enforced

The research agent uses LangChain LCEL (`ChatPromptTemplate → ChatGroq → StringOutputParser`) because the pipeline is a straightforward two-prompt chain with no custom primitives to learn — it's the right tool for that job.
