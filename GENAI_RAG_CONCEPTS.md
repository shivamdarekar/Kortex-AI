# GenAI + RAG Concepts (Project Revision Notes)

This document is a revision-friendly guide to the GenAI and RAG concepts used in this project. It’s written for quick review before interviews and for building intuition.

## 1) What is GenAI?

**Generative AI** models produce new content (text, images, code, audio) from patterns learned during training.

In this project, GenAI is used for:

- Generating answers from retrieved context (Groq LLM)
- Summarization and grounded Q&A

### LLM vs “Chatbot”

- **LLM:** a model that predicts next tokens.
- **Chatbot app:** a system that wraps an LLM with:
  - memory
  - retrieval
  - tools
  - safety rules
  - UI / API
### LLM vs “Chatbot”

- **LLM:** a model that predicts next tokens.

## 2) What is RAG?

**RAG (Retrieval-Augmented Generation)** = Retrieval + Generation.

- Retrieval fetches relevant text chunks from a knowledge source.
- Generation uses an LLM to answer using those retrieved chunks.

Why RAG?

- Keeps answers grounded in your documents
- Reduces hallucinations
- Works without retraining the model

# GenAI + RAG Concepts (Consolidated)

This concise guide covers core GenAI and RAG concepts used in the project, focused for interview revision and practical design decisions.

## Overview

- Generative AI (GenAI) produces text, images, code, etc., from learned patterns.
- Retrieval-Augmented Generation (RAG) augments LLMs by retrieving relevant document passages and grounding answers in that context.

## Embeddings

- Vector representations of text; similar meanings map to nearby vectors.
- Typical workflow: generate embeddings for document chunks, embed the query, perform nearest-neighbor search.
- Model details: encoder-based or LLM-derived embeddings; pooling (mean/CLS) and normalization (L2) affect similarity.
- Quality checks: recall@K and MRR on small labeled sets; sanity-check identical vs. unrelated pairs.

## Vector DB & Indexing

- Vector DBs (Pinecone, FAISS, Milvus) provide ANN search (HNSW, IVF+PQ) optimized for latency and scale.
- Store: `id`, `values`, and `metadata` (filename, page, chunkIndex, text, timestamps).
- Index trade-offs: update frequency vs. throughput, memory vs. approximation (PQ) vs. latency.

## Search Types

- Lexical (BM25) — exact-match scenarios.
- Semantic (vector) — meaning-based retrieval.
- Hybrid — combine vector + keyword for best results.
- Reranking — retrieve topN cheaply, then rerank with a stronger cross-encoder or LLM.

## Chunking Strategies

- Chunking is critical: affects embedding quality and retrieval recall.
- Types: fixed-size (with possible overlap), semantic/recursive (preferred), structure-aware, page-aware.
- Choose semantic/page-aware for PDFs and resumes to preserve meaning and enable citations.

## Prompt Wiring and Modes

- System message: permanent rules (do not invent facts, citation rules, brevity).
- User message: task-specific question and the context block.
- Modes: `document` (grounded answers only) vs `general` (model knowledge).
- Keep context concise, avoid sending similarity numbers to the LLM, and limit number of chunks.

## Hallucination and Grounding

**Hallucination** means the model produces an answer that sounds plausible but is not supported by the source material.

In RAG apps, hallucination usually happens when:

- retrieval returns weak or empty context
- the prompt is too open-ended
- the model is asked to answer beyond the retrieved evidence
- too much unrelated context confuses the model

**Grounding** means forcing the answer to stay anchored in evidence from the retrieved chunks.

How this project grounds answers:

- it retrieves top-K chunks from Pinecone before answering
- it passes only the relevant chunk text into the Groq prompt
- it uses a system message that says to answer using the provided context only
- it keeps document mode separate from general knowledge mode
- it includes page metadata and source text so answers can be traced back

Practical grounding techniques:

- require citations or page references when available
- return a fallback message if no relevant chunks are found
- keep chunk context small and focused
- avoid injecting similarity scores into the prompt
- prefer `document` mode when the user asks about an uploaded PDF

Good mental model:

