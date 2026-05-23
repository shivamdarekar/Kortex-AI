# Kortex AI — Backend Flow

This document explains how both backend modules work end-to-end: the manual PDF RAG pipeline and the LangChain-based Research Agent.

---

## Architecture overview

```
src/
├── index.ts               # Bootstrap: dotenv.config(), starts Express server
├── app.ts                 # Mounts both module routers + global error handler
├── config/index.ts        # Centralized env defaults (chunk size, overlap, port, etc.)
├── modules/
│   ├── pdf-rag/           # Manual RAG pipeline — no LangChain
│   └── research-agent/    # LangChain LCEL pipeline — Tavily + Jina + Groq
└── utils/
    ├── errorHandler.ts    # ApiError class + globalErrorHandler middleware
    └── validation.ts      # ensureFilename, buildSafeFilePath, getTopK
```

Routes are mounted in `app.ts`:
- `POST /api/pdf/*` → pdf-rag module
- `POST /api/research-agent/*` → research-agent module

---

## Module 1: PDF RAG

### What it does

Upload a PDF → extract text → clean → chunk → embed → store in Pinecone → answer questions grounded in the document.

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

Multer saves the file to `uploads/` with a timestamped filename (e.g. `1748123456-document.pdf`). Returns `{ filename, originalName, size }`. The `filename` field is the handle that threads through every subsequent call — every downstream route accepts it as the document identifier.

#### 2. Extract and chunk — `POST /api/pdf/extract-and-chunk`

Called standalone for inspection and also called internally by `generate-embeddings`.

**Extraction** (`pdfExtraction.service.ts`):
- Uses `pdf-parse` with a custom `pagerender` hook to capture text per page
- Returns `pages: [{ pageNumber, text }]` and the full concatenated `text`
- Page numbers are preserved so every chunk can carry a `page` reference for citations

**Cleaning** (`textCleaning.service.ts`):
- Removes repeated headers and footers common in multi-page PDFs
- Normalizes whitespace and encoding quirks (ligatures, stray control characters)
- Deduplicates repeated lines
- Why this matters: noisy text produces noisy embeddings → bad retrieval → bad answers

**Chunking** (`chunkingService.ts`):
- Semantic-recursive splitting: tries paragraph → sentence → line → space → hard break
- Configurable `chunkSize` (default 500 chars, ~375 tokens) and `overlap` (default 100 chars)
- Each chunk retains `page` number and global `chunkIndex`
- 500-char cap keeps every chunk well within the embedding model's 512-token input limit

#### 3. Generate embeddings — `POST /api/pdf/generate-embeddings`

Single endpoint that runs extraction → chunking → embedding → Pinecone upsert in sequence. Calling one route is all the frontend needs to fully ingest a document.

**Embedding** (`batchEmbedding.service.ts`):
- Calls HuggingFace Inference API (`BAAI/bge-small-en-v1.5`, 384-dim)
- Batches requests (default batch size 5) to stay within HuggingFace rate limits
- Normalizes response shapes across HuggingFace's two possible array formats

**Pinecone storage** (`pinecone.service.ts`):
- Namespace is derived from filename: `pdf-<sanitized-name>` — isolates each document
- Clears the namespace before upsert so re-processing a document is always idempotent
- Vector ID is deterministic: `<documentId>-chunk-<index>-<hash>` — safe to re-upsert without duplicating
- Metadata stored per vector: `filename`, `documentId`, `chunkIndex`, `page`, `chunkHash`, `chunkLength`, `createdAt`, `text`

Returns flattened stats: `{ extraction, chunking, embeddings, pinecone }`.

#### 4. Retrieve chunks — `POST /api/pdf/retrieve-chunks`

- Embeds the question using the same HuggingFace model to produce a query vector
- Queries Pinecone with `topK` (default 5) in the document's namespace
- Returns matches with `id`, `score`, and full metadata including `text` and `page`
- Scores are returned to the client for debugging but **never sent to the LLM** — scores in the prompt distort model behavior

#### 5. Ask question — `POST /api/pdf/ask-question`

Two modes controlled by a `mode` field in the request body:

**`document` mode:**
```
embed question → query Pinecone (topK) → build context block → Groq generates answer
```
- Context is built from the top chunks, capped at `GROQ_CONTEXT_CHUNKS` (default 4) to stay within token budget
- System prompt instructs Groq to answer only from the provided context and cite page numbers
- Returns `{ answer, model, sources[], mode, pipeline }` where `pipeline` contains per-step timing for the UI trace

**`general` mode:**
- Skips Pinecone entirely — no retrieval
- Sends the question directly to Groq with a general-knowledge system prompt
- Returns the same response shape with an empty `sources[]` array

**Groq service** (`groq.service.ts`):
- Direct Groq SDK — no LangChain
- Context formatted as numbered blocks: `[1] Page N\n<chunk text>`
- Max output tokens: 1,024

#### 6. Suggest questions — `POST /api/pdf/suggest-questions`

