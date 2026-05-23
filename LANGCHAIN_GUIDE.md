# LangChain Developer Guide

This guide explains what LangChain is, why it exists, when to use it, and how its main pieces fit together for a developer building RAG apps like this project.

This project uses LangChain in two places:
- **Research Agent** (`src/modules/research-agent/`) — uses `@langchain/groq` and `@langchain/core` for a two-prompt LCEL pipeline (summary → report)
- **LangChain demo** (`lanchain/langchain-rag-demo.ts`) — standalone reference implementation of the full PDF RAG pipeline using LangChain abstractions

The PDF RAG module (`src/modules/pdf-rag/`) is built manually without LangChain — intentionally, to understand every primitive.

---

## 1. What LangChain Is

LangChain is a framework for building LLM applications by composing reusable building blocks.

Instead of hand-wiring every step yourself, you can combine:

- document loaders
- text splitters
- embeddings
- vector stores
- retrievers
- prompts
- runnables
- output parsers
- tools
- agents
- graph-based workflows with LangGraph

The core idea is not to replace your application logic. It is to reduce glue code around common LLM tasks.

---

## 2. Why LangChain Exists

LangChain comes into the picture when LLM apps stop being a single prompt and become a pipeline.

Common reasons:

- You need to load data from files, APIs, databases, or websites.
- You need to split long content into manageable chunks.
- You need retrieval over documents or knowledge bases.
- You want reusable chains instead of custom orchestration code.
- You want agent-like behavior where an LLM can choose tools.
- You want better structure around prompts, outputs, retries, and tracing.

In short, it helps when your app has more than one step and those steps should be composable.

---

## 3. Where It Fits In This Project

The PDF RAG module already does the classic RAG pipeline manually:

1. load PDF (`pdf-parse`)
2. clean and split text (custom semantic chunker)
3. embed chunks (HuggingFace Inference API directly)
4. store vectors (Pinecone SDK directly)
5. retrieve top matches (Pinecone query directly)
6. build prompt (string formatting)
7. ask the LLM (Groq SDK directly)

The Research Agent uses LangChain LCEL for its two-prompt pipeline:

```ts
// summary
const summary = await summaryPrompt.pipe(model).pipe(parser).invoke({ query, evidence });

// report
const report = await reportPrompt.pipe(model).pipe(parser).invoke({ query, summary, evidence });
```

This is the right tradeoff: the research pipeline has no custom primitives to learn, so LangChain's composition reduces boilerplate without hiding anything important.

Manual version (PDF RAG):
- you control every function directly
- you see every implementation detail
- every failure is debuggable without digging through framework internals

LangChain version (Research Agent):
- you compose steps using framework abstractions
- you get standard interfaces for prompts, models, and parsers
- you trade some direct control for speed of development and reuse

---

## 4. When To Use It

Use LangChain when:

- you want to move faster on standard LLM patterns
- you are building RAG, agents, chat workflows, or multi-step pipelines
- you want integrations with common model, vector store, and tool providers
- you want cleaner composition than custom orchestration code
- you want to swap components without rewriting everything

Do not use it just because it is popular.

Skip it when:

- you want to deeply learn the primitives first
- the app is small enough to wire manually in a few files
- you need full control over every internal detail
- you want to minimize abstraction and framework dependency

---

## 5. Core Mental Model

Think of LangChain as a toolbox of parts that you connect into a pipeline.

Typical flow:

`Document Loader → Splitter → Embeddings → Vector Store → Retriever → Prompt → LLM → Parser`

That is exactly the same shape as your manual backend. The difference is that LangChain standardizes the shape.

---

## 6. Important Building Blocks

### Document Loaders

Load raw data into `Document` objects with `pageContent` + `metadata`.

```ts
const loader = new PDFLoader("./file.pdf");
const docs = await loader.load();
// docs[0].pageContent = "The text on page 1..."
// docs[0].metadata = { source: "./file.pdf", page: 0 }
```

Examples:
- `PDFLoader` — text-based PDFs (uses `pdf-parse` under the hood)
- `TextLoader` — plain text files
- `CheerioWebBaseLoader` — web pages
- `CSVLoader` — spreadsheets

The important interface idea is that loaders normalize many input sources into `Document` objects. Your pipeline does not care whether the source is a PDF, website, or CSV — it receives the same `Document` shape.

What it gives you:
- `pageContent` — the raw text
- `metadata` — source path, page numbers, or anything you add

### Text Splitters

Split long documents into chunks for retrieval and embedding.

