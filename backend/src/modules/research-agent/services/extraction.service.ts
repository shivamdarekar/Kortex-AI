import { extractReadableText } from "../tools/jina.tool";
import type { ResearchSource } from "../types";

export async function enrichSourcesWithReadableContent(
  sources: ResearchSource[]
): Promise<ResearchSource[]> {
  return Promise.all(
    sources.map(async (source) => {
      try {
        console.log("[research] reading source", { url: source.url });

        const content = await extractReadableText(source.url);
        console.log("[research] source extracted", { url: source.url });

        return {
          ...source,
          content,
        };
      } catch {
        console.log("[research] extraction failed, keeping source metadata only", {
          url: source.url,
        });

        return source;
      }
    })
  );
}