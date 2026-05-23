# GenAI + RAG Concepts

Personal learning reference — every GenAI and RAG concept from first principles to production patterns. Written for deep understanding, interview revision, and connecting theory to what the code in this project actually does.

---

## 1. How LLMs Actually Work

### Tokens
An LLM does not read words — it reads **tokens**. A token is roughly 3–4 characters in English.

- "Hello world" ≈ 2 tokens
- Code and non-English text tokenize less efficiently
- Every API call has a token limit (input + output combined)
- You pay per token on most APIs
- Chunking strategy must respect token limits, not just character counts

**Tokenization tools:**
- `tiktoken` (OpenAI) — count tokens before sending to avoid truncation surprises
- `transformers` tokenizer from HuggingFace — use when working with local or HF-hosted models
- Always count: `input_tokens + output_tokens ≤ context_window`

### The Transformer
LLMs are built on the **Transformer architecture**. The key mechanism is **self-attention** — every token attends to every other token in the context window to build meaning.

How self-attention works (simplified):
1. Each token is projected into three vectors: Query (Q), Key (K), Value (V)
2. Attention score = softmax(Q · Kᵀ / √d) — how much each token should attend to every other
3. Output = weighted sum of all Value vectors
4. This happens in multiple "heads" in parallel (multi-head attention) — each head can learn different relationships

Key properties:
- Longer context = more computation (quadratic scaling: O(n²) with naive attention)
- Position in the prompt matters — very long contexts can cause the model to "forget" earlier content (lost-in-the-middle problem)
- The model has no memory between API calls — each call is completely stateless
- Parameters are fixed after training — the model cannot learn from your conversation

### Context Window
The maximum number of tokens the model can see at once (input + output combined).

| Model | Context window |
|---|---|
| `llama-3.3-70b-versatile` (Groq) | 128k tokens |
| GPT-4o | 128k tokens |
| Claude 3.5 Sonnet | 200k tokens |

In this project: PDF RAG uses ~2,000 tokens of context + 1,024 max output. Research agent caps evidence at 1,500 chars × 5 sources to stay within budget.

**Lost-in-the-middle:** When the context is very long, LLMs tend to recall information placed at the beginning and end better than information buried in the middle. Design your prompt to put the most critical content near the edges.

### Token Counting and Context Window Management
- Always budget tokens: `system instructions + retrieved context + chat history + answer space ≤ context_window`
- If context is tight, truncate or summarize less important history first
- For RAG: maximize relevant evidence without crowding out the answer space
- Count tokens *before* sending — don't discover truncation from a broken answer

Practical budget example (this project):
```
System prompt:      ~150 tokens
Retrieved chunks:   ~1,800 tokens (4 chunks × ~450 tokens each)
User question:      ~50 tokens
Answer space:       1,024 tokens (max_tokens setting)
Total:              ~3,024 tokens (well within 128k)
```

### Temperature
Controls randomness in token selection at generation time.

- `0.0` — always picks the highest-probability next token (deterministic, factual)
- `0.2–0.4` — slight variation, good for grounded Q&A (this project uses 0.2 for research)
- `0.7–1.0` — creative, varied outputs
- `>1.0` — increasingly random, often incoherent

Rule of thumb: use low temperature when correctness matters, higher temperature when creativity or diversity of output matters.

### Top-p (Nucleus Sampling)
Sample from the smallest set of tokens whose cumulative probability exceeds `p`.

- `top_p=0.9` — sample from tokens covering 90% of probability mass
- Lower top-p = more focused, higher = more varied
- Works alongside temperature — both affect output diversity
- At `top_p=1.0` with `temperature=0.0` you get fully deterministic output

### Top-k
Only consider the top K most probable tokens at each step.

- `top_k=40` — only the 40 most likely tokens are candidates
- Simpler than top-p but less adaptive to the probability distribution
- Low top-k = very focused, high top-k = more variety

### How generation works (simplified)
```
prompt tokens → transformer layers → probability distribution over vocabulary
→ sample next token (using temperature / top-p / top-k)
→ append token to context
→ repeat until stop token or max_tokens reached
```

This is called **autoregressive generation** — each token is generated one at a time, conditioned on all previous tokens.

---

## 2. What is GenAI?

Generative AI models produce new content (text, images, code, audio) from patterns learned during training.

