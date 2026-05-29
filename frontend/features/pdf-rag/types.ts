export type PipelineStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "embedding"
  | "ready"
  | "error";

export type ChatMode = "document" | "general";

export interface UploadedFile {
  filename: string;
  originalName: string;
  size: number;
}

export interface PipelineStats {
  pageCount: number;
  totalTextLength: number;
  totalChunks: number;
  avgChunkSize: number;
  embeddingDimensions: number;
  embeddingModel: string;
  storedVectors: number;
  pineconeNamespace: string;
}

export interface PipelineStep {
  label: string;
  ms: number;
  value?: number;
}

export interface RetrievalPipeline {
  mode: "document" | "general";
  steps: PipelineStep[];
}

export interface SourceChunk {
  page: number;
  chunkIndex: number;
  score: number;
  sourceFile: string;
  documentId: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  model?: string;
  pipeline?: RetrievalPipeline;
  isOptimistic?: boolean;
  isError?: boolean;
}

export interface AskQuestionResponse {
  success: boolean;
  data: {
    answer: string;
    model: string;
    sources: SourceChunk[];
    mode: ChatMode;
    pipeline: RetrievalPipeline;
  };
}