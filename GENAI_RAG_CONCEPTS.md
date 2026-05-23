# GenAI + RAG Concepts

Revision guide for the concepts used in this project. Written for quick review before interviews and for building intuition about what the code is actually doing.

---

## 1. What is GenAI?

Generative AI models produce new content (text, images, code) from patterns learned during training.

In this project, GenAI is used for:
- Generating grounded answers from retrieved PDF chunks (Groq, PDF RAG module)
- Generating key findings and full research reports from web evidence (Groq, Research Agent module)

### LLM vs "Chatbot"

- **LLM:** a model that predicts next tokens
- **Chatbot app:** a system that wraps an LLM with memory, retrieval, tools, safety rules, and a UI

---

## 2. What is RAG?

**RAG (Retrieval-Augmented Generation)** = Retrieval + Generation.

- Retrieval fetches relevant text chunks from a knowledge source
- Generation uses an LLM to answer using those retrieved chunks

Why RAG?
- Keeps answers grounded in your documents
- Reduces hallucinations
- Works without retraining the model

---

## 3. Embeddings

- Vector representations of text — similar meanings map to nearby vectors
- Typical workflow: embed document chunks at index time, embed the query at query time, nearest-neighbor search
- This project uses `BAAI/bge-small-en-v1.5` (384-dim) via HuggingFace Inference API
- Pooling (mean/CLS) and L2 normalization affect similarity quality
- Quality checks: recall@K and MRR on small labeled sets; sanity-check identical vs. unrelated pairs

---

## 4. Vector DB and Indexing

- Vector DBs (Pinecone, FAISS, Milvus) provide ANN search (HNSW, IVF+PQ) optimized for latency and scale
- This project uses Pinecone with per-document namespaces (`pdf-<sanitized-name>`)
- Each vector stores: `id`, `values`, and `metadata` (filename, page, chunkIndex, text, timestamps)
- Deterministic IDs (`<documentId>-chunk-<index>-<hash>`) allow safe idempotent re-upserts

---

## 5. Search Types

- **Lexical (BM25)** — exact-match, good for keyword queries
- **Semantic (vector)** — meaning-based, what this project uses
- **Hybrid** — combine vector + keyword, often best in production
- **Reranking** — retrieve topN cheaply, then rerank with a cross-encoder or LLM for final topK

---

## 6. Chunking

Chunking is critical — it directly affects embedding quality and retrieval recall.

### Types

| Type | Description |
|---|---|
| Fixed-size | Split every N chars/tokens — simple but can break meaning |
| Fixed-size with overlap | Same, but overlap preserves context across boundaries |
| Semantic/recursive | Split on paragraph → sentence → line → space → hard break (what this project uses) |
| Structure-aware | Use document headings/tables — great when structure is reliable |
| Page-aware | Track which page a chunk came from — enables citations |

This project uses **semantic/recursive + page-aware** chunking. Chunk size defaults to 500 chars (~375 tokens), safely under the 512-token embedding model limit.

### Which chunking when?

- PDFs with sections: semantic + page-aware
- Code docs / API references: section-aware + semantic hybrid
- Tables: specialized parsing needed

---

## 7. Prompt Wiring and Modes

**System message:** permanent rules (do not invent facts, cite page numbers, be concise)  
**User message:** task-specific question + context block of retrieved chunks

### Modes in this project

| Mode | Behaviour |
|---|---|
| `document` | Answer only from retrieved PDF chunks — grounded |
| `general` | Answer from model's general knowledge — no retrieval |

Why split? A resume may mention "React" without explaining it. Document mode says "mentioned but not described." General mode can teach React.

### Good wiring principles

- Keep system rules stable and small
- Format context consistently (numbered blocks with page metadata)
- Never send raw similarity scores to the LLM
- Limit context size — too much context reduces answer quality
- Request citations when page metadata is available

---

## 8. Hallucination and Grounding

**Hallucination** — the model produces a plausible-sounding answer not supported by the source material.

Hallucination happens when:
- Retrieval returns weak or empty context
- The prompt is too open-ended
- Too much unrelated context confuses the model

**Grounding** — forcing the answer to stay anchored in retrieved evidence.

How this project grounds answers:
- Retrieves top-K chunks from Pinecone before answering
- Passes only relevant chunk text into the Groq prompt
- System message says to answer using provided context only
- Document mode is kept separate from general knowledge mode
- Page metadata and source text allow answers to be traced back

**Mental model:** hallucination = unsupported answer, grounding = answer constrained by retrieved evidence.

---

## 9. Similarity Scores

Useful for:
- Filtering very low relevance results
- Debugging retrieval quality
- Evaluation and tuning

**Not** useful in the LLM prompt — it can distract the model and cause it to over-trust a numeric score. This project returns scores to the client UI for debugging but strips them before building the Groq context.

---

## 10. RAG Failure Modes

| Failure | Cause | Mitigation |
|---|---|---|
| Bad extraction | Noisy PDF text | Improve cleaning, add OCR for scanned PDFs |
| Bad chunking | Chunks too big (mixed topics) or too small (missing context) | Tune chunk size/overlap, use semantic splitting |
| Empty retrieval | topK too low or over-filtering | Increase topK, relax filters, add fallback behavior |
| Hallucination | Weak context, open-ended prompt | Require provenance, conservative system prompt |
| No citations | Missing page metadata | Store page number per chunk (this project does this) |

---

## 11. GenAI vs Agentic AI