In this project:
- PDF RAG module — Groq generates grounded answers from retrieved PDF chunks
- Research Agent module — Groq generates key findings and a full markdown report from web evidence

### LLM vs "Chatbot"
- **LLM:** a model that predicts next tokens — stateless, no memory, no tools by itself
- **Chatbot app:** a system that wraps an LLM with memory, retrieval, tools, safety rules, and a UI

### Multi-modal GenAI
Multi-modal models accept more than text — images, audio, video, PDFs with layout.

Why it matters for document systems:
- Scanned PDFs are images, not text — a text-only pipeline fails completely
- Charts, diagrams, and screenshots carry meaning that text extraction misses
- A multi-modal pipeline combines OCR, image understanding, and text retrieval so the LLM can reason over both layout and language
- Models like GPT-4o and Claude 3.5 Sonnet accept images directly in the prompt — you can send a base64-encoded image alongside a text question

How multi-modal input works:
```json
{
  "role": "user",
  "content": [
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } },
    { "type": "text", "text": "What does this chart show?" }
  ]
}
```

This project handles text-based PDFs only. Scanned PDFs would need OCR preprocessing first.

### Types of LLM tasks

| Task | Description |
|---|---|
| Completion | Continue a prompt — code autocomplete |
| Chat | Multi-turn conversation with memory |
| Summarization | Condense long text into key points |
| Extraction | Pull structured data from unstructured text |
| Classification | Label text — sentiment, topic, intent |
| RAG Q&A | Answer grounded in retrieved documents — this project |
| Code generation | Write, explain, or fix code |
| Reasoning | Multi-step problem solving with chain-of-thought |

---

## 3. Fine-tuning vs RAG vs Prompt Engineering

One of the most important distinctions in GenAI system design.

### Prompt Engineering
Craft the input to get better output — no model changes, no new data.

- Zero cost, instant to iterate
- Limited by what the base model already knows
- Best for: formatting, tone, task framing, few-shot examples

### RAG (Retrieval-Augmented Generation)
Retrieve relevant documents at query time and inject them into the prompt.

- No model training required
- Knowledge is always up-to-date — update the vector DB, not the model
- Answers are traceable to source documents
- Best for: document Q&A, knowledge bases, research assistants
- **What this project does**

### Fine-tuning
Train the model further on your domain-specific data to change its weights.

- Expensive — GPU time, data preparation, evaluation
- Knowledge is baked in — can't update without retraining
- Best for: consistent style/tone, domain-specific vocabulary, task specialization
- **Does NOT reliably add new factual knowledge** — use RAG for facts, fine-tuning for behavior

**Common mistake:** fine-tuning to add knowledge. Fine-tuning teaches style and format, not facts. Use RAG for facts.

### Comparison table

| Approach | What changes | Best for | Tradeoff |
|---|---|---|---|
| Prompt engineering | The prompt only | Fast iteration, simple behavior changes | Limited by context window and model knowledge |
| RAG | The context given to the model | Fresh, private, or document-specific knowledge | Retrieval quality becomes the bottleneck |
| Fine-tuning | The model weights | Style, format, domain behavior, repeated tasks | Expensive, slow to update, not for fast-changing facts |
| RAG + Fine-tuning | Both | High-quality domain assistant | Most expensive but most powerful |

---

## 4. What is RAG?

**RAG (Retrieval-Augmented Generation)** = Retrieval + Generation.

- Retrieval fetches relevant text chunks from a knowledge source
- Generation uses an LLM to answer using those retrieved chunks

Why RAG?
- Keeps answers grounded in your documents
- Reduces hallucinations
- Works without retraining the model
- Knowledge is updatable — change the vector DB, not the model

### Standard RAG pipeline

```
Ingestion (offline):
  raw document → extract text → clean → chunk → embed → store in vector DB

Query time (online):
  user question → embed question → vector search → retrieve top-K chunks
  → build context prompt → LLM generates answer → return answer + sources
```

### Naive RAG vs Advanced RAG

**Naive RAG:** embed → retrieve → generate. Simple, works for many cases.

**Advanced RAG** adds:
- **Query rewriting** — rephrase the question before embedding to improve retrieval
- **HyDE (Hypothetical Document Embeddings)** — generate a fake answer, embed it, use that for retrieval
- **Reranking** — retrieve topN, rerank with cross-encoder, pass topK to LLM
- **Multi-query retrieval** — generate multiple query variants, merge and deduplicate results
- **Self-RAG** — model decides when to retrieve and verifies its own output

