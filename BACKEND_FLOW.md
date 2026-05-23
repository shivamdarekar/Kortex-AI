# Kortex AI — Backend Flow

This document explains how both backend modules work end-to-end: the manual PDF RAG pipeline and the LangChain-based Research Agent.

---

## Architecture overview

```
src/
├── index.ts          # Bootstrap: dotenv.config(), starts Express server
├── app.ts            # Mounts both module routers + global error handler
├── config/index.ts   # Centralized env defaults (chunk size, overlap, port, etc.)
├── modules/
│   ├── pdf-rag/      # Manual RAG pipeline — no LangChain
│   └── research-agent/ # LangChain LCEL pipeline — Tavily + Jina + Groq
└── utils/
    ├── errorHandler.ts  # ApiError class + globalErrorHandler middleware
    └── validation.ts    # ensureFilename, buildSafeFilePath, getTopK
```

Routes are mounted in `app.ts`:
- `POST /api/pdf/*` → pdf-rag module
- `POST /api/research-agent/*` → research-agent module

---

## Module 1: PDF RAG

### What it does

Upload a PDF → extract text → chunk → embed → store in Pinecone → answer questions grounded in the document.

### Routes (`/api/pdf`)

| Method | Route | Controller |
|---|---|---|
| `POST` | `/upload` | `pdfUpload.controller.ts` |
| `POST` | `/extract-and-chunk` | `chunkingController.ts` |
| `POST` | `/generate-embeddings` | `embeddingController.ts` |
| `POST` | `/retrieve-chunks` | `retrievalController.ts` |
| `POST` | `/ask-question` | `qaController.ts` |
| `POST` | `/suggest-questions` | `suggestionsController.ts` |
| `GET` | `/pinecone-stats` | `retrievalController.ts` |

### Step-by-step flow

#### 1. Upload — `POST /api/pdf/upload`

- Multer saves the file to `uploads/` with a timestamped filename (e.g. `1748123456-document.pdf`)
- Returns `{ filename, originalName, size }`
- `filename` is the handle that threads through every subsequent call

#### 2. Extract and chunk — `POST /api/pdf/extract-and-chunk`

Called standalone for inspection, also called internally by `generate-embeddings`.

**Extraction** (`pdfExtraction.service.ts`):
- Uses `pdf-parse` with a `pagerender` hook to capture text per page
- Returns `pages: [{ pageNumber, text }]` and full concatenated `text`

**Cleaning** (`textCleaning.service.ts`):
- Removes repeated headers/footers
- Normalizes whitespace and encoding quirks
- Deduplicates repeated lines common in PDFs

**Chunking** (`chunkingService.ts`):
- Semantic-recursive splitting: tries paragraph → sentence → line → space → hard break
- Configurable `chunkSize` (default 500 chars, ~375 tokens) and `overlap` (default 100 chars)
- Each chunk retains `page` number and global `chunkIndex`

#### 3. Generate embeddings — `POST /api/pdf/generate-embeddings`

Single endpoint that runs extraction + chunking + embedding + Pinecone upsert in sequence.

**Embedding** (`batchEmbedding.service.ts`):
- Calls HuggingFace Inference API (`BAAI/bge-small-en-v1.5`, 384-dim)
- Batches requests (default batch size 5) to stay within rate limits
- Normalizes response shapes (array vs nested array)

**Pinecone storage** (`pinecone.service.ts`):
- Namespace derived from filename: `pdf-<sanitized-name>` — isolates each document
- Clears namespace before upsert (idempotent reprocessing)
- Vector ID is deterministic: `<documentId>-chunk-<index>-<hash>` — safe to re-upsert
- Metadata stored per vector: `filename`, `documentId`, `chunkIndex`, `page`, `chunkHash`, `chunkLength`, `createdAt`, `text`

Returns flattened stats: `{ extraction, chunking, embeddings, pinecone }`.

#### 4. Retrieve chunks — `POST /api/pdf/retrieve-chunks`

- Embeds the question using the same HuggingFace model
- Queries Pinecone with `topK` (default 5)
- Returns matches with `id`, `score`, and full metadata including `text` and `page`
- Scores are returned to the client for debugging but **never sent to the LLM**

#### 5. Ask question — `POST /api/pdf/ask-question`

Two modes:

**`document` mode:**
```
embed question → query Pinecone (topK) → build context block → Groq generates answer
```
- Context is built from top chunks (capped at `GROQ_CONTEXT_CHUNKS`, default 4)
- System prompt instructs Groq to answer only from provided context and cite page numbers
- Returns `{ answer, model, sources[], mode, pipeline }` where `pipeline` contains per-step timing

**`general` mode:**
- Skips Pinecone entirely
- Sends question directly to Groq with a general-knowledge system prompt
- Returns same shape with empty `sources[]`

**Groq service** (`groq.service.ts`):
- Direct Groq SDK — no LangChain
- Context formatted as numbered blocks: `[1] Page N\n<chunk text>`
- Max output tokens: 1,024

#### 6. Suggest questions — `POST /api/pdf/suggest-questions`

- Takes first 4 chunks from the document
- Sends to Groq with a prompt asking for 3 suggested questions
- Max output tokens: 120 (keeps it cheap)
- Returns `{ questions: string[] }`

