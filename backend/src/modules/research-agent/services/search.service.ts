import { searchWithTavily } from "../tools/tavily.tool";
import type { ResearchSource } from "../types";

export async function getResearchSources(query: string): Promise<ResearchSource[]> {
  return searchWithTavily(query);
}