- **Hallucination** = unsupported answer
- **Grounding** = answer constrained by retrieved evidence

## Missing Basics To Know

These are the extra concepts that often matter in real GenAI apps and interviews:

- **Token limit / context window**: how much text the model can see at once.
- **Temperature**: higher values make outputs more creative; lower values make them more deterministic.
- **Top-p / sampling**: controls how the model chooses next tokens.
- **Streaming**: send partial output to the UI as it is generated.
- **Retry and rate limits**: handle API failures, throttling, and backoff.
- **OCR**: needed when PDFs are scanned images rather than text-based files.
- **Structured output**: use JSON or schema-like responses when the UI needs reliable fields.
- **Tracing and observability**: debug retrieval, latency, and token usage.
- **Safety / guardrails**: reduce harmful, private, or unsupported outputs.
- **Evaluation**: test retrieval recall, faithfulness, and answer quality on a small gold set.

## Similarity Scores

- Useful for filtering, debugging, and tuning; do not inject raw scores into prompts.

## Failure Modes & Mitigations

- Bad extraction → improve cleaning, OCR, or structure-aware parsing.
- Bad chunking → tune chunk size/overlap or use semantic splitting.
- Empty retrievals → increase topK or relax filtering; add fallback behavior.
- Hallucinations → require provenance and conservative prompts.

## Evaluation Metrics

- Retrieval: Recall@K, MRR, nDCG.
- Answer quality: human-rated faithfulness, ROUGE, or task-specific metrics.

## Operational Considerations

- Batch embeddings, retry/backoff for 429s, client-side rate limits.
- Use deterministic IDs for idempotent upserts.
- Offload long jobs to background workers (Bull/Redis) when needed.

## Privacy & Safety

- Avoid sending sensitive PII to third-party APIs where possible.
- Document retention policies and consider regional deployments for compliance.

## Advanced Patterns & Agentic AI

- Fusion-in-Decoder (FiD), augmented retrieval, memory+RAG.
- Agentic AI adds planning/tools/execution; requires stronger guardrails and auditing.

## Common Interview Questions

- What problem does RAG solve that plain prompting does not?
- Why does chunking affect retrieval quality so much?
- What is the difference between embeddings and vector search?
- Why do hallucinations happen, and how do you reduce them?
- Why should similarity scores usually stay out of the prompt?
- When should you use document-grounded mode vs general mode?
- What metadata do you store with chunks, and why?
- How do you evaluate retrieval quality and answer faithfulness?
- What is the difference between GenAI, RAG, and agentic AI?

## Quick Glossary

- Embedding, ANN, HNSW, PQ, topK, recall@K, MRR, FiD, reranker, cross-encoder, few-shot, hallucination, provenance.

---

This consolidated document keeps the essential details while removing repetition. If you want a one-page cheat-sheet or links to code files, tell me which format you prefer.
   - Combines keyword + vector
   - Often best in production

4. **Reranking**
   - First retrieve topK cheaply
   - Then use a stronger model (cross-encoder) to rerank for relevance
### Search Types (Common in Real Systems)

1. **Keyword / Lexical search**

## 6) Chunking (Huge Impact on RAG Quality)

LLMs cannot take infinite context, and embeddings work best on coherent units.

So we split documents into chunks.

### Chunking Types

1. **Fixed-size chunking**
   - Split every N characters or tokens
   - Simple but can break meaning

2. **Fixed-size with overlap**
   - Same, but add overlap so context isn’t lost

3. **Semantic / recursive chunking (what we used)**
   - Prefer splitting by:
     paragraph → sentence → line → space → fallback
   - Produces more coherent chunks

4. **Structure-aware chunking**
   - Use document structure (headings, tables)
   - Great when you can parse structure reliably

5. **Page-aware chunking (what we added)**
   - Keep track of which page a chunk comes from
   - Enables citations: “According to page 3...”

### Which Chunking When?

- Resumes / PDFs with sections: semantic + page-aware is great
- Code docs / API references: often hybrid (section-aware + semantic)
- Tables: may need specialized parsing
### Chunking Types