### Web Search as a RAG Variant
Instead of a private vector DB, retrieve from the live web. **This is exactly what the Research Agent in this project does.**

Flow:
1. User question → Tavily search API → returns top URLs + snippets
2. Each URL is fetched and content extracted (Jina Reader, Cheerio fallback)
3. Extracted content is injected into the Groq prompt as evidence
4. Groq generates key findings and a structured markdown report

Tradeoffs vs vector DB RAG:

| Dimension | Vector DB RAG | Web Search RAG |
|---|---|---|
| Freshness | Only as fresh as last ingestion | Always live |
| Source control | Full control over what's indexed | Web is noisy and uncontrolled |
| Latency | Fast (vector search ms) | Slower (HTTP fetches per source) |
| Ingestion pipeline | Required | Not needed |
| Semantic search | Yes (embedding similarity) | No (relies on search engine ranking) |

---

## 5. Embeddings

Vector representations of text — similar meanings map to nearby vectors in high-dimensional space.

### How they work
1. Text is passed through an encoder model (BERT-based, not generative)
2. The model outputs a fixed-size vector (e.g. 384 dimensions)
3. Vectors are compared using cosine similarity or dot product

### Cosine similarity
```
similarity = (A · B) / (|A| × |B|)
```
- Range: 0 to 1 for normalized vectors
- 1.0 = identical meaning, 0.0 = unrelated

### This project
- Model: `BAAI/bge-small-en-v1.5` (384-dim) via HuggingFace Inference API
- Encoder-based — optimized for similarity, not generation
- Input limit: 512 tokens → chunks capped at 500 chars (~375 tokens)

### Pooling and normalization
- **Mean pooling:** average all token vectors → sentence vector
- **CLS pooling:** use the [CLS] token vector
- **L2 normalization:** scale to unit length — makes cosine similarity equal to dot product (faster)

---

## 6. Vector DB and Indexing

Vector DBs store embeddings and provide fast approximate nearest-neighbor (ANN) search.

### Why ANN instead of exact search
Exact nearest-neighbor is O(n) — too slow at scale. ANN trades a small accuracy loss for massive speed gains.

### ANN algorithms

| Algorithm | Description |
|---|---|
| HNSW | Graph-based, fast queries, high memory — default in most managed DBs |
| IVF | Clusters vectors, searches only relevant clusters — lower memory |
| IVF+PQ | IVF with Product Quantization — compresses vectors, lowest memory |
| Flat | Exact search — only for small datasets |

### This project
- **Pinecone** (managed, serverless)
- Per-document namespaces: `pdf-<sanitized-name>` — isolates each document
- Deterministic IDs: `<documentId>-chunk-<index>-<hash>` — safe idempotent re-upserts

### What gets stored per vector
```
id:     deterministic string
values: number[]  (384-dim embedding)
metadata: {
  filename, documentId, chunkIndex, page,
  chunkHash, chunkLength, createdAt, text
}
```

---

## 7. Search Types

### Lexical (BM25)
- Exact keyword matching with term frequency weighting
- Fast, no embeddings needed
- Fails on synonyms and paraphrases
- Good for: exact product names, codes, IDs

### Semantic (vector)
- Meaning-based — finds conceptually similar content even with different words
- Requires embeddings
- Can miss exact keyword matches
- **What the PDF RAG module uses**

### Web Search RAG
- Search the live web via Tavily, Bing, or Google
- Extract full page content from returned URLs
- Feed extracted content as evidence to the LLM
- **What the Research Agent uses**

### Hybrid
- Combine vector + keyword scores (e.g. RRF — Reciprocal Rank Fusion)
- Best of both worlds — often best in production
- Pinecone, Weaviate, and Elasticsearch all support hybrid search

### Reranking
- Stage 1: retrieve topN cheaply with ANN (e.g. top 20)
- Stage 2: rerank with a cross-encoder or LLM for final topK (e.g. top 4)
- Cross-encoders score query+document jointly — much more accurate than bi-encoders
- Adds latency but significantly improves precision

---

## 8. Document Preprocessing

What happens before chunking matters as much as chunking itself.

