import type { Request, Response } from "express";
import { extractTextFromPdf } from "../services/pdfExtraction.service";
import { createChunks, analyzeChunks } from "../services/chunkingService";
import { ensureFilename, buildSafeFilePath } from "../utils/validation";
import { DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP } from "../config";

export const extractAndChunkController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const filename = ensureFilename(req.body.filename);
    const filePath = buildSafeFilePath(filename);

    // Extract text from PDF
    const extractionResult = await extractTextFromPdf(filePath);

    // Chunk the extracted text using semantic-recursive strategy
    const chunkConfig = {
      chunkSize: Number(req.body.chunkSize) || DEFAULT_CHUNK_SIZE,
      overlapSize: Number(req.body.overlapSize) || DEFAULT_OVERLAP,
    };

    const chunks = createChunks(extractionResult.pages, chunkConfig);
    const analysis = analyzeChunks(chunks);

    res.status(200).json({
      success: true,
      message: "PDF extracted and chunked successfully",
      data: {
        filename,
        extraction: {
          pageCount: extractionResult.pageCount,
          totalTextLength: extractionResult.text.length,
        },
        chunking: {
          config: chunkConfig,
          analysis,
          chunks,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("ENOENT")) {
        res.status(404).json({
          success: false,
          message: "PDF file not found.",
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
      message: "Failed to extract and chunk PDF.",
    });
  }
};