1. **Fixed-size chunking**

## 7) Prompting: Grounding vs General Knowledge

Two good product modes:

- **Document-grounded mode:** “Answer only from the uploaded document.”
- **General mode:** “Explain generally using model knowledge.”

Why split?

- A resume may mention “React” without explaining it.
- Grounded mode should say: “Mentioned, but not described.”
- General mode can teach React.

### Prompt Wiring (How Context Is Used)

Prompt wiring means how you build:

- the system message (permanent rules)
- the user message (task-specific question)
- the context block (retrieved chunks)

Good wiring principles:

- Keep system rules stable and small
- Keep context formatted consistently
- Avoid sending raw similarity scores to the LLM
- Limit context size (too much context reduces quality)
- Request citations if you have page metadata
### Prompt Wiring (How Context Is Used)

Prompt wiring means how you build:

## 8) Similarity Scores: Where They Belong

Similarity scores are useful for:

- filtering very low relevance
- debugging retrieval quality
- evaluation and tuning

They are usually **not** useful in the LLM prompt.

Reason:

- It can distract the model
- The model may over-trust a numeric score

## 9) Typical RAG Failure Modes

1. **Bad extraction**
   - PDF text is noisy → chunks are garbage → retrieval fails

2. **Bad chunking**
   - chunks too big → mixed topics
   - chunks too small → missing context

3. **Wrong retrieval settings**
   - topK too low → miss relevant chunks
   - too much filtering → empty results

4. **Prompt not grounded**
   - model hallucinates when context is weak

5. **No citations / weak metadata**
   - user can’t verify the answer
## 9) Typical RAG Failure Modes

1. **Bad extraction**

## 10) How to Evaluate RAG (Simple Approach)
## 11) GenAI vs Agentic AI

### GenAI

Create a small list of 20–50 questions.

Measure:

- **Retrieval recall:** do retrieved chunks contain the answer?
- **Answer faithfulness:** does the answer match chunk evidence?
- **Citation correctness:** are cited pages correct?

Keep a “gold set” file for iterative improvements.

## 11) GenAI vs Agentic AI

### GenAI

- “Single call” generation: prompt → completion
- Example: summarization, Q&A, explanation

### Agentic AI

- Multi-step reasoning + tool use
- Has goals, plans, and actions
- Example behaviors:
  - search → read docs → write output → verify
  - call external tools (DB, web, code runners)

### What This Project Is (Right Now)

Primarily **GenAI + RAG**, not full agentic AI:

- It retrieves chunks and calls an LLM.
- It does not autonomously loop, plan, or use multiple tools.

### How It Could Become Agentic

- Add a planning step (“what info do I need?”)
- Add tools:
  - query different namespaces
  - re-run retrieval with different settings
  - generate follow-up questions
  - run evaluation automatically
### What This Project Is (Right Now)

Primarily **GenAI + RAG**, not full agentic AI:

## 12) Terms You Used in This Project (Cheat Sheet)

- **Embedding:** vector meaning representation
- **Vector DB:** store/query embeddings (Pinecone)
- **TopK:** number of retrieved matches
- **Namespace:** isolate vectors per document
- **Chunk overlap:** preserve continuity across splits
- **Semantic chunking:** split on natural boundaries
- **Grounded answer:** answer only from context
- **Hallucination:** confident but unsupported output
- **Citations:** page-aware referencing
- **Prompt wiring:** how you format and inject context

---

This document should serve as a compact but thorough revision guide covering both conceptual and practical aspects of building retrieval-augmented GenAI systems like this project.

## Tools, Tool Types, and Agents — Use Cases

This section lists common tools and tool types used in GenAI/RAG systems, plus simple agent components and practical use-cases.

- **Embedding services**: produce vector representations for text.
   - Examples: Hugging Face InferenceClient models (BAAI/bge-*), OpenAI embeddings.
   - Use-case: index document chunks for semantic search; pick smaller/cheaper models for high-volume indexing, larger ones for quality-sensitive tasks.