```ts
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
  separators: ["\n\n", "\n", " ", ""]
});
const chunks = await splitter.splitDocuments(docs);
```

`RecursiveCharacterTextSplitter` tries to split on the biggest separator first (paragraph), then falls back to smaller ones (sentence, word, character). This matches how humans would split naturally — the same logic as this project's custom chunker.

Available splitters:
- `RecursiveCharacterTextSplitter` — best general-purpose, what most projects use
- `TokenTextSplitter` — splits on actual token count (uses tiktoken)
- `MarkdownTextSplitter` — splits on markdown headings
- `HTMLHeaderTextSplitter` — splits on HTML tags

Why they matter: embedding models have input limits; retrieval works better on focused chunks; chunk size and overlap are the two most impactful tuning levers.

### Embeddings

Convert text into vectors. In LangChain, embeddings are wrapped in a class so the rest of the pipeline does not care which provider generates them.

```ts
// HuggingFace (what this project uses manually)
const embeddings = new HuggingFaceInferenceEmbeddings({ model: "BAAI/bge-small-en-v1.5" });

// OpenAI
const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
```

Two methods:
- `embedQuery(text)` — embed a single string (used for queries)
- `embedDocuments(texts[])` — embed a batch (used for ingestion)

Useful concepts: model choice, vector dimension, batching, rate limits, L2 normalization.

### Vector Stores

Store and query vectors. LangChain wraps every major vector DB under the same interface.

```ts
// Build from documents
const store = await PineconeStore.fromDocuments(chunks, embeddings, { pineconeIndex });

// Query
const results = await store.similaritySearch("my question", 4);
```

The standard interface gives you:
- `similaritySearch(query, k)` — returns top K documents
- `similaritySearchWithScore(query, k)` — returns documents + cosine scores
- `asRetriever(k)` — returns a Retriever object

Supported stores: Pinecone, Chroma, FAISS, Weaviate, Milvus, Redis, Supabase.

### Retrievers

Retrievers are a standardized interface for fetching relevant documents. Instead of directly querying a vector DB everywhere, you ask the retriever for the top matches.

```ts
const retriever = store.asRetriever(4); // topK = 4
const docs = await retriever.invoke("my question");
```

**VectorStoreRetriever** — built directly on top of a vector store. This is the default.

**Custom retriever** — any retriever you write yourself when you need special filtering, hybrid logic, reranking, or domain-specific behavior:

```ts
class MyRetriever extends BaseRetriever {
  async _getRelevantDocuments(query: string) {
    // your custom logic here
    return docs;
  }
}
```

Common retriever patterns:
- Vector similarity retriever — default
- **MMR (Maximal Marginal Relevance)** — retrieves diverse results, avoids returning near-duplicate chunks
- **Multi-query retrieval** — generates multiple rephrased versions of the question, runs all queries, deduplicates results
- **Contextual compression retriever** — wraps another retriever and compresses each result to only the relevant parts

---

## 7. Prompts

Prompt templates are reusable prompt definitions with named variables.

```ts
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. Answer only from the context provided."],
  ["human", "Context:\n{context}\n\nQuestion: {question}"]
]);

// Use it in a chain
const chain = prompt.pipe(model).pipe(parser);
const result = await chain.invoke({ context: "...", question: "..." });
```

Benefits:
- no string concatenation scattered around your codebase
- clear variable injection
- easy to reuse across chains and test in isolation

**Hub / Prompt Hub:** LangChain Hub (`hub.pull("rlm/rag-prompt")`) lets you pull shared, versioned prompts instead of copying them into every project. Useful for standard patterns like RAG Q&A or summarization where the community has tuned good defaults.

---

## 8. LLM Wrappers

LangChain wraps model providers so they can be used in the same pipeline shape.

```ts
// Groq (what this project uses)
const model = new ChatGroq({ model: "llama-3.3-70b-versatile", temperature: 0.2 });

// OpenAI
const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

// Anthropic
const model = new ChatAnthropic({ model: "claude-3-5-sonnet-20241022" });
```

This lets you swap providers without rewriting the pipeline logic — only the model initialization line changes.

---

## 9. Output Parsers

Turn model output into a structured format.

```ts
// String parser — just returns the text
const parser = new StringOutputParser();

// JSON parser — parses the text as JSON
const parser = new JsonOutputParser();

// Structured output — enforces a Zod schema
const model_with_schema = model.withStructuredOutput(z.object({
  summary: z.string(),
  sources: z.array(z.string()),
  confidence: z.number()
}));
```