### Text extraction
- **pdf-parse** (this project): works for text-based PDFs, uses `pagerender` hook for page-aware extraction
- **PyMuPDF / pdfplumber**: better layout preservation, handles columns
- **OCR (Tesseract, AWS Textract, Google Document AI)**: required for scanned/image PDFs — this project does NOT handle scanned PDFs

### Cleaning (this project's `textCleaning.service.ts`)
- Remove repeated headers/footers common in PDFs
- Normalize whitespace and encoding quirks
- Deduplicate repeated lines
- Why: noisy text produces noisy embeddings → bad retrieval

### Table extraction
- Raw text extraction collapses table rows into unreadable prose
- Tools like camelot or tabula preserve row/column structure
- Tables often need to be converted to markdown or JSON before chunking
- If a table is split across a chunk boundary, neither chunk is meaningful in isolation

### Image handling
- Charts, diagrams, and screenshots carry meaning that text extraction misses entirely
- Options: image captioning models, vision LLMs (GPT-4o, Claude), or skip images
- Multi-modal pipelines pass images directly to the LLM alongside text
- In a text-only pipeline, images silently disappear — this is a frequent source of incomplete answers

### Why preprocessing quality matters
Bad extraction → bad chunks → bad embeddings → bad retrieval → bad answers. Every stage amplifies upstream errors.

---

## 9. Chunking

Chunking directly affects embedding quality and retrieval recall. Wrong chunk size is one of the most common RAG failure causes.

