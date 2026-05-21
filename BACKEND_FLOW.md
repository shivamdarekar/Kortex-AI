# PDF RAG Backend (No LangChain) — Backend Flow Doc

This document explains what this backend does, how it works end-to-end, and why the project was built **without LangChain**.

## What We Built

A learning-focused **RAG backend** for a single uploaded PDF:

- Upload a PDF
- Extract and clean text (page-aware)
- Chunk the text (semantic/recursive, page-aware)
- Generate embeddings (Hugging Face)
- Store vectors in Pinecone (metadata-rich)
- Retrieve relevant chunks for a question
- Generate an answer with Groq (grounded in retrieved context)

## Why “No LangChain”

We intentionally avoided LangChain to learn the primitives:

- What embeddings are and how to generate them
- How chunking affects retrieval quality
- How metadata improves citations/debugging
- How a vector DB query actually works (topK + similarity)
- How prompts + context formatting change answer quality

Once you understand these pieces, frameworks become easier to use safely.

## High-Level Architecture

- **Routes:** request entrypoints
- **Controllers:** validate input + orchestrate the workflow
- **Services:** pure “business logic” (extract/chunk/embed/store/query/LLM)
- **Utils:** shared helpers (errors, validation)
- **Config:** centralized defaults (chunk sizes, limits)

## API Routes (Current)

Mounted at `/api/pdf` in the server.

- `POST /api/pdf/upload`
- `POST /api/pdf/extract-and-chunk`
- `POST /api/pdf/generate-embeddings`
- `POST /api/pdf/retrieve-chunks`
- `POST /api/pdf/ask-question`
- `GET  /api/pdf/pinecone-stats`

## Environment Variables

These are required/used by the backend:

- `HF_TOKEN` — Hugging Face token for embeddings
- `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` — Pinecone access
- `GROQ_API_KEY` — Groq access
- `GROQ_MODEL` (optional) — defaults to `llama-3.3-70b-versatile`

Optional runtime tuning (centralized config):

- `PORT` — server port (default `5000`)
- `UPLOADS_DIR` — upload folder override (default `uploads`)
- `CHUNK_SIZE` — default chunk size (default `800`)
- `CHUNK_OVERLAP` — default overlap (default `150`)
- `HF_BATCH_SIZE` — (reserved for future use; currently batching is inside embedding service)
- `GROQ_CONTEXT_CHUNKS` — how many top chunks to send to Groq (default `4`)

## Data Model: What Goes Into Pinecone

Each stored vector has:

- `id`: deterministic (based on pdf name + chunk index + chunk hash)
- `values`: the embedding vector
- `metadata`:
  - `filename`
  - `documentId`
  - `chunkIndex`
  - `page`
  - `chunkHash`
  - `chunkLength`
  - `createdAt`
  - `text` (the actual chunk text)

Why this metadata matters:

- **Citations:** page numbers in answers
- **Debugging:** inspect the exact chunk text used
- **Reprocessing safety:** deterministic IDs reduce duplication

## End-to-End Flow (Wiring)

### 1) Upload

- Endpoint: `POST /api/pdf/upload` (multipart form-data)
- Uses Multer config to save a file into the uploads directory
- Returns `filename` which becomes the “handle” for next steps

### 2) Extract (page-aware) + Clean

- Controller: `extract-and-chunk` and `generate-embeddings` both call extraction
- Service: `extractTextFromPdf(filePath)`
  - Uses `pdf-parse` with a `pagerender` hook
  - Captures **pageNumber + cleanedText** per page
  - Returns `pages: [{ pageNumber, text }]` and full `text`

Cleaning service:

- Removes repeated headers/footers and noise
- Normalizes whitespace and encoding quirks
- Deduplicates repeated lines (common in PDFs)

### 3) Chunk (semantic/recursive, page-aware)

- Service: `createChunks(pages, {chunkSize, overlapSize})`
- Strategy: semantic/recursive splitting (paragraph → sentence → line → space → hard split)
- Overlap preserves context across boundaries
- Chunks retain `page` and global `index`

### 4) Embeddings (Hugging Face)

- Service: `generateBatchEmbeddings(texts)`
- Uses `@huggingface/inference` feature extraction (`BAAI/bge-small-en-v1.5`)
- Batches inputs and normalizes response shapes

### 5) Store in Pinecone

- Service: `storeEmbeddingsInPinecone({filename, namespace, chunks, embeddings})`
- Namespace is derived from filename (`pdf-<sanitized name>`) for single-document isolation
- Upserts vectors in batches

Note:

- Namespace clearing (`deleteAll`) is best-effort. It helps “single PDF reprocessing” but can be risky under concurrency.

### 6) Retrieval

- Controller: `retrieve-chunks`
- Steps:
  1. embed the question
  2. query Pinecone `topK`
  3. return matches (id, score, metadata)

Important: similarity scores are returned to the client (for debugging), but are **not** included in the Groq prompt.

### 7) Q&A (RAG)

- Controller: `ask-question`
- Two modes:
  - `mode: "document"` (default): grounded answer using retrieved context
  - `mode: "general"`: general knowledge answer (skips Pinecone)

Groq service:

- Builds a clean context format per chunk (no similarity scores)
- Caps context chunks (default 4)
- Uses a grounded system prompt with page citation guidance

## Practices Used (and Why)

### KISS (Keep It Simple)

- Controllers orchestrate; services do the core logic
- One pipeline step per service
- Minimal, understandable dependencies

### DRY (Don’t Repeat Yourself)

- Shared validation moved into a small utility
- Centralized defaults moved into config

### Debuggability

- Metadata includes `page`, `chunkIndex`, and `text`
- Retrieval endpoint returns matches so you can inspect what was found

### RAG Quality Practices

- Clean noisy PDF text before chunking
- Page-aware chunking for citations
- Keep prompts grounded and concise
- Don’t leak similarity scores into the LLM prompt
- Limit context size for better answer quality

## Known Limitations (Current)

- Synchronous embedding generation via HTTP request (can be slow for very large PDFs)
- Namespace clearing (`deleteAll`) is not concurrency-safe if multiple ingests happen at once
- No automated tests yet

## Next Improvements (When You Want)

- Add reranking (optional) for better retrieval quality
- Add evaluation script (gold Q/A pairs + retrieval metrics)
- Background jobs for embedding generation
- Better concurrency-safe ingestion (namespace versioning)
