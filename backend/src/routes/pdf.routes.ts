import { Router } from "express";
import { uploadPdfController } from "../controllers/pdfUpload.controller";
import { extractAndChunkController } from "../controllers/chunkingController";
import {
	generateEmbeddingsController,
	pineconeStatsController,
} from "../controllers/embeddingController";
import { retrieveChunksController } from "../controllers/retrievalController";
import { askQuestionController } from "../controllers/qaController";
import { suggestQuestionsController } from "../controllers/suggestionsController";
import { pdfUpload } from "../config/multer.config";
import { multerErrorHandler } from "../utils/errorHandler";

const router = Router();

router.post("/upload", pdfUpload, uploadPdfController, multerErrorHandler);
router.post("/extract-and-chunk", extractAndChunkController);
router.post("/generate-embeddings", generateEmbeddingsController);
router.post("/retrieve-chunks", retrieveChunksController);
router.post("/ask-question", askQuestionController);
router.post("/suggest-questions", suggestQuestionsController);
router.get("/pinecone-stats", pineconeStatsController);

export default router;