### Why chunking matters
- Embedding models have input token limits (512 for this project's model)
- Embeddings work best on focused, coherent units of meaning
- Too large: mixed topics dilute the embedding, retrieval is imprecise
- Too small: missing context, answers are incomplete

### Chunking types

| Type | Description | When to use |
|---|---|---|
| Fixed-size | Split every N chars/tokens | Simple baseline |
| Fixed-size with overlap | Same + shared chars at boundaries | Prevents context loss at splits |
| Semantic/recursive | Split on paragraph → sentence → line → space → hard break | PDFs, prose — this project |
| Structure-aware | Use headings, sections, tables | Well-structured docs (HTML, Markdown) |
| Page-aware | Track page number per chunk | PDFs — enables citations |
| Sentence-window | Store sentence, retrieve surrounding window | Better context for short sentences |
| Parent-document | Store small chunks, retrieve parent document | Precision retrieval + full context |

This project: **semantic/recursive + page-aware**, 500 chars (~375 tokens), 100 chars overlap (~12%).

### Overlap
Overlap preserves context across chunk boundaries. If a sentence spans two chunks, overlap ensures both chunks contain enough context to be meaningful.

---

## 10. Prompt Wiring and Modes

### Anatomy of a prompt
```
System message:  permanent rules, persona, constraints
                 "Answer only from the provided context. Cite page numbers."

User message:    task + context block
                 "[1] Page 3\n<chunk text>\n\n[2] Page 7\n<chunk text>\n\nQuestion: ..."
```

### Modes in this project

| Mode | Behaviour |
|---|---|
| `document` | Answer only from retrieved PDF chunks — grounded |
| `general` | Answer from model's general knowledge — no retrieval |

Why split? A resume may mention "React" without explaining it. Document mode says "mentioned but not described." General mode can teach React.

### Good wiring principles
- Keep system rules stable and small
- Format context consistently — numbered blocks with page metadata
- Never send raw similarity scores to the LLM
- Limit context size — too much context reduces answer quality
- Request citations when page metadata is available

---

## 11. Streaming

Streaming means sending tokens to the UI as they are generated instead of waiting for the full response.

### Why it matters
- Improves perceived latency — the user sees output immediately
- Especially useful for long answers or expensive model calls
- Without streaming, a 10-second response feels broken; with streaming, the first token arrives in <1 second

### How it works
Most LLM APIs support streaming via **SSE (Server-Sent Events)** or chunked HTTP transfer encoding.

```
Client          Server              LLM API
  |                |                   |
  |---POST /ask--->|                   |
  |                |---stream request->|
  |                |<--token 1---------|
  |<--data: tok1---|                   |
  |                |<--token 2---------|
  |<--data: tok2---|                   |
  |                |<--[DONE]----------|
  |<--data: [DONE]-|                   |
```

### Implementing streaming in this project
Currently NOT implemented — the full response is returned at once. To add it:

**Backend (Express SSE):**
```ts
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
const stream = await groq.chat.completions.create({ stream: true, ... });
for await (const chunk of stream) {
  const token = chunk.choices[0]?.delta?.content || '';
  res.write(`data: ${JSON.stringify({ token })}\n\n`);
}
res.write('data: [DONE]\n\n');
res.end();
```

**Frontend (React):**
```ts
const es = new EventSource('/api/ask-question-stream');
es.onmessage = (e) => {
  if (e.data === '[DONE]') { es.close(); return; }
  const { token } = JSON.parse(e.data);
  setAnswer(prev => prev + token);
};
```

In LangChain: `.stream()` for sync, `.astream()` for async — both yield partial chunks and can be piped directly to an SSE response.

---

## 12. Conversation Memory and Chat History

Conversation memory stores prior turns so the next response can use them.

### Why it matters
Without memory, every question is answered in isolation. The model cannot answer "what did you just say?" or "expand on that."

### Memory patterns

| Pattern | How it works | When to use |
|---|---|---|
| Raw chat history | Append every message to the prompt | Short conversations, exact history matters |
| Conversation summary | Compress old turns into a running summary | Long conversations, context window is tight |
| Selective memory | Keep only relevant past turns | When most history is irrelevant |
| Vector memory | Embed past turns, retrieve relevant ones | Very long sessions, semantic recall needed |

### In this project
The PDF RAG chat (`useChat` hook) keeps messages in React state — client-side only, no server memory. Each `ask-question` call is stateless on the backend. Adding server-side memory would require:
1. Passing chat history in the request body
2. Including it in the Groq prompt as alternating `user`/`assistant` messages
3. Optionally compressing it if it grows too large

### Token cost of memory
Every message in history consumes tokens. A 10-turn conversation can easily use 2,000–5,000 tokens before the question is even asked. Always budget for this.

### Memory with LangChain
- `ConversationBufferMemory` — keeps raw message history, grows unboundedly
- `ConversationSummaryMemory` — compresses old turns into a running summary using the LLM itself
- `RunnableWithMessageHistory` — wraps any runnable and automatically injects/updates history on each turn (modern LCEL pattern)

---

## 13. Structured Output and Function Calling

### Structured output
Ask the model to return a schema (JSON, typed object) instead of free-form prose.

Why:
- Reliable machine-readable fields for UI rendering
- Avoids parsing free text with regex
- Consistent format across calls

How:
```ts
// Option 1: prompt-based (works with any model)
systemPrompt: "Return only a JSON object with keys: summary, sources, confidence"

// Option 2: OpenAI-compatible API
{ response_format: { type: "json_object" } }

// Option 3: LangChain
model.withStructuredOutput(zodSchema)
```

### Function calling / tool use
The model emits a structured request to call a function instead of answering directly.

Flow:
```
User: "What is the weather in London?"
Model: { tool: "get_weather", args: { city: "London" } }
App:   calls get_weather("London") → "15°C, cloudy"
Model: "The weather in London is 15°C and cloudy."
```

Why it matters:
- The model can request real-time data it doesn't have
- The model can trigger actions (write to DB, send email, run search)
- This is the foundation of agentic systems

**In this project:** the Research Agent uses Tavily search as a tool, but it is called manually in the workflow — the LLM does not choose to call it. A true tool-calling pattern would let the LLM decide when and whether to search.

### Tool definition example
```ts
const tools = [{
  type: "function",
  function: {
    name: "search_web",
    description: "Search the web for current information",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" }
      },
      required: ["query"]
    }
  }
}];
```

---

## 14. Hallucination and Grounding

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

## 15. Similarity Scores

Useful for:
- Filtering very low relevance results
- Debugging retrieval quality
- Evaluation and tuning

**Not** useful in the LLM prompt — it can distract the model and cause it to over-trust a numeric score. This project returns scores to the client UI for debugging but strips them before building the Groq context.

---

## 16. RAG Failure Modes

| Failure | Cause | Mitigation |
|---|---|---|
| Bad extraction | Noisy PDF text, scanned pages | Improve cleaning, add OCR |
| Bad chunking | Chunks too big (mixed topics) or too small (missing context) | Tune chunk size/overlap, use semantic splitting |
| Empty retrieval | topK too low or over-filtering | Increase topK, relax filters, add fallback |
| Hallucination | Weak context, open-ended prompt | Require provenance, conservative system prompt |
| No citations | Missing page metadata | Store page number per chunk — this project does this |
| Context overflow | Too many chunks exceed context window | Cap chunks, summarize, or use reranking |

---

## 17. GenAI vs Agentic AI

### GenAI (what the PDF RAG module is)
- Single-call generation: prompt → completion
- Retrieves chunks, calls LLM, returns answer
- Does not autonomously loop, plan, or use multiple tools

### Agentic AI (what the Research Agent approximates)
- Multi-step reasoning + tool use
- Has goals, plans, and actions
- This project's research agent: search → extract → summarize → report
- It is a **fixed pipeline**, not a true agent — the LLM does not choose which tool to call next

### True agent loop
```
User goal
  → LLM decides: which tool to call?
  → Tool runs, result returned to LLM
  → LLM decides: done or call another tool?
  → repeat until goal is satisfied
  → LLM generates final answer
```

### How the research agent could become truly agentic
- Let the LLM decide whether to re-search with a refined query
- Let the LLM choose between multiple tools (search, PDF lookup, calculator)
- Add a verification step where the LLM checks its own answer against evidence

---

## 18. Evaluation

### Retrieval metrics
- **Recall@K** — fraction of queries where at least one relevant chunk appears in topK
- **Precision@K** — fraction of retrieved items in topK that are relevant
- **MRR (Mean Reciprocal Rank)** — average of reciprocal ranks of first relevant item
- **nDCG** — normalized discounted cumulative gain for graded relevance

### Answer quality metrics

| Metric | What it measures |
|---|---|
| Faithfulness | Is the answer supported by the retrieved evidence? |
| Answer relevance | Does the answer actually address the question? |
| Context precision | Are the retrieved chunks relevant to the question? |
| Context recall | Did retrieval find all the chunks needed to answer? |
| ROUGE / BLEU | N-gram overlap with a reference answer |

**Faithfulness vs relevance distinction:**
- A **faithful** answer stays within the evidence but may not answer the question well
- A **relevant** answer addresses the question but may hallucinate if not grounded
- You need both — relevant AND faithful
- Example: "The document mentions a budget" is faithful but irrelevant if the question asks about timelines

### RAGAS
RAGAS is a framework for evaluating RAG pipelines end-to-end. It automatically scores:
- **Faithfulness** — does the answer contradict the retrieved context?
- **Answer relevance** — does the answer address the question?
- **Context precision** — are retrieved chunks actually useful?
- **Context recall** — did retrieval miss important chunks?

How to use RAGAS:
1. Create 20–50 gold Q&A pairs (question + expected answer + relevant source)
2. Run your RAG pipeline on each question
3. Feed (question, answer, retrieved context, ground truth) into RAGAS
4. Get scores → iterate on chunking, retrieval, or prompting

Practical approach: create 20–50 gold Q&A pairs, run RAGAS, iterate on chunking/retrieval/prompting.

---

## 19. Prompt Engineering

- **System vs user messages:** keep system messages short and rule-like; use user message for the task and context
- **Few-shot examples:** include 1–3 in-context examples for formatting-sensitive tasks
- **Temperature:** 0.0–0.3 for deterministic factual answers; higher for creative outputs
- **Output constraints:** ask for JSON or bullet lists when you need structured output
- **Safety instructions:** include explicit rules in system prompt (no unsupported claims, cite sources)
- **Chain-of-thought:** ask the model to reason step by step before answering — improves accuracy on complex questions

---

## 20. Common Prompt Types

| Type | Use case |
|---|---|
| Instruction / Directive | Summarize, translate, refactor |
| Zero-shot | Quick Q&A when task is obvious |
| Few-shot | Formatting-sensitive tasks, pattern following |
| Chain-of-thought | Complex reasoning, debugging |
| Retrieval-augmented | Document-grounded Q&A — this project |
| Template / Fill-in | Extract structured data into JSON |
| Summarization | Executive summaries of long reports |
| Classification / Extraction | Label document type, extract named entities |

---

## 21. Operational Concerns

- **Batching:** batch embedding requests to amortize latency (implemented in `batchEmbedding.service.ts`)
- **Rate limits:** implement retries with exponential backoff for 429s
- **Idempotency:** deterministic vector IDs allow safe re-upserts without duplicates
- **Background processing:** long-running tasks (large PDFs) should be enqueued (e.g., BullMQ/Redis)
- **Monitoring:** capture embedding latency, upsert counts, query latency, retrieval recall
- **Token budgets:** count input tokens before prompting so retrieval and answer space stay within the context window

---

## 22. Advanced RAG Patterns

- **Fusion-in-Decoder (FiD):** send many retrieved passages to the decoder and let the model fuse them internally
- **Query rewriting:** rephrase the question before embedding to improve retrieval
- **HyDE:** generate a hypothetical answer, embed it, use that for retrieval
- **Memory + RAG:** combine long-term memory (vector DB) with short-term context (conversation history)
- **Reranking:** retrieve topN cheaply, then rerank with a cross-encoder for final topK
- **Self-RAG:** model decides when to retrieve and verifies its own output

---

## 23. Glossary

| Term | Definition |
|---|---|
| Token | Smallest unit of text an LLM processes (~3–4 chars) |
| Context window | Max tokens the model can see at once (input + output) |
| Temperature | Controls randomness in token sampling |
| Top-p | Nucleus sampling — sample from top cumulative probability mass |
| Top-k | Sample from top K most probable tokens |
| Autoregressive | Generating one token at a time, conditioned on all previous tokens |
| Self-attention | Mechanism where each token attends to all others to build meaning |
| Lost-in-the-middle | LLMs recall info at prompt edges better than buried in the middle |
| Embedding | Vector representation of text |
| ANN | Approximate nearest-neighbor search |
| HNSW | Hierarchical Navigable Small World — ANN index algorithm |
| PQ | Product Quantization — vector compression |
| topK | Number of retrieved matches |
| Recall@K | Fraction of queries with a relevant result in topK |
| MRR | Mean Reciprocal Rank |
| nDCG | Normalized Discounted Cumulative Gain |
| RAGAS | Framework for evaluating RAG pipelines end-to-end |
| Faithfulness | Answer is supported by retrieved evidence |
| Answer relevance | Answer addresses the question asked |
| Namespace | Pinecone isolation scope per document |
| Chunk overlap | Shared chars between adjacent chunks for continuity |
| Semantic chunking | Split on natural language boundaries |
| Grounded answer | Answer constrained to retrieved evidence |
| Hallucination | Confident but unsupported model output |
| Provenance | Traceable source for a claim (page number, URL) |
| Prompt wiring | How context and instructions are formatted and injected |
| Streaming | Sending tokens to the UI as they are generated |
| SSE | Server-Sent Events — HTTP pattern for streaming tokens to the browser |
| Function calling | Model emits a structured tool request instead of answering directly |
| Structured output | Model returns a schema (JSON) instead of free-form prose |
| Fine-tuning | Training the model further on domain-specific data |
| HyDE | Hypothetical Document Embeddings — embed a fake answer for retrieval |
| FiD | Fusion-in-Decoder — multi-passage aggregation pattern |
| Cross-encoder | Reranker that scores query-document pairs jointly |
| LCEL | LangChain Expression Language — pipe-based chain composition |
| Web search RAG | Retrieve from live web instead of a private vector DB |
| Multi-modal | Models that accept images, audio, or video alongside text |
| OCR | Optical Character Recognition — extract text from scanned images |

---

## 24. Common Interview Questions

- What problem does RAG solve that plain prompting does not?
- What is the difference between RAG, fine-tuning, and prompt engineering?
- Why does chunking affect retrieval quality so much?
- What is the difference between embeddings and vector search?
- Why do hallucinations happen, and how do you reduce them?
- What is the difference between faithfulness and answer relevance?
- What is RAGAS and what does it measure?
- Why should similarity scores stay out of the LLM prompt?
- When should you use document-grounded mode vs general mode?
- What metadata do you store with chunks, and why?
- What is the difference between GenAI, RAG, and agentic AI?
- What is function calling and how does it enable agentic behavior?
- What is streaming and why does it matter for UX? How would you implement it?
- How do you manage context window limits in a RAG system?
- What is the difference between a chain and an agent?
- When would you use LangChain vs building manually?
- What is the difference between top-p and top-k sampling?
- What is the transformer self-attention mechanism and why does it matter?
- What is multi-modal RAG and when do you need it?
- How does web search RAG differ from vector DB RAG?
- What is the lost-in-the-middle problem and how do you mitigate it?
- How do you handle conversation memory without blowing the context window?