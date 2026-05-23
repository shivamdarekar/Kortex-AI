import type { ResearchSource, ResearchSourceSummary } from "../types";
import { buildSourcesMarkdownList, normalizeWhitespace, truncateText } from "../utils/text";

export function buildEvidenceBlock(sources: ResearchSource[]): string {
  return sources
    .map((source, index) => {
      const content = truncateText(
        normalizeWhitespace(source.content ?? source.snippet),
        1500
      );

      return `[${index + 1}] ${source.title}\nURL: ${source.url}\nEvidence: ${content}`;
    })
    .join("\n\n");
}

export function buildFallbackReport(
  query: string,
  sources: ResearchSource[],
  summary: string
): string {
  return [
    `# Research Report: ${query}`,
    "",
    "## Summary",
    summary,
    "",
    "## Sources",
    buildSourcesMarkdownList(sources),
    "",
    "## Next Steps",
    "- Add GROQ_API_KEY to enable live summaries and report generation.",
    "- Add TAVILY_API_KEY to improve web search results.",
    "- Keep Jina Reader as the main extraction layer and use Cheerio only as a fallback.",
  ].join("\n");
}

export function toPublicSources(sources: ResearchSource[]): ResearchSourceSummary[] {
  return sources.map((source) => ({
    title: source.title,
    sourceLink: source.sourceLink,
    url: source.url,
  }));
}