Useful when you want the model to return reliable machine-readable output for UI rendering, downstream logic, or database storage.

---

## 10. Runnables

Runnables are the most important LangChain concept. They are composable units that take input, do something, and return output — the universal pipeline block.

Why they matter:
- they unify prompts, models, parsers, retrievers under one interface
- they can be chained together with `.pipe()`
- they all support the same execution modes: `invoke`, `batch`, `stream`

### RunnablePassthrough
Forwards the input unchanged. Used when one branch needs the original input alongside derived values.

```ts
const chain = RunnablePassthrough.assign({
  context: retriever,    // retriever gets the question
  question: new RunnablePassthrough() // original question passes through
}).pipe(prompt).pipe(model).pipe(parser);

// Input: "What is RAG?"
// context = retrieved docs from "What is RAG?"
// question = "What is RAG?"
```

### RunnableParallel
Fans out the same input to multiple branches and returns their outputs together.

```ts
const parallel = RunnableParallel.from({
  context: retriever,
  question: new RunnablePassthrough()
});
// Input: "What is RAG?"
// Output: { context: [doc1, doc2], question: "What is RAG?" }
```

`RunnablePassthrough.assign({})` is syntactic sugar that does the same thing — adds new keys to the existing object without dropping old ones.

### RunnableLambda
Wraps a plain function so it can participate in an LCEL pipeline.

```ts
const formatDocs = new RunnableLambda({
  func: (docs: Document[]) => docs.map(d => d.pageContent).join("\n\n")
});

const chain = retriever.pipe(formatDocs).pipe(prompt).pipe(model).pipe(parser);
```

### Execution modes
All runnables support three execution modes:

| Mode | Use case | Example |
|---|---|---|
| `invoke(input)` | One input, one output — most common | `chain.invoke({ question: "..." })` |
| `batch(inputs[])` | Many inputs, processed efficiently | `chain.batch([{ question: "..." }, ...])` |
| `stream(input)` | One input, partial output streamed incrementally | `for await (const chunk of chain.stream(...))` |
| `astream(input)` | Async version of stream | same as stream, for async generators |

### Full RAG chain with runnables
```ts
const ragChain = RunnablePassthrough.assign({
  context: retriever.pipe(formatDocs)
})
.pipe(prompt)
.pipe(model)
.pipe(new StringOutputParser());

const answer = await ragChain.invoke({ question: "What is RAG?" });
```

---

## 11. LCEL (LangChain Expression Language)

LCEL is the pipe-based composition style for building LangChain chains.

```ts
// Each | or .pipe() connects one runnable's output to the next's input
const chain = prompt | model | parser;
// or equivalently:
const chain = prompt.pipe(model).pipe(parser);
```

Benefits:
- no callback nesting
- pipelines read left-to-right like data flow
- easy to swap one step without touching the rest
- streaming works automatically across the whole chain

LCEL chains are just runnables themselves — so you can nest chains inside other chains.

---

## 12. Chains

A chain is a sequence of operations that together implement a task.

In older LangChain: `LLMChain`, `RetrievalQAChain`, `ConversationalRetrievalChain` — pre-built classes.
In modern LangChain: runnables and LCEL compose everything — chains are just named compositions.

You may still encounter the old-style chains in codebases and tutorials:

```ts
// Old style (deprecated)
const chain = new RetrievalQAChain({ llm: model, retriever });
const answer = await chain.call({ query: "What is RAG?" });

// Modern LCEL equivalent (preferred)
const chain = RunnablePassthrough.assign({ context: retriever.pipe(formatDocs) })
  .pipe(prompt).pipe(model).pipe(parser);
```

Know both styles. New code should use LCEL.

---

## 13. Streaming with LCEL

LCEL chains support streaming out of the box — every `.pipe()` step passes partial output through as it arrives.

```ts
// Backend: stream to SSE
const stream = await chain.stream({ question: userQuestion });
res.setHeader('Content-Type', 'text/event-stream');
for await (const chunk of stream) {
  res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
}
res.end();

// Frontend: consume SSE
const es = new EventSource('/api/ask-stream');
es.onmessage = (e) => {
  const { token } = JSON.parse(e.data);
  setAnswer(prev => prev + token);
};
```

`.stream()` — sync generator, yields partial string chunks
`.astream()` — async generator, same but for async contexts
`.streamLog()` — streams intermediate steps (retrieval results, prompt, etc.) for debugging

---

## 14. Structured Output and Tool Binding

### withStructuredOutput
Forces the model to return a typed schema instead of free text.

