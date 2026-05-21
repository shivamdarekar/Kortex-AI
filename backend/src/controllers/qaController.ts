import type { Request, Response } from "express";
import { generateTextEmbedding } from "../services/batchEmbedding.service";
import { createPdfNamespace, queryPineconeNamespace } from "../services/pinecone.service";
import { answerGeneralQuestionWithGroq, answerQuestionWithGroq } from "../services/groq.service";
import { ensureFilename, ensureQuestion, getTopK, getMode } from "../utils/validation";


export const askQuestionController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const filename = ensureFilename(req.body.filename);
    const question = ensureQuestion(req.body.question);
    const mode = getMode(req);
    const topK = getTopK(req.body.topK);
    const namespace = createPdfNamespace(filename);

    if (mode === "general") {
      const t0 = Date.now();
      const answerResult = await answerGeneralQuestionWithGroq({ question });

      res.status(200).json({
        success: true,
        message: "General answer generated successfully",
        data: {
          filename,
          namespace,
          question,
          mode,
          topK,
          answer: answerResult.answer,
          model: answerResult.model,
          sources: [],
          pipeline: {
            mode: "general",
            steps: [
              { label: "Question received", ms: 0 },
              { label: "Generating answer", ms: Date.now() - t0 },
            ],
          },
        },
      });
      return;
    }

    const t1 = Date.now();
    const queryEmbedding = await generateTextEmbedding(question);
    const embedMs = Date.now() - t1;

    const t2 = Date.now();
    const retrievalResult = await queryPineconeNamespace(namespace, queryEmbedding, topK);
    const retrievalMs = Date.now() - t2;

    const contextChunks = retrievalResult.matches
      .filter((match) => typeof match.metadata?.text === "string")
      .map((match) => ({
        id: match.id,
        score: match.score,
        text: String(match.metadata?.text),
        page: Number(match.metadata?.page),
        chunkIndex: Number(match.metadata?.chunkIndex),
        sourceFile: String(match.metadata?.filename || filename),
        documentId: String(match.metadata?.documentId || namespace),
      }));

    if (contextChunks.length === 0) {
      res.status(200).json({
        success: true,
        message: "No chunks were retrieved from Pinecone.",
        data: {
          filename,
          namespace,
          question,
          mode,
          topK,
          answer: "I could not find any chunks relevant enough to answer this question confidently.",
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          sources: [],
          pipeline: {
            mode: "document",
            steps: [
              { label: "Question embedded", ms: embedMs },
              { label: "Searching Pinecone", ms: retrievalMs },
              { label: "Chunks retrieved", ms: 0, value: 0 },
            ],
          },
        },
      });
      return;
    }

    const t3 = Date.now();
    const answerResult = await answerQuestionWithGroq({
      question,
      chunks: contextChunks,
    });
    const llmMs = Date.now() - t3;

    res.status(200).json({
      success: true,
      message: "Answer generated successfully",
      data: {
        filename,
        namespace,
        question,
        mode,
        topK,
        answer: answerResult.answer,
        model: answerResult.model,
        sources: contextChunks.map((chunk) => ({
          page: chunk.page,
          chunkIndex: chunk.chunkIndex,
          score: chunk.score,
          sourceFile: chunk.sourceFile,
          documentId: chunk.documentId,
          text: chunk.text,
        })),
        pipeline: {
          mode: "document",
          steps: [
            { label: "Question embedded",   ms: embedMs },
            { label: "Searching Pinecone",   ms: retrievalMs },
            { label: "Chunks retrieved",     ms: 0, value: contextChunks.length },
            { label: "Building context",     ms: 0 },
            { label: "Generating answer",    ms: llmMs },
          ],
        },
      },
    });
  } catch (error) {
    console.error("QA controller error:", error);

    if (error instanceof Error) {
      if (error.message.includes("HF_TOKEN")) {
        res.status(400).json({
          success: false,
          message: "Hugging Face API token not configured. Set HF_TOKEN in .env",
        });
        return;
      }

      if (error.message.includes("GROQ_API_KEY")) {
        res.status(400).json({
          success: false,
          message: "Groq API key not configured. Set GROQ_API_KEY in .env",
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
      message: "Failed to generate answer.",
    });
  }
};