### Data model (Pinecone vector)

```ts
{
  id: "<documentId>-chunk-<index>-<hash>",
  values: number[],  // 384-dim embedding
  metadata: {
    filename: string,
    documentId: string,
    chunkIndex: number,
    page: number,
    chunkHash: string,
    chunkLength: number,
    createdAt: string,
    text: string,
  }
}
```

### Token budget

| Model | Limit | Usage |
|---|---|---|
| `BAAI/bge-small-en-v1.5` | 512 tokens | Chunks capped at 500 chars (~375 tokens) ✅ |
| `llama-3.3-70b-versatile` | 128k context, 6k TPM free | ~2,000 token context + 1,024 max output ✅ |
| Suggestions | same model | 4 chunks + 120 max output ✅ |

---

## Module 2: Research Agent

### What it does

Accept a research question → search the web → extract full page content → generate key findings → write a structured markdown report.

### Route (`/api/research-agent`)

| Method | Route | Controller |
|---|---|---|
| `POST` | `/research` | `research.controller.ts` |

### Step-by-step flow

#### 1. Validate input — `research.controller.ts`

- Reads `query` from request body
- `normalizeWhitespace()` collapses extra spaces
- Rejects if query < 3 chars or > 300 chars
- Delegates to `runResearchWorkflow(query)`

#### 2. Web search — `search.service.ts` → `tavily.tool.ts`

- `POST https://api.tavily.com/search` with `max_results: 5`, `search_depth: "basic"`
- Returns up to 5 sources: `{ title, url, sourceLink, snippet }`
- Snippet is capped at 300 chars (used as fallback if extraction fails)
- Throws if `TAVILY_API_KEY` is not set

#### 3. Content extraction — `extraction.service.ts` → `jina.tool.ts`

All 5 sources are extracted in parallel (`Promise.all`).

**Primary path — Jina Reader:**
- Rewrites URL to `https://r.jina.ai/http://<url>`
- Returns clean markdown/text of the page
- Used if response length ≥ 200 chars
- Truncated to 8,000 chars

**Fallback — Cheerio:**
- Direct HTTP GET of the original URL
- Strips `script`, `style`, `noscript`, `svg`, `iframe`, `nav`, `footer`, `header`, `aside`
- Extracts `body` text
- Truncated to 8,000 chars

If both fail for a source, the original source metadata (with snippet) is kept — extraction failure is non-fatal.

#### 4. Build evidence block — `report.service.ts`

```
buildEvidenceBlock(sources):
  For each source:
    content = truncate(normalize(source.content ?? source.snippet), 1500)
    "[N] <title>\nURL: <url>\nEvidence: <content>"
  Joined with double newlines
```

#### 5. LLM pipeline — `research.workflow.ts` (LangChain LCEL)

Uses `ChatGroq` via `@langchain/groq` and `ChatPromptTemplate` + `StringOutputParser` from `@langchain/core`.

**Summary call:**
```
summaryPrompt.pipe(model).pipe(parser).invoke({ query, evidence })
→ 4–6 bullet points of key findings
```

**Report call:**
```
reportPrompt.pipe(model).pipe(parser).invoke({ query, summary, evidence })
→ Full markdown report:
    # Overview
    # Key Findings
    # Tradeoffs / Comparisons
    # Recommendation
    # Caveats
    # Sources
```

**Fallback mode** (no `GROQ_API_KEY`):
- Skips both LLM calls
- Returns a minimal markdown report with raw source links
- `usedFallback: true` in response

#### 6. Response shape

```ts
{
  success: true,
  data: {
    query: string,
    summary: string,          // bullet findings
    report: string,           // full markdown
    sources: [
      { title, sourceLink, url }
    ],
    generatedAt: string,      // ISO timestamp
    usedFallback: boolean,
  }
}
```

### Research Agent pipeline diagram

```
POST /api/research-agent/research  { query }
  │
  ├─ Tavily search ──────────────────────────► up to 5 sources
  │
  ├─ Jina/Cheerio extraction (parallel) ────► sources with full content
  │
  ├─ buildEvidenceBlock() ───────────────────► numbered evidence string
  │
  ├─ Groq: summary prompt ───────────────────► 4–6 bullet findings
  │
  └─ Groq: report prompt ────────────────────► full markdown report
```

---

## Shared utilities

### `errorHandler.ts`

```ts
class ApiError extends Error {
  constructor(public statusCode: number, message: string)
}

globalErrorHandler(err, req, res, next):
  // handles ApiError (known) and unknown errors
  // returns { success: false, message }
```

### `validation.ts`

- `ensureFilename(body)` — extracts and validates `filename` from request body, throws `ApiError(400)` if missing
- `buildSafeFilePath(filename)` — joins with `UPLOADS_DIR`, prevents path traversal
- `getTopK(body)` — extracts optional `topK` with a safe default

---

## Known limitations

- Embedding generation is synchronous HTTP — slow for very large PDFs
- Namespace `deleteAll` before re-upsert is not concurrency-safe under simultaneous ingests
- Research agent has no caching — identical queries hit Tavily and Groq every time
- No automated tests yet