```ts
const schema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"])
});

const structuredModel = model.withStructuredOutput(schema);
const result = await structuredModel.invoke("What is RAG?");
// result.answer = "RAG stands for..."
// result.sources = ["page 3", "page 7"]
// result.confidence = "high"
```

Under the hood this uses function calling / tool use — the model is given a schema as a tool and forced to call it.

### bind_tools
Gives the model a set of tools it can choose to call.

```ts
const tools = [tavilySearchTool, calculatorTool];
const modelWithTools = model.bindTools(tools);

const response = await modelWithTools.invoke("Search for recent AI news");
// response.tool_calls = [{ name: "tavily_search", args: { query: "recent AI news" } }]
```

The difference:
- `withStructuredOutput` — model MUST return the schema
- `bindTools` — model MAY call any tool or answer directly (agent pattern)

---

## 15. Tools

Tools are callable capabilities that an agent can choose from.

```ts
import { tool } from "@langchain/core/tools";

const searchTool = tool(
  async ({ query }) => {
    const results = await tavilyClient.search(query);
    return results.map(r => r.content).join("\n");
  },
  {
    name: "search_web",
    description: "Search the web for current information",
    schema: z.object({ query: z.string() })
  }
);
```

Important distinction:
- A **retriever** returns documents from a known knowledge source
- A **tool** can do almost anything callable — search, write to a DB, send an email, call an API

Tool calling is the same mental model as function calling: the model emits a tool request, your app runs the function, and the result goes back into the chain.

**In this project:** Tavily search is called manually in the research pipeline — the LLM does not choose to call it. Wrapping Tavily as a `tool` and binding it to the model with `bindTools` would make the pipeline truly agentic.

---

## 16. Agents

Agents use the model to decide which tool to call next. This is different from a fixed chain.

**Chain:** you know the exact order of steps in advance.
**Agent:** the model chooses the next action dynamically.

```
Chain:  question → retrieve → prompt → LLM → answer  (always same path)
Agent:  question → LLM → maybe search → LLM → maybe calculate → LLM → answer
```

Common agent pattern in LangChain:
```ts
const agent = createReactAgent({ llm: model, tools: [searchTool, calculatorTool] });
const result = await agent.invoke({ messages: [{ role: "user", content: "..." }] });
```

Use agents when:
- the task is open-ended
- you need tool selection
- you want multi-step reasoning with actions

Avoid agents when:
- the flow is simple and deterministic
- you need predictable behavior
- you can solve it with a straight chain or retriever

---

## 17. Memory

Memory persists state across turns so the model can refer back to earlier parts of the conversation.

### ConversationBufferMemory
Keeps the full raw message history. Simple, grows without bound.

```ts
const memory = new ConversationBufferMemory({ returnMessages: true });
await memory.saveContext({ input: "Hello" }, { output: "Hi! How can I help?" });
const history = await memory.loadMemoryVariables({});
// history.history = [HumanMessage("Hello"), AIMessage("Hi!...")]
```

Use when: conversation is short and exact history matters.

### ConversationSummaryMemory
Compresses old turns into a running summary using the LLM itself. The full message history never hits the prompt.

```ts
const memory = new ConversationSummaryMemory({ llm: model });
```

Use when: conversation is long and the context window is tight.

### RunnableWithMessageHistory
The modern LCEL-compatible pattern. Wraps any runnable and automatically injects/updates the chat history on each turn.

```ts
const chain = prompt.pipe(model).pipe(parser);

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: (sessionId) => getChatHistoryForSession(sessionId),
  inputMessagesKey: "question",
  historyMessagesKey: "history"
});

// Each call automatically reads and updates history for the session
await chainWithHistory.invoke(
  { question: "What did you just say?" },
  { configurable: { sessionId: "user-123" } }
);
```

Rule of thumb:
- Use `BufferMemory` when the conversation is short and exact history matters
- Use `SummaryMemory` when the conversation is long and the context window is tight
- Use `RunnableWithMessageHistory` for all new LCEL-based code

---

## 18. LangGraph

LangGraph is for stateful, graph-based LLM workflows. It is the right tool when a linear chain is not enough.

### Core mental model: nodes, edges, and state

```
State (shared object)
    ↓
[Node A] → reads state, does work, writes to state
    ↓
[Edge: conditional?]
    ↙         ↘
[Node B]    [Node C]
    ↓
[END]
```

**State** — a typed object (TypedDict in Python, interface in TypeScript) that flows through every node. All nodes read from it and write to it.