### GenAI (what the PDF RAG module is)
- Single-call generation: prompt → completion
- Retrieves chunks, calls LLM, returns answer
- Does not autonomously loop, plan, or use multiple tools

### Agentic AI (what the Research Agent approximates)
- Multi-step reasoning + tool use
- Has goals, plans, and actions
- This project's research agent: search → extract → summarize → report
- It is a **fixed pipeline**, not a true agent (the LLM does not choose which tool to call next)

### How the research agent could become truly agentic
- Add a planning step ("what sources do I need?")
- Let the LLM decide whether to re-search with a refined query
- Add tools: query different namespaces, run follow-up searches, validate claims

---

## 12. Evaluation

### Retrieval metrics
- **Recall@K** — fraction of queries where at least one relevant chunk appears in topK
- **Precision@K** — fraction of retrieved items in topK that are relevant
- **MRR (Mean Reciprocal Rank)** — average of reciprocal ranks of first relevant item
- **nDCG** — normalized discounted cumulative gain for graded relevance

### Answer quality metrics
- ROUGE, BLEU, or human-rated faithfulness/factuality
- Simple approach: create 20–50 gold Q&A pairs, measure retrieval recall and answer faithfulness

---

## 13. Prompt Engineering

- **System vs user messages:** keep system messages short and rule-like; use user message for the task and context
- **Few-shot examples:** include 1–3 in-context examples for formatting-sensitive tasks
- **Temperature:** 0.0–0.3 for deterministic factual answers; higher for creative outputs (this project uses 0.2 for research)
- **Output constraints:** ask for JSON or bullet lists when you need structured output
- **Safety instructions:** include explicit rules in system prompt (no unsupported claims, cite sources)

---

## 14. Common Prompt Types

| Type | Use case |
|---|---|
| Instruction / Directive | Summarize, translate, refactor |
| Zero-shot | Quick Q&A when task is obvious |
| Few-shot | Formatting-sensitive tasks, pattern following |
| Chain-of-thought | Complex reasoning, debugging |
| Retrieval-augmented | Document-grounded Q&A (what this project uses) |
| Template / Fill-in | Extract structured data (name, title, skills) into JSON |
| Summarization | Executive summaries of long reports |
| Classification / Extraction | Label document type, extract named entities |

---

## 15. Operational Concerns

- **Batching:** batch embedding requests to amortize latency (implemented in `batchEmbedding.service.ts`)
- **Rate limits:** implement retries with exponential backoff for 429s
- **Idempotency:** deterministic vector IDs allow safe re-upserts without duplicates
- **Background processing:** long-running tasks (large PDFs) should be enqueued (e.g., BullMQ/Redis) for async processing
- **Monitoring:** capture embedding latency, upsert counts, query latency, retrieval recall

---

## 16. Cost, Latency, and Throughput

- Tune `topK` and `GROQ_CONTEXT_CHUNKS` to balance cost and quality
- Cache embeddings for repeated queries or commonly used documents
- Use smaller embedding models for cheap similarity search
- Research agent: evidence is capped at 1,500 chars/source × 5 sources to stay within token budget

---

## 17. Privacy and Safety

- Avoid sending PII to third-party APIs where possible
- Be explicit about storage of uploaded documents and embeddings
- Consider GDPR/data locality for user documents — use regional Pinecone deployments if required

---

## 18. Advanced RAG Patterns

- **Fusion-in-Decoder (FiD):** send many retrieved passages to the decoder and let the model fuse them internally
- **Augmented Retrieval:** expand queries using query reformulation before embedding
- **Memory + RAG:** combine long-term memory (vector DB) with short-term context (conversation history) for chat apps
- **Reranking:** retrieve topN cheaply, then rerank with a cross-encoder for final topK

---

## 19. Glossary

| Term | Definition |
|---|---|
| Embedding | Vector representation of text |
| ANN | Approximate nearest-neighbor search |
| HNSW | Hierarchical Navigable Small World — ANN index algorithm |
| PQ | Product Quantization — vector compression |
| topK | Number of retrieved matches |
| Recall@K | Fraction of queries with a relevant result in topK |
| MRR | Mean Reciprocal Rank |
| nDCG | Normalized Discounted Cumulative Gain |
| Namespace | Pinecone isolation scope per document |
| Chunk overlap | Shared chars between adjacent chunks for continuity |
| Semantic chunking | Split on natural language boundaries |
| Grounded answer | Answer constrained to retrieved evidence |
| Hallucination | Confident but unsupported model output |
| Provenance | Traceable source for a claim (page number, URL) |
| Prompt wiring | How context and instructions are formatted and injected |
| FiD | Fusion-in-Decoder — multi-passage aggregation pattern |
| Cross-encoder | Reranker that scores query-document pairs jointly |
| LCEL | LangChain Expression Language — pipe-based chain composition |

---

## 20. Common Interview Questions

- What problem does RAG solve that plain prompting does not?
- Why does chunking affect retrieval quality so much?
- What is the difference between embeddings and vector search?
- Why do hallucinations happen, and how do you reduce them?
- Why should similarity scores stay out of the LLM prompt?
- When should you use document-grounded mode vs general mode?
- What metadata do you store with chunks, and why?
- How do you evaluate retrieval quality and answer faithfulness?
- What is the difference between GenAI, RAG, and agentic AI?
- What is the difference between a chain and an agent?
- When would you use LangChain vs building manually?
