# LangChain Mirror

This folder is a side-by-side learning copy of the current backend, but expressed in a LangChain-style flow.

The goal is not to replace the real backend. It is to show how your manual Express pipeline maps to LangChain abstractions.

## What your current backend does manually

- Upload PDF with Multer
- Read the file with `pdf-parse`
- Clean and split text with your own chunking logic
- Generate embeddings through Hugging Face directly
- Store and query Pinecone directly
- Send retrieved chunks to Groq directly

## What a LangChain version would do

- Use a document loader instead of raw PDF parsing code
- Use a text splitter instead of your custom chunking service
- Use an embeddings wrapper instead of calling the embedding API yourself
- Use a vector store adapter instead of Pinecone SDK calls everywhere
- Use a retrieval chain or QA chain instead of hand-building the prompt pipeline

## Why this matters

Your manual version teaches the primitives:

- how chunking changes retrieval
- how metadata is stored and reused
- how vector search works
- how context is formatted for the LLM

LangChain reduces glue code once you already understand those primitives.

## File map

- `langchain-rag-demo.ts` shows the same pipeline in one file
- This `README.md` explains the conceptual differences step by step
- `LANGCHAIN_GUIDE.md` is the developer guide for LangChain, LangGraph, runnables, tools, and agents

## Important note

This mirror is intentionally lightweight and educational. It is meant to help you compare architecture, not to be the production implementation.