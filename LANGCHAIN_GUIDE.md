# LangChain Developer Guide

This guide explains what LangChain is, why it exists, when to use it, and how its main pieces fit together for a developer building RAG apps like this project.

This project uses LangChain in two places:
- **Research Agent** (`src/modules/research-agent/`) — uses `@langchain/groq` and `@langchain/core` for a two-prompt LCEL pipeline (summary → report)
- **LangChain demo** (`lanchain/langchain-rag-demo.ts`) — standalone reference implementation of the full PDF RAG pipeline using LangChain abstractions

The PDF RAG module (`src/modules/pdf-rag/`) is built manually without LangChain — intentionally, to understand every primitive.

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

## 5. Core Mental Model

Think of LangChain as a toolbox of parts that you connect into a pipeline.

Typical flow:

`Document Loader -> Splitter -> Embeddings -> Vector Store -> Retriever -> Prompt -> LLM -> Parser`

That is exactly the same shape as your manual backend. The difference is that LangChain standardizes the shape.

## 6. Important Building Blocks

### Document Loaders

Load raw data into document objects.

Examples:

- PDF loaders
- text file loaders
- web page loaders
- CSV loaders
- HTML loaders

In your demo, `PDFLoader` is the loader.

What it gives you:

- `pageContent`
- metadata such as page numbers, source path, or document IDs

### Text Splitters

Split long documents into chunks for retrieval and embedding.

Examples:

- `RecursiveCharacterTextSplitter`
- token-based splitters
- markdown-aware splitters
- HTML-aware splitters

Why they matter:

- embeddings have input limits
- retrieval works better on focused chunks
- chunk size and overlap affect answer quality

### Embeddings

Convert text into vectors.

In your manual backend, you call Hugging Face directly.

In LangChain, embeddings are usually wrapped in an embeddings class so the rest of the system does not care how vectors are produced.

Useful concepts:

- embedding model choice
- vector dimension
- batching
- rate limits
- normalization

### Vector Stores

Store and query vectors.

Examples:

- FAISS
- Pinecone
- Chroma
- Weaviate
- Milvus

Your manual backend already uses Pinecone directly.

LangChain can wrap that so retrieval code becomes simpler.

### Retrievers

Retrievers are a standardized way to ask for relevant documents.

Instead of directly querying a vector DB everywhere, you ask the retriever for the top matches.

Common retriever patterns:

- vector similarity retriever
- MMR retriever
- hybrid retrieval
- multi-query retrieval

### Prompts

Prompt templates are reusable prompt definitions with variables.

Benefits:

- less string concatenation
- clearer variable injection
- easier reuse across chains

### LLM Wrappers

LangChain wraps model providers so they can be used in the same pipeline shape.

Examples:

- Groq
- OpenAI
- Anthropic
- Mistral
- Ollama

This lets you swap providers without rewriting the pipeline logic.

### Output Parsers

Turn model output into a structured format.

Examples:

- string parser
- JSON parser
- structured schema parser

Useful when you want the model to return reliable machine-readable output.

## 7. Runnables

Runnables are one of the most important LangChain concepts for developers.

They are composable units that take input, do something, and return output.

You can think of them as pipeline blocks.

Why they matter:

- they unify different steps under one interface
- they can be chained together
- they support reuse and composition
- they make pipeline logic easier to reason about

Common runnable patterns:

- pass-through input
- map input to multiple branches
- pipe one runnable into another
- combine outputs into a prompt

In your demo, the chain is built from runnables and then executed with `invoke()`.

## 8. Pipes and Composition

The pipe concept usually means chaining with `|` or composing one component into the next.

Example mental model:

- question goes into retriever
- retriever returns documents
- documents are formatted into context
- prompt receives context and question
- prompt feeds the LLM
- parser returns a final string

This is the same as your manual backend, just expressed as a data flow graph.

Why it is useful:

- less callback nesting
- easier to read pipelines
- easier to swap one step without touching the rest

## 9. Chains

A chain is a sequence of operations that together implement a task.

Examples:

- retrieval QA chain
- document stuffing chain
- summarization chain
- extraction chain
- classification chain

Chains are useful when the flow is repeated often and should be easy to reuse.

In older LangChain usage, people often built many custom chains.
In newer LangChain patterns, runnables are the more general primitive and chains are often built from them.

## 10. Tools

Tools are callable capabilities that an agent can choose from.

Examples:

- search the web
- query a database
- fetch a file
- calculate a value
- call an internal API

Tools matter when the LLM should not just answer, but also decide what action to take.

Important idea:

- a tool is not the same as a retriever
- a retriever returns documents
- a tool can do almost anything callable

In a RAG app, a retriever may be one tool in a larger agent system.

## 11. Agents

Agents use the model to decide which tool to call next.

This is different from a fixed chain.

Chain:

- you know the exact order of steps in advance

Agent:

- the model chooses the next action dynamically

Use agents when:

