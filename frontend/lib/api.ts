import axios from "axios";
import type { AskQuestionResponse, ChatMode, PipelineStats } from "./types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is required. Create frontend/.env.local from frontend/.env.example.");
}

const api = axios.create({
  baseURL: apiBaseUrl,
});

// Extract backend { message } from error responses instead of generic axios messages
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err?.response?.data?.message ||
      (err?.code === "ERR_NETWORK" ? "Cannot reach the server. Is the backend running?" : null) ||
      err?.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export const uploadPdf = async (file: File) => {
  const form = new FormData();
  form.append("pdf", file);
  const { data } = await api.post<{
    success: boolean;
    file: { filename: string; originalName: string; size: number };
  }>("/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
  return data.file;
};

export const generateEmbeddings = async (filename: string): Promise<PipelineStats> => {
  const { data } = await api.post<{
    success: boolean;
    data: {
      extraction: { pageCount: number; totalTextLength: number };
      chunking: { totalChunks: number; avgChunkSize: number };
      embeddings: { dimensions: number; model: string };
      pinecone: { storedVectors: number; namespace: string; embeddingDimensions: number };
    };
  }>("/generate-embeddings", { filename });

  const d = data.data;
  return {
    pageCount: d.extraction.pageCount,
    totalTextLength: d.extraction.totalTextLength,
    totalChunks: d.chunking.totalChunks,
    avgChunkSize: d.chunking.avgChunkSize,
    embeddingDimensions: d.pinecone.embeddingDimensions || d.embeddings.dimensions,
    embeddingModel: d.embeddings.model,
    storedVectors: d.pinecone.storedVectors,
    pineconeNamespace: d.pinecone.namespace,
  };
};

export const askQuestion = async (
  filename: string,
  question: string,
  mode: ChatMode,
  topK = 5
): Promise<AskQuestionResponse["data"]> => {
  const { data } = await api.post<AskQuestionResponse>("/ask-question", {
    filename,
    question,
    mode,
    topK,
  });
  return data.data;
};

export const fetchSuggestedQuestions = async (filename: string): Promise<string[]> => {
  const { data } = await api.post<{ success: boolean; data: { questions: string[] } }>(
    "/suggest-questions",
    { filename }
  );
  return data.data.questions;
};
