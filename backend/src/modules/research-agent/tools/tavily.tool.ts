import axios from "axios";

import { normalizeWhitespace } from "../utils/text";
import type { ResearchSource, TavilyResponse, TavilyResult } from "../types";

export async function searchWithTavily(query: string): Promise<ResearchSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY environment variable is not set");
  }

  console.log("[research] Tavily request starting", { query });

  const response = await axios.post<TavilyResponse>(
    "https://api.tavily.com/search",
    {
      api_key: apiKey,
      query,
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      search_depth: "basic",
    },
    {
      timeout: 20000,
    }
  );

  const results = response.data.results ?? [];
  console.log("[research] Tavily request finished", { count: results.length });

  return results.flatMap((result: TavilyResult) => {
    const title = typeof result.title === "string" ? normalizeWhitespace(result.title) : "";
    const url = typeof result.url === "string" ? normalizeWhitespace(result.url) : "";

    if (!title || !url) {
      return [];
    }

    const snippet =
      typeof result.content === "string" && result.content.trim().length > 0
        ? normalizeWhitespace(result.content).slice(0, 300)
        : "No snippet returned by Tavily.";

    return [{ title, url, sourceLink: url, snippet }];
  });
}