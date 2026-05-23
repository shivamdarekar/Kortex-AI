export interface ResearchSource {
  title: string;
  url: string;
  sourceLink: string;
  snippet: string;
  content?: string;
}

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

export interface ResearchRequestBody {
  query: string;
}

export interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

export interface TavilyResponse {
  results?: TavilyResult[];
}