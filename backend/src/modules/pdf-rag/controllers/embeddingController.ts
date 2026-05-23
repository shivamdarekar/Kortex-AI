import fs from "node:fs/promises";
import type { Request, Response } from "express";

import { extractTextFromPdf } from "../services/pdfExtraction.service";
import { createChunks } from "../services/chunkingService";
import { generateBatchEmbeddings } from "../services/batchEmbedding.service";
import {
  createPdfNamespace,
  getPineconeStats,
  storeEmbeddingsInPinecone,
} from "../services/pinecone.service";
import { ensureFilename, buildSafeFilePath } from "../../../utils/validation";
import { DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP } from "../../../config";

export const generateEmbeddingsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const filename = ensureFilename(req.body.filename);
    const filePath = buildSafeFilePath(filename);

    // Extract text from PDF
    console.log("Extracting PDF...");
    const extractionResult = await extractTextFromPdf(filePath);

    // Chunk the extracted text
    const chunkConfig = {
      chunkSize: Number(req.body.chunkSize) || DEFAULT_CHUNK_SIZE,
      overlapSize: Number(req.body.overlapSize) || DEFAULT_OVERLAP,
    };

    console.log("Chunking text...");
    const chunks = createChunks(extractionResult.pages, chunkConfig);
    const avgChunkSize = chunks.length > 0
      ? Math.round(chunks.reduce((s, c) => s + c.text.length, 0) / chunks.length)
      : 0;

    // Prepare chunk texts for batch embedding
    const chunkTexts = chunks.map((chunk) => chunk.text);

    // Generate embeddings in batches (respecting rate limits)
    console.log(`Generating embeddings for ${chunkTexts.length} chunks in batches...`);
    const batchResult = await generateBatchEmbeddings(chunkTexts);

    // Store embeddings in Pinecone
    console.log("Storing embeddings in Pinecone...");
    const namespace = createPdfNamespace(filename);
    const pineconeResult = await storeEmbeddingsInPinecone({
      filename,
      namespace,
      chunks,
      embeddings: batchResult.embeddings,
    });

    let cleanupStatus: "deleted" | "kept" = "kept";
    try {
      await fs.unlink(filePath);
      cleanupStatus = "deleted";
      console.log(`Deleted uploaded PDF after successful Pinecone storage: ${filePath}`);
    } catch (cleanupError) {
      console.warn(`Could not delete uploaded PDF ${filePath}:`, cleanupError);
    }

    res.status(200).json({
      success: true,
      message: "Embeddings generated and stored in Pinecone successfully",
      data: {
        filename,
        extraction: {
          pageCount: extractionResult.pageCount,
          totalTextLength: extractionResult.text.length,
        },
        chunking: {
          totalChunks: chunks.length,
          avgChunkSize,
          config: chunkConfig,
        },
        embeddings: {
          generated: batchResult.embeddings.length,
          dimensions: batchResult.embeddings[0]?.length || 384,
          model: "BAAI/bge-small-en-v1.5",
          stored: true,
          storageType: "pinecone",
        },
        pinecone: {
          indexName: pineconeResult.indexName,
          namespace: pineconeResult.namespace,
          batches: pineconeResult.batches,
          storedVectors: pineconeResult.storedVectors,
          embeddingDimensions: pineconeResult.dimensions,
        },
        cleanup: {
          localPdf: cleanupStatus,
        },
      },
    });
  } catch (error) {
    console.error("Embedding generation controller error:", error);

    if (error instanceof Error) {
      if (error.message.includes("ENOENT")) {
        res.status(404).json({
          success: false,
          message: "PDF file not found.",
        });
        return;
      }

      if (error.message.includes("HF_TOKEN")) {
        res.status(400).json({
          success: false,
          message: "Hugging Face API token not configured. Set HF_TOKEN in .env",
        });
        return;
      }

      if (error.message.includes("PINECONE_API_KEY") || error.message.includes("PINECONE_INDEX_NAME")) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to generate embeddings.",
    });
  }
};

export const pineconeStatsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.length > 0
      ? req.query.namespace
      : undefined;

    const stats = await getPineconeStats(namespace);
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get Pinecone stats",
    });
  }
};