- **Vector databases / ANN indexes**: store vectors + metadata and provide nearest-neighbor search.
   - Examples: Pinecone, FAISS, Milvus, Weaviate.
   - Use-case: low-latency semantic retrieval for RAG; choose managed (Pinecone) for simplicity or FAISS for offline/self-hosted control.

- **LLM providers**: generate final answers, rerank passages, or act as a cross-encoder.
   - Examples: Groq, OpenAI, Anthropic, local LLMs.
   - Use-case: answer generation (grounded or general), reranking topN retrievals, or synthesizing multi-passage evidence.

- **Parsing / OCR tools**: extract text and structure from documents.
   - Examples: pdf-parse, Tesseract, AWS Textract, Google Document AI.
   - Use-case: PDFs with images or scanned documents need OCR; structured extraction improves chunking quality.

- **Chunking / preprocessing utilities**: semantic splitters, dedupers, cleaners.
   - Examples: custom recursive chunkers, sentence tokenizers, duplicate-line removal utilities.
   - Use-case: produce coherent chunks that balance context length and focus for embeddings.

- **Rerankers / cross-encoders**: refine initial ANN results for final relevance.
   - Examples: cross-encoder models or LLM-based rerankers.
   - Use-case: improve precision for small topK before passing to the generator.

- **Background job queues / workers**: handle long-running ingestion tasks.
   - Examples: BullMQ (Redis), RabbitMQ, Celery (Python), Sidekiq (Ruby).
   - Use-case: enqueue large PDF embedding jobs to avoid blocking HTTP requests and scale workers separately.

- **Monitoring & Observability**: metrics, tracing, and logs.
   - Examples: Prometheus + Grafana, DataDog, Sentry, OpenTelemetry.
   - Use-case: track embedding latency, query throughput, error rates, and model costs.

- **Security & Governance tools**: data loss prevention, redaction, and access control.
   - Use-case: redact PII before sending to third-party APIs; enforce retention policies and audit trails.

Agent components (simple definitions and when to use them):

- **Planner**: decides subgoals for multi-step tasks.
   - Use-case: when an agent must decompose a complex user request into retrievals, tool calls, or follow-ups.

- **Retriever**: fetches evidence or supporting documents.
   - Use-case: core of RAG; returns candidate passages for reasoning.

- **Executor / Tool Caller**: performs actions (DB writes, HTTP calls, code execution).
   - Use-case: when automation or side-effects are required (e.g., save a summary, call an API, run a search).

- **Verifier**: checks outputs for correctness or safety.
   - Use-case: validate LLM responses against retrieved evidence and reject unsupported claims.

When to use agents vs simple RAG:

- Use simple RAG (retriever + generator) when tasks are single-shot document-grounded Q&A, summarization, or search-driven features.
- Use agentic patterns when the app must perform multi-step workflows, call external tools, or plan and validate actions (e.g., automated research assistants, data pipelines with conditional steps).

Safety note: agentic systems require stricter guardrails (action permissions, step auditing, human-in-the-loop approvals) before enabling write or external actions.

## Types of prompts (common) and use-cases

Below are common prompt types you will use in GenAI systems, and practical use-cases for each.

- Instruction / Directives: Ask the model to perform a specific task (summarize, translate, refactor). Use-case: "Summarize this resume into a 3-bullet candidate profile." Good for deterministic, task-focused outputs.

- Zero-shot prompts: Provide the task without examples. Use-case: quick Q&A when task is obvious ("What is the lawyer's experience in IP?"). Best when instructions are clear and model is reliable.

- Few-shot prompts: Include 1–3 examples in the prompt. Use-case: formatting-sensitive tasks (convert bullet points to JSON) or when you want the model to follow a pattern.

- Chain-of-thought / Step-by-step prompts: Ask model to explain reasoning or show steps. Use-case: complex reasoning or debugging tasks where intermediate steps help verification. Use lower temperature and be cautious for safety-sensitive apps.

- Role-play / Persona prompts: Set a role (e.g., "You are an interviewer"). Use-case: simulated interviews, customer support personas, or tailored tone and expertise.

- Retrieval-augmented prompts: Inject retrieved chunks and ask the LLM to answer using them. Use-case: document-grounded Q&A where provenance and citations matter.