- Takes the first 4 chunks from the document as a content sample
- Sends them to Groq with a prompt asking for 3 relevant suggested questions
- Max output tokens: 120 (intentionally cheap — just starter prompts)
- Returns `{ questions: string[] }`
- Called non-blocking after embedding completes on the frontend (fire-and-forget)

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
| `BAAI/bge-small-en-v1.5` | 512 tokens input | Chunks capped at 500 chars (~375 tokens) ✅ |
| `llama-3.3-70b-versatile` | 128k context, 6k TPM free tier | ~2,000 token context + 1,024 max output ✅ |
| Suggestions call | same model | 4 chunks context + 120 max output tokens ✅ |

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

- Reads `query` from the request body
- `normalizeWhitespace()` collapses extra spaces and trims
- Rejects if query < 3 chars or > 300 chars with a `400 ApiError`
- Delegates to `runResearchWorkflow(query)`

#### 2. Web search — `search.service.ts` → `tavily.tool.ts`

- `POST https://api.tavily.com/search` with `max_results: 5`, `search_depth: "basic"`
- Returns up to 5 sources: `{ title, url, sourceLink, snippet }`
- Snippet is capped at 300 chars — used as a fallback if content extraction fails later
- Throws a clear error if `TAVILY_API_KEY` is not set so misconfiguration is obvious

#### 3. Content extraction — `extraction.service.ts` → `jina.tool.ts`

All 5 sources are extracted in parallel via `Promise.all` to keep total latency low.

**Primary path — Jina Reader:**
- Rewrites the URL to `https://r.jina.ai/http://<url>`
- Returns clean markdown/text of the full page (Jina strips nav, ads, boilerplate)
- Used when response length ≥ 200 chars
- Truncated to 8,000 chars before storing

**Fallback — Cheerio:**
- Direct HTTP GET of the original URL
- Strips `script`, `style`, `noscript`, `svg`, `iframe`, `nav`, `footer`, `header`, `aside`
- Extracts remaining `body` text
- Truncated to 8,000 chars

If both fail for a source, the original source metadata (including the snippet) is kept — extraction failure is non-fatal and the pipeline continues.

#### 4. Build evidence block — `report.service.ts`

```
buildEvidenceBlock(sources):
  For each source:
    content = truncate(normalize(source.content ?? source.snippet), 1500)
    "[N] <title>\nURL: <url>\nEvidence: <content>"
  Joined with double newlines
```

Capping each source at 1,500 chars keeps the full evidence block within ~7,500 chars across 5 sources — well within Groq's context window even after accounting for the prompt and output space.

#### 5. LLM pipeline — `research.workflow.ts` (LangChain LCEL)

Uses `ChatGroq` from `@langchain/groq` and `ChatPromptTemplate` + `StringOutputParser` from `@langchain/core`.

**Summary call:**
```
summaryPrompt.pipe(model).pipe(parser).invoke({ query, evidence })
→ 4–6 bullet points of key findings
```

**Report call:**
```
reportPrompt.pipe(model).pipe(parser).invoke({ query, summary, evidence })
→ Full markdown report with sections:
    # Overview
    # Key Findings
    # Tradeoffs / Comparisons
    # Recommendation
    # Caveats
    # Sources
```

Two separate calls (rather than one) keep each prompt focused. The summary call distills the signal; the report call uses that distilled signal to write coherently — less hallucination risk than asking one prompt to do both.

**Fallback mode** (no `GROQ_API_KEY`):
- Skips both LLM calls entirely
- Returns a minimal markdown report with raw source links and snippets
- `usedFallback: true` is set in the response so the frontend can indicate degraded mode

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
  ├─ Validate + normalize query
  │
  ├─ Tavily search ──────────────────────────► up to 5 sources (title, url, snippet)
  │
  ├─ Jina/Cheerio extraction (parallel) ────► sources enriched with full page content
  │
  ├─ buildEvidenceBlock() ───────────────────► numbered evidence string (≤1,500 chars/source)
  │
  ├─ Groq: summary prompt ───────────────────► 4–6 bullet key findings
  │
  └─ Groq: report prompt ────────────────────► full structured markdown report
```

---

## Shared utilities

### `errorHandler.ts`

```ts
class ApiError extends Error {
  constructor(public statusCode: number, message: string)
}

globalErrorHandler(err, req, res, next):
  // Handles ApiError (known, operational) and unknown errors
  // Returns { success: false, message }
  // Unknown errors return 500 without leaking internals
```

### `validation.ts`

- `ensureFilename(body)` — extracts and validates `filename` from the request body, throws `ApiError(400)` if missing or empty
- `buildSafeFilePath(filename)` — joins with `UPLOADS_DIR`, strips path traversal attempts (`../`)
- `getTopK(body)` — extracts optional `topK` with a safe numeric default

---

## Known limitations

- Embedding generation is synchronous HTTP — slow for very large PDFs; a job queue (BullMQ/Redis) would fix this
- Namespace `deleteAll` before re-upsert is not concurrency-safe under simultaneous ingests for the same document
- Research agent has no caching — identical queries hit Tavily and Groq every time
- No automated tests yet