- the task is open-ended
- you need tool selection
- you want multi-step reasoning with actions

Avoid agents when:

- the flow is simple and deterministic
- you need predictable behavior
- you can solve it with a straight chain or retriever

For your backend, the document Q&A path is more naturally a chain than an agent.

## 12. LangGraph

LangGraph is for stateful, graph-based LLM workflows.

If LangChain is about composing building blocks, LangGraph is about controlling workflow state and branching.

Use it when you need:

- loops
- conditional branching
- memory across steps
- human-in-the-loop approval
- retries and state transitions
- more explicit control over agent workflows

Think of it as the next step up when a single chain is not enough.

### LangChain vs LangGraph

LangChain:

- best for composition and reusable components
- great for loaders, splitters, retrievers, prompts, and model calls

LangGraph:

- best for multi-step state machines and agent workflows
- great when you need branching, loops, and durable state

Simple rule:

- use LangChain for the parts
- use LangGraph for the workflow

## 13. Memory

Memory is about persisting conversational or workflow state.

Depending on the use case, memory can mean:

- chat history
- conversation summary
- user preferences
- tool call context
- workflow state

Memory is useful when the application is not stateless.

In a simple PDF QA app, memory is optional.
In a multi-turn assistant or agent workflow, memory becomes much more important.

## 14. Callbacks and Tracing

Callbacks let you observe what the pipeline is doing.

They are helpful for:

- debugging
- logging
- latency measurements
- token usage tracking
- chain visualization

This matters a lot when you want to understand why retrieval or generation behaved a certain way.

For developers, tracing is often what makes LangChain feel practical instead of opaque.

## 15. Structured Output

Many LLM apps need more than free-text answers.

LangChain can help enforce or parse structured outputs such as:

- JSON objects
- lists
- schema-based responses
- extracted fields

This is useful for:

- forms
- classification
- extraction
- tool planning
- UI rendering

## 16. Output Quality Concepts

When using LangChain for RAG, quality still depends on fundamentals.

The framework does not automatically fix:

- bad chunking
- bad embeddings
- poor retrieval settings
- noisy documents
- weak prompts
- hallucination risk

You still need to care about:

- chunk size
- overlap
- retriever top-k
- prompt grounding
- context formatting
- metadata quality

That is why your manual backend is valuable as a learning base.

## 17. How This Maps To This Project

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

## 18. Practical Developer Guidance

If you are learning:

1. build the manual version first
2. understand every function and data shape
3. identify repeated patterns
4. convert the repeated patterns into LangChain blocks
5. keep the workflow deterministic until you need agents

If you are shipping a product:

1. use LangChain where it reduces duplicated glue code
2. keep custom code where your logic is unique
3. do not force everything into the framework
4. use LangGraph only when your workflow needs branching or state

## 19. Key Terms To Remember

- Document: a chunk of content plus metadata
- Loader: turns source data into documents
- Splitter: breaks documents into smaller parts
- Embedding: vector representation of text
- Vector store: database for similarity search
- Retriever: interface for fetching relevant documents
- Prompt template: reusable prompt with variables
- Runnable: composable processing unit
- Chain: ordered composition of steps
- Tool: callable function an agent can use
- Agent: model-driven tool selector
- LangGraph: stateful graph workflow engine

## 20. Bottom Line

Use LangChain when you want a standard way to compose LLM app pieces.

Use LangGraph when the workflow needs state, branching, or looped reasoning.

Keep the manual backend as your source of truth for understanding the pipeline.

That is the strongest way to learn both the primitives and the framework.

## 21. Practical Topics You Should Also Know

These are the LangChain-adjacent topics that matter when you move from learning to building:

- **LCEL / composition style**: modern LangChain pipelines are often built by composing runnables directly.
- **Streaming**: useful for chat UIs that should show tokens as they arrive.
- **Retries and fallback logic**: recover from model or network failures without breaking the user flow.
- **Batching**: process multiple documents or chunks efficiently when embedding or retrieving.
- **Persistence / checkpoints**: save workflow state when you need resumable or long-running flows.
- **Prompt templates**: keep prompts reusable and easier to review.
- **Model routing**: choose different models for extraction, retrieval, answering, or classification.
- **Tool calling**: let agents invoke external functions when simple retrieval is not enough.
- **Guardrails**: constrain output format, permissions, and safe behavior.
- **Tracing and debugging**: inspect what the chain did at each step.
- **Memory vs stateless chains**: use memory when conversation history should influence the next turn.

If you understand these, you can move from a demo to a production-ready workflow much faster.

## 22. Common Interview Questions

- What problem does LangChain solve in an LLM app?
- What is the difference between LangChain and LangGraph?
- What is a runnable, and why is it useful?
- When would you use a chain instead of an agent?
- What are tools, and how are they different from retrievers?
- Why are prompt templates important?
- How does LangChain help with RAG pipelines?
- When should you use memory, and when should you keep the flow stateless?
- What do streaming, retries, and tracing add to a production app?