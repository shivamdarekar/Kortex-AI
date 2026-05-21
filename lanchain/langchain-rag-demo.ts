// @ts-nocheck
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

const PDF_NAME = "Backend Basics.pdf";
const EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
const CHAT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const resolvePdfPath = (): string => {
  const currentFile = fileURLToPath(import.meta.url);
  return path.join(path.dirname(currentFile), PDF_NAME);
};

const formatDocs = (docs: Array<{ pageContent: string }>): string => {
  return docs.map((doc) => doc.pageContent).join("\n\n");
};

async function main(): Promise<void> {
  console.log("🚀 Starting RAG PDF Chatbot...");

  const pdfPath = resolvePdfPath();

  // 2. PDF Load + Chunking
  console.log("📄 Loading PDF...");
  const loader = new PDFLoader(pdfPath);
  const docs = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150,
  });
  const chunks = await textSplitter.splitDocuments(docs);
  console.log(`✅ ${chunks.length} chunks created`);

  // 3. Embeddings + Vector Store
  console.log("🔍 Creating embeddings & vector store...");
  const embeddings = new HuggingFaceInferenceEmbeddings({
    model: EMBEDDING_MODEL,
    apiKey: process.env.HF_TOKEN,
  });

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "");

  const vectorstore = await PineconeStore.fromDocuments(chunks, embeddings, {
    pineconeIndex: index,
    namespace: process.env.PINECONE_NAMESPACE || "pdf-rag",
  });
  const retriever = vectorstore.asRetriever({ k: 4 });

  // 4. Groq LLM + RAG Chain
  console.log("🤖 Setting up Groq LLM & RAG chain...");
  const llm = new ChatGroq({
    model: CHAT_MODEL,
    temperature: 0.1,
    apiKey: process.env.GROQ_API_KEY,
  });

  const prompt = ChatPromptTemplate.fromTemplate(`
You are a helpful assistant. Use ONLY the context below to answer.

Context: {context}

Question: {question}

Answer precisely based on the context. If you don't know, say you don't know.
`);

  const ragChain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocs),
      question: new RunnablePassthrough(),
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  console.log("✅ RAG Pipeline ready! Ask your questions...");

  // 5. Interactive Chat Loop
  const rl = createInterface({ input, output });

  try {
    while (true) {
      const query = await rl.question("\n❓ your question  (type 'quit' to exit) ");

      if (query.trim().toLowerCase() === "quit") {
        break;
      }

      const result = await ragChain.invoke(query);
      console.log(`\n💬 Answer: ${result}\n`);
    }
  } finally {
    rl.close();
  }

  console.log("👋 Chatbot closed. Goodbye!");
}

void main().catch((error: unknown) => {
  console.error("❌ LangChain demo failed:", error);
  process.exitCode = 1;
});