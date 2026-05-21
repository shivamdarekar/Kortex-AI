/**
 * Cleans raw PDF-extracted text before chunking.
 * Applied in order: encoding → fractions → headers → whitespace → sentence boundaries
 */

// Common repeating header/footer patterns to strip (add more as needed)
const HEADER_FOOTER_PATTERNS = [
  /Parul University[\s\S]{0,200}?303105311\)/gi,
  /Faculty of Engineering[\s\S]{0,100}?Humanities/gi,
  /Academic Year \d{4}-\d{2,4}/gi,
  /Branch:\s*CSE\s*\/\s*IT/gi,
  /Subject:.*?\n/gi,
  /Department of.*?\n/gi,
];

/**
 * Replace non-ASCII Unicode math/special characters with ASCII equivalents or remove them
 */
const fixEncoding = (text: string): string => {
  return text
    .replace(/[푅푥푛푎푏푐푑푒푓]/g, (char) => {
      const map: Record<string, string> = {
        "푅": "R", "푥": "x", "푛": "n", "푎": "a",
        "푏": "b", "푐": "c", "푑": "d", "푒": "e", "푓": "f",
      };
      return map[char] ?? char;
    })
    .replace(/[–—]/g, "-")       // normalize dashes
    .replace(/[""]/g, '"')       // normalize quotes
    .replace(/['']/g, "'")       // normalize apostrophes
    .replace(/…/g, "...");       // normalize ellipsis
};

/**
 * Fix fraction artifacts: isolated numbers on separate lines like \n3\n2\n → 3/2
 * Pattern: newline + digits + newline + digits + newline (typical PDF fraction rendering)
 */
const fixFractionArtifacts = (text: string): string => {
  // Pattern: \n<number>\n<number>\n → <number>/<number>
  return text
    .replace(/\n(\d+)\n(\d+)\n/g, " $1/$2 ")
    // Single digit isolated on its own line between text (likely superscript/subscript)
    .replace(/\n(\d)\n(?=[a-zA-Z])/g, "$1 ")
    // Isolated single digit line at end of expression
    .replace(/(?<=[a-zA-Z])\n(\d)\n/g, "$1\n");
};

/**
 * Remove repeating page headers and footers
 */
const removeHeadersFooters = (text: string): string => {
  let cleaned = text;
  for (const pattern of HEADER_FOOTER_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned;
};

/**
 * Fix hyphenated line breaks: "sub-\nduplicate" → "subduplicate"
 */
const fixHyphenatedLineBreaks = (text: string): string => {
  return text.replace(/(\w)-\n(\w)/g, "$1$2");
};

/**
 * Normalize whitespace:
 * - Collapse 3+ newlines to 2 (preserve paragraph breaks)
 * - Collapse multiple spaces to one
 * - Trim each line
 */
const normalizeWhitespace = (text: string): string => {
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")   // max 2 consecutive newlines
    .replace(/[ \t]{2,}/g, " ")   // collapse multiple spaces/tabs
    .trim();
};

/**
 * Remove noise: divider lines, bullet artifacts, page numbers
 */
const removeNoise = (text: string): string => {
  return text
    .replace(/^[-_=*]{3,}$/gm, "")          // divider lines
    .replace(/^\s*[•▪▸◦‣]\s*/gm, "- ")      // normalize bullet points
    .replace(/^\s*\d+\s*$/gm, "")            // standalone page numbers
    .replace(/\(continued\)/gi, "")          // "continued" markers
    .replace(/\.{4,}/g, "...");              // excessive dots
};

/**
 * Remove consecutive duplicate lines, which commonly appear as repeated URLs,
 * footers, or duplicated PDF text overlays.
 */
const removeConsecutiveDuplicateLines = (text: string): string => {
  const lines = text.split("\n");
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      if (cleanedLines[cleanedLines.length - 1] !== "") {
        cleanedLines.push("");
      }
      continue;
    }

    if (cleanedLines[cleanedLines.length - 1] === trimmedLine) {
      continue;
    }

    cleanedLines.push(trimmedLine);
  }

  return cleanedLines.join("\n");
};

/**
 * Main cleaning pipeline — runs all steps in order
 */
export const cleanExtractedText = (rawText: string): string => {
  let text = rawText;

  text = fixEncoding(text);
  text = removeHeadersFooters(text);
  text = fixHyphenatedLineBreaks(text);
  text = fixFractionArtifacts(text);
  text = removeNoise(text);
  text = removeConsecutiveDuplicateLines(text);
  text = normalizeWhitespace(text);

  return text;
};

/**
 * Clean an individual chunk's text (applied after chunking for final polish)
 */
export const cleanChunkText = (chunkText: string): string => {
  return chunkText
    .replace(/^[^a-zA-Z0-9(]*/u, "")   // strip leading non-alphanumeric chars
    .replace(/[ \t]{2,}/g, " ")         // collapse spaces
    .trim();
};