- Template / Fill-in prompts: Provide a structured template and ask model to populate fields. Use-case: extract structured data from resumes (name, title, skills) into JSON.

- Clarifying / Follow-up prompts: Ask the model to request missing info. Use-case: when retrieval returns low-confidence or ambiguous results—prompt the model to ask a clarifying question before answering.

- Summarization prompts: Ask for concise summaries at a given length and style. Use-case: executive summaries of long reports or meeting notes.

- Classification / Extraction prompts: Ask model to label or extract entities. Use-case: classify document type, extract dates, or pull named entities into a list.

- Translation prompts: Convert text from one language to another. Use-case: multilingual ingestion pipelines or user-facing translations.

- Creative / Ideation prompts: Open-ended generation (brainstorming, creative copy). Use-case: marketing copy, story starters, or idea generation—use higher temperature.

- Code generation / Debugging prompts: Ask for code examples or fixes. Use-case: produce small code snippets, propose bug fixes, or explain stack traces.

Guidance: pick the prompt type that matches the task constraints (need for grounding, structure, determinism). Prefer explicit instructions, small examples for formatting tasks, and retrieval-augmentation when provenance is required.

## 13) Prompt Engineering (Practices & Patterns)

- System vs user messages: keep system messages short and rule-like, use user message for the task and examples.
- Few-shot examples: include 1–3 in-context examples when the task benefits from demonstration.
- Temperature / sampling: lower temperature (0.0–0.3) for deterministic factual answers; higher for creative outputs.
- Output constraints: ask for JSON or bulleted lists when you need structured output.
- Safety instructions: include short explicit rules in system prompt (no disallowed content, cite sources).

## 14) Reranking & Relevance Tuning

- Two-stage retrieval: fast ANN to get topN, then rerank with a cross-encoder or the LLM itself for final topK.
- Hard negatives: include difficult negatives during evaluation to measure real-world performance.
- Thresholds: rather than fixed numeric cutoffs, prefer relative ranking or fallback behavior (ask for clarification, return top results with a confidence note).

## 15) Operational & Scaling Concerns

- Batching: batch embedding requests to amortize latency and reduce costs (we implement batching in `batchEmbedding.service`).
- Rate limits: implement retries with exponential backoff for upstream 429s, and client-side rate limiting to protect services.
- Idempotency: deterministic vector IDs allow safe re-upserts without duplicates.
- Background processing: long-running tasks (large PDFs) should be enqueued (e.g., Bull/Redis) and processed asynchronously.
- Monitoring: capture metrics (embedding latency, upsert counts, query latency, retrieval recall) and logs for debugging.

## 16) Cost, Latency, and Throughput

- Embedding and LLM calls incur monetary costs. Tune `topK` and `GROQ_CONTEXT_CHUNKS` to balance cost and quality.
- Cache embeddings for repeated queries or commonly used documents.
- Use smaller embedding models for cheap similarity search, or distill representations if quality is acceptable.

## 17) Safety, Privacy, and Legal

- PII: avoid sending personally identifiable information to third-party APIs where possible.
- Data retention: be explicit about storage of uploaded documents and embeddings.
- Compliance: consider GDPR/data locality for user documents — use regional Pinecone deployments if required.

## 18) Evaluation Metrics (Detailed)

- **Recall@K**: fraction of queries where at least one relevant document appears in topK.
- **Precision@K**: fraction of retrieved items in topK that are relevant.
- **MRR (Mean Reciprocal Rank)**: average of reciprocal ranks of first relevant item.
- **nDCG**: normalized discounted cumulative gain for graded relevance.
- **Answer-level metrics**: ROUGE, BLEU or human-rated factuality/faithfulness for generated answers.

## 19) Testing & Validation

- Unit tests: chunking logic, cleaning pipeline, deterministic ID generation.
- Integration tests: generate embeddings for a small sample and ensure Pinecone queries return expected neighbors.
- E2E tests: upload a test PDF, run ingest, retrieve, and verify answer quality against a gold set.

