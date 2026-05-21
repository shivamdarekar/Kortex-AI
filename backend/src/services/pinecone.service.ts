import { createHash } from "node:crypto";
import { Pinecone } from "@pinecone-database/pinecone";

export interface PineconeStoreInput {
  filename: string;
  namespace?: string;
  chunks: Array<{ index: number; text: string; page: number }>;
  embeddings: number[][];
}

export interface PineconeStoreResult {
  indexName: string;
  namespace: string;
  batches: number;
  storedVectors: number;
  dimensions: number;
}

export interface PineconeStatsResult {
  indexName: string;
  namespace: string;
  dimension: number;
  totalRecordCount: number;
  namespaceRecordCount: number;
}

export interface PineconeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface PineconeQueryResult {
  indexName: string;
  namespace: string;
  topK: number;
  matches: PineconeMatch[];
}

const BATCH_SIZE = 100;

const sanitizeIdPart = (value: string): string => {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
};

const hashChunk = (text: string): string => {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
};

export const createPdfNamespace = (filename: string): string => {
  const baseName = sanitizeIdPart(filename);

  return `pdf-${baseName}`;
};

const getPineconeConfig = () => {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!apiKey) {
    throw new Error("PINECONE_API_KEY environment variable is not set");
  }

  if (!indexName) {
    throw new Error("PINECONE_INDEX_NAME environment variable is not set");
  }

  return { apiKey, indexName };
};

const getPineconeIndex = () => {
  const { apiKey, indexName } = getPineconeConfig();
  const pinecone = new Pinecone({ apiKey });
  return { index: pinecone.index(indexName), indexName };
};

export const storeEmbeddingsInPinecone = async (
  input: PineconeStoreInput,
): Promise<PineconeStoreResult> => {
  const { index, indexName } = getPineconeIndex();
  const namespace = input.namespace || process.env.PINECONE_NAMESPACE || "pdf-rag";
  const pdfId = sanitizeIdPart(input.filename);

  if (input.chunks.length !== input.embeddings.length) {
    throw new Error("Chunks and embeddings length mismatch");
  }

  if (input.embeddings.length === 0) {
    return {
      indexName,
      namespace,
      batches: 0,
      storedVectors: 0,
      dimensions: 0,
    };
  }

  const dimensions = input.embeddings[0]?.length || 0;
  const namespacedIndex = index.namespace(namespace);
  let storedVectors = 0;
  let batches = 0;

  // Single-PDF workflow: clear the namespace before inserting the current PDF
  // so re-processing the same file does not leave stale vectors behind.
  try {
    await namespacedIndex.deleteAll();
    console.log(`[PINECONE] Cleared namespace ${namespace} before upsert`);
  } catch (error) {
    console.warn(
      `[PINECONE] Could not clear namespace ${namespace}; continuing with upsert.`,
      error instanceof Error ? error.message : error,
    );
  }

  for (let i = 0; i < input.embeddings.length; i += BATCH_SIZE) {
    const vectors = input.embeddings
      .slice(i, i + BATCH_SIZE)
      .map((embedding, offset) => {
        const chunk = input.chunks[i + offset];
        if (!chunk) {
          throw new Error(`Missing chunk at index ${i + offset}`);
        }
        const chunkHash = hashChunk(chunk.text);
        return {
          id: `${pdfId}-chunk-${chunk.index}-${chunkHash}`,
          values: embedding.map(Number),
          metadata: {
            filename: input.filename,
            documentId: pdfId,
            chunkIndex: chunk.index,
            page: chunk.page,
            chunkHash,
            chunkLength: chunk.text.length,
            createdAt: new Date().toISOString(),
            text: chunk.text,
          },
        };
      });

    batches += 1;
    console.log(
      `[PINECONE] Upserting batch ${batches} with ${vectors.length} vectors into ${indexName}/${namespace}`,
    );

    await namespacedIndex.upsert({ records: vectors });
    storedVectors += vectors.length;
  }

  return {
    indexName,
    namespace,
    batches,
    storedVectors,
    dimensions,
  };
};

export const getPineconeStats = async (
  namespaceOverride?: string,
): Promise<PineconeStatsResult> => {
  const { index, indexName } = getPineconeIndex();
  const namespace = namespaceOverride || process.env.PINECONE_NAMESPACE || "pdf-rag";
  const stats = await index.describeIndexStats();

  const namespaceRecordCount = Number(
    (stats.namespaces as Record<string, { recordCount?: number }> | undefined)?.[namespace]?.recordCount || 0,
  );

  return {
    indexName,
    namespace,
    dimension: Number(stats.dimension || 0),
    totalRecordCount: Number(stats.totalRecordCount || 0),
    namespaceRecordCount,
  };
};

export const queryPineconeNamespace = async (
  namespace: string,
  vector: number[],
  topK: number = 5,
): Promise<PineconeQueryResult> => {
  const { index, indexName } = getPineconeIndex();
  const namespacedIndex = index.namespace(namespace);

  const response = await namespacedIndex.query({
    vector: vector.map(Number),
    topK,
    includeMetadata: true,
  });

  return {
    indexName,
    namespace,
    topK,
    matches: (response.matches || []).map((match) => {
      const mappedMatch: PineconeMatch = {
        id: match.id,
        score: match.score ?? 0,
      };

      if (match.metadata) {
        mappedMatch.metadata = match.metadata as Record<string, unknown>;
      }

      return mappedMatch;
    }),
  };
};