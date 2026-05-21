// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import pdfRoutes from "./routes/pdf.routes";
import { globalErrorHandler } from "./utils/errorHandler";
import { PORT } from "./config";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/pdf", pdfRoutes);

app.get("/", (_, res) => {
  res.send("PDF RAG API Running");
});

// Global error handler (must be last middleware)
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});