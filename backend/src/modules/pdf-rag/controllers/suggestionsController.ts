import type { Request, Response } from "express";

import { generateTextEmbedding } from "../services/batchEmbedding.service";
import { createPdfNamespace, queryPineconeNamespace } from "../services/pinecone.service";
import { generateSuggestedQuestions } from "../services/groq.service";
import { ensureFilename } from "../../../utils/validation";

export const suggestQuestionsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const filename = ensureFilename(req.body.filename);
    const namespace = createPdfNamespace(filename);

    // Use a generic embedding to fetch a broad sample of chunks
    const embedding = await generateTextEmbedding("overview summary introduction");
    const result = await queryPineconeNamespace(namespace, embedding, 4);

    const chunks = result.matches
      .filter((m) => typeof m.metadata?.text === "string")
      .map((m) => ({
        id: m.id,
        score: m.score,
        text: String(m.metadata?.text),
        page: Number(m.metadata?.page),
        sourceFile: String(m.metadata?.filename || filename),
      }));

    const questions = await generateSuggestedQuestions(chunks);

    res.status(200).json({ success: true, data: { questions } });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate suggestions",
    });
  }
};