**Nodes** — plain functions that receive the current state and return a partial state update.
```ts
function retrieveNode(state: GraphState): Partial<GraphState> {
  const docs = retriever.invoke(state.question);
  return { context: docs };
}
```

**Edges** — connections between nodes. Can be:
- Fixed: always go from A to B
- Conditional: go to B or C depending on state

```ts
graph.addConditionalEdges("check_relevance", (state) => {
  return state.isRelevant ? "generate" : "rewrite_query";
});
```

**StateGraph pattern:**
```ts
const graph = new StateGraph<GraphState>({ channels: stateSchema })
  .addNode("retrieve", retrieveNode)
  .addNode("generate", generateNode)
  .addNode("rewrite", rewriteNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addConditionalEdges("generate", checkHallucination, {
    hallucinated: "rewrite",
    grounded: END
  });

const app = graph.compile();
const result = await app.invoke({ question: "What is RAG?" });
```

### When to use LangGraph
- Loops — retry until the answer is grounded
- Conditional branching — different tool for different query types
- Human-in-the-loop approval — pause the graph, wait for user input, resume
- Multi-agent coordination — one graph orchestrates specialized sub-agents
- Durable state — checkpoint state so long-running workflows survive crashes

### LangChain vs LangGraph

| | LangChain | LangGraph |
|---|---|---|
| Best for | Composing pipeline parts | Stateful workflows with branching and loops |
| Shape | Linear pipe (A → B → C) | Arbitrary graph with cycles |
| State | Passed implicitly through pipe | Explicit shared state object |
| Branching | Not native | First-class with conditional edges |
| Loops | Not native | First-class (just add a cycle in the graph) |
| Memory | Via memory classes | Via built-in checkpointer |

Simple rule:
- Use LangChain for the parts (loaders, splitters, embeddings, prompts, models, parsers)
- Use LangGraph for the workflow when you need branching, loops, or durable state

---

## 19. Callbacks and Tracing

Callbacks let you observe what the pipeline is doing at every step.

```ts
import { ConsoleCallbackHandler } from "langchain/callbacks";

const result = await chain.invoke(
  { question: "..." },
  { callbacks: [new ConsoleCallbackHandler()] }
);
// Prints: prompt sent, tokens used, response received
```

### LangSmith (production tracing)
LangSmith is LangChain's observability platform. Set two env vars and every chain call is automatically traced:

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls_...
```

What LangSmith gives you:
- Full run trace: inputs, outputs, timing for every step
- Nested view: see retriever → prompt → LLM → parser as a tree
- Token usage per step
- Error details with full stack context
- Run comparison for A/B testing chains

Why it matters in practice: when retrieval returns wrong chunks or the LLM gives a bad answer, you can't debug from logs alone. LangSmith shows you exactly what went into each step. It turns "why did this fail?" from a guessing game into a 30-second inspection.

---

## 20. Practical: invoke vs batch vs stream

All runnables expose the same three execution modes. Choosing the right one affects throughput and UX.

| Mode | Input | Output | Use when |
|---|---|---|---|
| `invoke(input)` | Single item | Single result | One question, one answer — most common |
| `batch(inputs[])` | Array of items | Array of results | Embedding 100 chunks, processing many documents |
| `stream(input)` | Single item | Incremental chunks | Chat UI — show tokens as they arrive |

```ts
// invoke
const answer = await chain.invoke({ question: "What is RAG?" });

// batch (processes in parallel with concurrency control)
const answers = await chain.batch([
  { question: "What is RAG?" },
  { question: "What is LangChain?" },
  { question: "What is fine-tuning?" }
], { maxConcurrency: 3 });

// stream
for await (const chunk of chain.stream({ question: "Explain RAG in detail" })) {
  process.stdout.write(chunk);
}
```

---

## 21. Structured Output Pattern (Full Example)

```ts
import { z } from "zod";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const schema = z.object({
  keyFindings: z.array(z.string()).describe("3-5 key findings"),
  sources: z.array(z.string()).describe("Source URLs used"),
  confidence: z.enum(["high", "medium", "low"])
});

const model = new ChatGroq({ model: "llama-3.3-70b-versatile" });
const structuredModel = model.withStructuredOutput(schema);

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Extract key findings from the evidence provided."],
  ["human", "Evidence:\n{evidence}\n\nQuestion: {question}"]
]);

