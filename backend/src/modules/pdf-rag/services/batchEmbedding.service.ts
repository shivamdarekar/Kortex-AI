import { InferenceClient } from "@huggingface/inference";
import { HF_BATCH_SIZE } from "../../../config";

export interface BatchEmbeddingResult {
  texts: string[];
  embeddings: number[][];
}

const MODEL_ID = "BAAI/bge-small-en-v1.5";
const BATCH_SIZE = HF_BATCH_SIZE;

const meanPooling = (tokenEmbeddings: number[][]): number[] => {
  const dimensions = tokenEmbeddings[0]?.length || 0;
  const pooled = new Array(dimensions).fill(0);
  for (const embedding of tokenEmbeddings) {
    for (let i = 0; i < dimensions; i++) {
      pooled[i] += embedding[i] ?? 0;
    }
  }
  return pooled.map((value) => value / tokenEmbeddings.length);
};

const cleanText = (text: string): string => text.replace(/\s+/g, " ").trim();

const normalizeEmbeddingResponse = (response: unknown): number[][] => {
  if (!Array.isArray(response)) {
    throw new Error("Invalid HF response format: expected an array");
  }
  if (response.length === 0) return [];

  const firstItem = response[0];

  if (typeof firstItem === "number") {
    return [response as number[]];
  }
  if (Array.isArray(firstItem) && typeof firstItem[0] === "number") {
    return response as number[][];
  }
  if (Array.isArray(firstItem) && Array.isArray(firstItem[0])) {
    return (response as number[][][]).map(meanPooling);
  }

  throw new Error("Unsupported HF response shape");
};

export const generateBatchEmbeddings = async (
  texts: string[],
): Promise<BatchEmbeddingResult> => {
  if (!process.env.HF_TOKEN) {
    throw new Error("HF_TOKEN environment variable is not set");
  }
  if (texts.length === 0) {
    return { texts: [], embeddings: [] };
  }

  const client = new InferenceClient(process.env.HF_TOKEN);
  const cleanedTexts = texts.map(cleanText);
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < cleanedTexts.length; i += BATCH_SIZE) {
    const batchTexts = cleanedTexts.slice(i, Math.min(i + BATCH_SIZE, cleanedTexts.length));
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`Processing batch ${batchNumber}/${Math.ceil(cleanedTexts.length / BATCH_SIZE)} (${batchTexts.length} chunks)...`);

    try {
      const response = await client.featureExtraction({
        model: MODEL_ID,
        inputs: batchTexts,
      });

      allEmbeddings.push(...normalizeEmbeddingResponse(response));

      if (i + BATCH_SIZE < cleanedTexts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      throw new Error(
        `Batch embedding generation failed at batch ${batchNumber}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return { texts: cleanedTexts, embeddings: allEmbeddings };
};

export const generateTextEmbedding = async (text: string): Promise<number[]> => {
  const result = await generateBatchEmbeddings([text]);
  const embedding = result.embeddings[0];

  if (!embedding) {
    throw new Error("Failed to generate embedding for text");
  }

  return embedding;
};