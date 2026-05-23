import axios from "axios";
import * as cheerio from "cheerio";

import { normalizeWhitespace, truncateText } from "../utils/text";

function toJinaReaderUrl(targetUrl: string): string {
  const sanitizedUrl = targetUrl.replace(/^https?:\/\//i, "");
  return `https://r.jina.ai/http://${sanitizedUrl}`;
}

async function readWithJina(targetUrl: string): Promise<string> {
  const response = await axios.get<string>(toJinaReaderUrl(targetUrl), {
    timeout: 20000,
    responseType: "text",
    headers: {
      Accept: "text/plain,text/markdown,*/*",
      "User-Agent": "Mozilla/5.0 Research Agent",
    },
  });

  return normalizeWhitespace(response.data);
}

async function readWithCheerio(targetUrl: string): Promise<string> {
  const response = await axios.get<string>(targetUrl, {
    timeout: 20000,
    responseType: "text",
    headers: {
      "User-Agent": "Mozilla/5.0 Research Agent",
    },
  });

  const document = cheerio.load(response.data);
  document("script, style, noscript, svg, iframe, nav, footer, header, aside").remove();

  const bodyText = document("body").text() || document.root().text();
  return normalizeWhitespace(bodyText);
}

export async function extractReadableText(targetUrl: string): Promise<string> {
  try {
    const jinaText = await readWithJina(targetUrl);

    if (jinaText.length >= 200) {
      return truncateText(jinaText, 8000);
    }
  } catch {
    // Jina is the primary path; Cheerio is the fallback when a page blocks the reader.
  }

  const fallbackText = await readWithCheerio(targetUrl);
  return truncateText(fallbackText, 8000);
}