## 20) Model Selection & Trade-offs

- Large LLMs produce better reasoning but cost more and have higher latency.
- Smaller models with strong retrieval often outperform very large models with weak retrieval.
- Embedding model choice matters for retrieval; evaluate several embedding models on your domain.

## 21) Advanced RAG Patterns

- **Fusion-in-Decoder (FiD)**: send many retrieved passages to the decoder and let the model fuse them internally (useful for long-context aggregation).
- **Augmented Retrieval**: expand queries using query reformulation or pseudo-relevance feedback before embedding.
- **Memory + RAG**: combine long-term memory (vector DB) with short-term context (conversation history) for chat apps.

## 22) Agentic AI (Advanced)

- Components: Planner (decide subgoals), Retriever (fetch data), Executor (call tools), Verifier (check outputs).
- Tooling: web browsing, code execution, databases, search, and APIs.
- Safety: agentic systems need stronger guardrails (action permissions, auditing, step-by-step verification).
## Runnables

Below are quick commands and example API calls to run the backend locally and exercise the PDF RAG endpoints.

Prerequisites:
- Node 18+, npm
- Environment variables: `HF_TOKEN`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `GROQ_API_KEY`. Optionally `UPLOADS_DIR`.

Development
```bash
npm install
npm run dev    # starts ts-node-dev (watch + hot reload)
```

Build & Start
```bash
npm run build  # tsc -p tsconfig.json
npm start      # node dist/index.js
```

Environment (example for PowerShell)
```powershell
$env:HF_TOKEN="your_hf_token"
$env:PINECONE_API_KEY="your_pinecone_key"
$env:PINECONE_INDEX_NAME="your_index_name"
$env:GROQ_API_KEY="your_groq_key"
```

Quick API examples (assumes server at http://localhost:3000 and endpoints under /api/pdf)

1) Upload PDF
```bash
curl -X POST "http://localhost:3000/api/pdf/upload" \
   -F "pdf=@./sample.pdf"
```

2) Extract & Chunk (returns chunk preview)
```bash
curl -X POST "http://localhost:3000/api/pdf/extract-and-chunk" \
   -H "Content-Type: application/json" \
   -d '{"filename":"sample.pdf"}'
```

3) Generate Embeddings + Store in Pinecone
```bash
curl -X POST "http://localhost:3000/api/pdf/generate-embeddings" \
   -H "Content-Type: application/json" \
   -d '{"filename":"sample.pdf"}'
```

4) Retrieve topK chunks for a question
```bash
curl -X POST "http://localhost:3000/api/pdf/retrieve-chunks" \
   -H "Content-Type: application/json" \
   -d '{"filename":"sample.pdf","question":"What is the main contribution?","topK":5}'
```

5) Ask a question (document-grounded mode, returns answer + sources)
```bash
curl -X POST "http://localhost:3000/api/pdf/ask-question" \
   -H "Content-Type: application/json" \
   -d '{"filename":"sample.pdf","question":"Summarize the results","mode":"document","topK":5}'
```

Notes:
- Replace `sample.pdf` with the actual uploaded filename returned by the upload endpoint.
- Increase `topK` or `GROQ_CONTEXT_CHUNKS` in `src/config/index.ts` for broader context at the cost of more LLM tokens.
- For Windows `cmd` use `set` for env vars, for PowerShell use `$env:VAR=...`.

If you want, I can also add these run commands to `backend/data.txt` or `README.md`.

## 23) Practical Tips for Interviews

- Be ready to explain trade-offs: embedding size vs latency, index type vs update cost, and chunk size vs recall.
- Know evaluation metrics and a short plan to test RAG quality.
- Explain a simple mitigation for hallucinations: provenance, conservative prompts, and human-in-the-loop review.

## 24) Glossary (Short)

- Embedding, ANN, HNSW, PQ, topK, recall@K, MRR, FiD, reranker, cross-encoder, few-shot, system prompt, chain-of-thought, hallucination, provenance.

---

This document should serve as a compact but thorough revision guide covering both conceptual and practical aspects of building retrieval-augmented GenAI systems like this project.

