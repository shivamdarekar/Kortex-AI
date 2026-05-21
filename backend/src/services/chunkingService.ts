import { cleanChunkText } from "./textCleaning.service";

export interface ChunkConfig {
  chunkSize: number; // characters per chunk
  overlapSize: number; // overlap between chunks in characters
}

export interface Chunk {
  index: number;
  text: string;
  size: number;
  startChar: number;
  endChar: number;
  page: number;
}

/**
 * Split text by delimiters in order of preference (semantic/recursive)
 * Respects: paragraph → sentence → line → space → character boundaries
 * Preserves semantic meaning and prevents broken thoughts/sentences
 */
const splitBySemantic = (text: string, maxSize: number): string[] => {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }

    // Try paragraph break first
    const paragraphMatch = remaining.substring(0, maxSize).lastIndexOf("\n\n");
    if (paragraphMatch > maxSize * 0.5) {
      chunks.push(remaining.substring(0, paragraphMatch));
      remaining = remaining.substring(paragraphMatch + 2).trim();
      continue;
    }

    // Try sentence break
    const sentenceMatch = remaining.substring(0, maxSize).lastIndexOf(".");
    if (sentenceMatch > maxSize * 0.6) {
      chunks.push(remaining.substring(0, sentenceMatch + 1));
      remaining = remaining.substring(sentenceMatch + 1).trim();
      continue;
    }

    // Try line break
    const lineMatch = remaining.substring(0, maxSize).lastIndexOf("\n");
    if (lineMatch > maxSize * 0.5) {
      chunks.push(remaining.substring(0, lineMatch));
      remaining = remaining.substring(lineMatch + 1).trim();
      continue;
    }

    // Try space break
    const spaceMatch = remaining.substring(0, maxSize).lastIndexOf(" ");
    if (spaceMatch > maxSize * 0.7) {
      chunks.push(remaining.substring(0, spaceMatch));
      remaining = remaining.substring(spaceMatch + 1).trim();
    } else {
      // Hard break if no good space found
      chunks.push(remaining.substring(0, maxSize));
      remaining = remaining.substring(maxSize);
    }
  }

  return chunks;
};

/**
 * Create semantic chunks with overlap to preserve continuity
 */
export const createChunks = (
  pages: Array<{ pageNumber: number; text: string }>,
  config: ChunkConfig = {
    chunkSize: 800,
    overlapSize: 150,
  },
): Chunk[] => {
  const { chunkSize, overlapSize } = config;
  const finalChunks: Chunk[] = [];

  let globalIndex = 0;

  pages.forEach((page) => {
    const semanticChunks = splitBySemantic(page.text, chunkSize);
    let currentIndex = 0;

    semanticChunks.forEach((chunk, idx) => {
      let chunkText = chunk;
      let startChar = currentIndex;

      if (idx > 0 && overlapSize > 0) {
        const prevChunk = semanticChunks[idx - 1];
        if (prevChunk) {
          const overlapText = prevChunk.slice(-overlapSize);
          chunkText = overlapText + chunkText;
          startChar = currentIndex - overlapSize;
        }
      }

      const cleanedChunkText = cleanChunkText(chunkText);

      finalChunks.push({
        index: globalIndex,
        text: cleanedChunkText,
        size: cleanedChunkText.length,
        startChar: Math.max(0, startChar),
        endChar: currentIndex + chunk.length,
        page: page.pageNumber,
      });

      globalIndex += 1;
      currentIndex += chunk.length;
    });
  });

  return finalChunks;
};

export const analyzeChunks = (chunks: Chunk[]) => {
  return {
    totalChunks: chunks.length,
    averageChunkSize: chunks.length > 0
      ? Math.round(chunks.reduce((sum, c) => sum + c.size, 0) / chunks.length)
      : 0,
    minChunkSize: chunks.length > 0 ? Math.min(...chunks.map((c) => c.size)) : 0,
    maxChunkSize: chunks.length > 0 ? Math.max(...chunks.map((c) => c.size)) : 0,
    strategy: "semantic-recursive",
  };
};