const chain = prompt.pipe(structuredModel);
const result = await chain.invoke({ evidence: "...", question: "..." });
// result.keyFindings = ["Finding 1", "Finding 2", ...]
// result.sources = ["https://..."]
// result.confidence = "high"
```

---

## 22. How This Maps To This Project

The PDF RAG module implements the key RAG primitives manually:

| Primitive | Implementation |
|---|---|
| Loader | `pdf-parse` with `pagerender` hook |
| Splitter | Custom semantic-recursive chunker |
| Embeddings | HuggingFace Inference API directly |
| Vector DB | Pinecone SDK directly |
| Retriever | Pinecone query directly |
| Generation | Groq SDK directly |
| Orchestration | Express controllers + services |

The Research Agent uses LangChain for the parts where it adds value without hiding important primitives:

| Primitive | Implementation |
|---|---|
| LLM | `ChatGroq` from `@langchain/groq` |
| Prompts | `ChatPromptTemplate` from `@langchain/core` |
| Parser | `StringOutputParser` from `@langchain/core` |
| Pipeline | LCEL pipe: `prompt.pipe(model).pipe(parser)` |

Search and extraction (Tavily, Jina, Cheerio) are still wired manually because they are custom tools with no LangChain equivalent worth using.

---

## 23. Practical Developer Guidance

If you are learning:
1. Build the manual version first
2. Understand every function and data shape
3. Identify repeated patterns
4. Convert the repeated patterns into LangChain blocks
5. Keep the workflow deterministic until you need agents

If you are shipping a product:
1. Use LangChain where it reduces duplicated glue code
2. Keep custom code where your logic is unique
3. Do not force everything into the framework
4. Use LangGraph only when your workflow needs branching or state

---

## 24. Key Terms To Remember

| Term | Definition |
|---|---|
| Document | A chunk of content plus metadata |
| Loader | Turns source data into Document objects |
| Splitter | Breaks documents into smaller parts for embedding |
| Embedding | Vector representation of text |
| Vector store | Database for similarity search |
| Retriever | Interface for fetching relevant documents |
| VectorStoreRetriever | A retriever backed by a vector store |
| Prompt template | Reusable prompt with named variable slots |
| Runnable | Composable processing unit — the universal building block |
| RunnablePassthrough | Forwards input unchanged — used to preserve original values alongside derived ones |
| RunnableParallel | Fans input to multiple branches and merges results |
| RunnableLambda | Wraps a plain function as a runnable |
| LCEL | LangChain Expression Language — pipe-based chain composition |
| Chain | Ordered composition of steps via LCEL |
| Tool | Callable function an agent can choose to invoke |
| Agent | Model-driven tool selector — dynamically chooses next action |
| LangGraph | Stateful graph workflow engine — nodes, edges, shared state |
| State (LangGraph) | Shared typed object that flows through every node |
| Node (LangGraph) | Function that reads and writes to graph state |
| Edge (LangGraph) | Connection between nodes — fixed or conditional |
| withStructuredOutput | Forces model to return a typed schema |
| bindTools | Gives the model a list of tools it can choose from |
| ConversationBufferMemory | Keeps full raw message history |
| ConversationSummaryMemory | Compresses history into a running summary |
| RunnableWithMessageHistory | LCEL-compatible memory wrapper for chat history |
| LangSmith | LangChain's observability and tracing platform |
| invoke | Single input, single output — standard execution mode |
| batch | Many inputs, processed efficiently in parallel |
| stream / astream | Single input, output yielded incrementally as tokens arrive |
| Hub / Prompt Hub | Shared versioned prompt repository (`hub.pull("rlm/rag-prompt")`) |

---

## 25. Common Interview Questions

- What problem does LangChain solve in an LLM app?
- What is the difference between LangChain and LangGraph?
- What is a runnable, and why is it useful?
- What is the difference between RunnablePassthrough, RunnableParallel, and RunnableLambda?
- When would you use a chain instead of an agent?
- What are tools, and how are they different from retrievers?
- Why are prompt templates important?
- How does LangChain help with RAG pipelines?
- When should you use memory, and when should you keep the flow stateless?
- What is the difference between ConversationBufferMemory and ConversationSummaryMemory?
- How does RunnableWithMessageHistory work?
- What do streaming, retries, and tracing add to a production app?
- What is LCEL and how do you compose a chain with it?
- What is withStructuredOutput and when would you use it?
- What is LangSmith and why does it matter for debugging chains?
- What is the difference between invoke, batch, and stream?
- What is a LangGraph node vs an edge vs state?
- When would you add LangGraph to a project that already uses LangChain?
- How would you make the Research Agent in this project truly agentic using LangChain tools?