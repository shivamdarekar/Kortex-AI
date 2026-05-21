import path from "node:path";

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.cwd(), process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");

export const DEFAULT_CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 500;  // ~380 tokens, safely under BAAI/bge-small-en-v1.5's 512 token limit
export const DEFAULT_OVERLAP = Number(process.env.CHUNK_OVERLAP) || 100;  // ~12% overlap, enough for continuity without bloating embeddings
export const HF_BATCH_SIZE = Number(process.env.HF_BATCH_SIZE) || 5;
export const GROQ_CONTEXT_CHUNKS = Number(process.env.GROQ_CONTEXT_CHUNKS) || 4;

export const PORT = Number(process.env.PORT) || 5000;

export default {
  UPLOADS_DIR,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
  HF_BATCH_SIZE,
  GROQ_CONTEXT_CHUNKS,
  PORT,
};
