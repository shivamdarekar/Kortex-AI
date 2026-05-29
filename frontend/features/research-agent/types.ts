export type ResearchStatus = "idle" | "searching" | "extracting" | "summarizing" | "reporting" | "done" | "error";

export interface ResearchSourceSummary {
  title: string;
  sourceLink: string;
  url?: string;
}

export interface ResearchResult {
  query: string;
  summary: string;
  report: string;
  sources: ResearchSourceSummary[];
  generatedAt: string;
  usedFallback: boolean;
}

export interface ResearchMessage {
  id: string;
  role: "user" | "assistant";
  query: string;
  result?: ResearchResult;
  isOptimistic?: boolean;
  isError?: boolean;
  errorText?: string;
}
