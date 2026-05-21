import type { Request, Response } from "express";
import { generateTextEmbedding } from "../services/batchEmbedding.service";
import { createPdfNamespace, queryPineconeNamespace } from "../services/pinecone.service";
import { ensureFilename, ensureQuestion, getTopK } from "../utils/validation";

export const retrieveChunksController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const filename = ensureFilename(req.body.filename);
    const question = ensureQuestion(req.body.question);
    const topK = getTopK(req.body.topK);
    const namespace = createPdfNamespace(filename);

    const queryEmbedding = await generateTextEmbedding(question);
    const retrievalResult = await queryPineconeNamespace(namespace, queryEmbedding, topK);

    res.status(200).json({
      success: true,
      message: "Retrieved matching chunks successfully",
      data: {
        filename,
        namespace,
        question,
        topK,
        matches: retrievalResult.matches.map((match) => ({
          id: match.id,
          score: match.score,
          page: match.metadata?.page,
          chunkIndex: match.metadata?.chunkIndex,
          chunkHash: match.metadata?.chunkHash,
          chunkLength: match.metadata?.chunkLength,
          text: match.metadata?.text,
          sourceFile: match.metadata?.filename,
          documentId: match.metadata?.documentId,
        })),
      },
    });
  } catch (error) {
    console.error("Retrieval controller error:", error);

    if (error instanceof Error) {
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
      message: "Failed to retrieve chunks.",
    });
  }
};
