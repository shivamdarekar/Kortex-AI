export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export function buildSourcesMarkdownList(
  sources: Array<{ title: string; url?: string; sourceLink?: string }>
): string {
  if (sources.length === 0) {
    return "- No sources returned.";
  }

  return sources
    .map((source) => {
      const link = source.sourceLink ?? source.url ?? "#";
      return `- [${source.title}](${link})`;
    })
    .join("\n");
}