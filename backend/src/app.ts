import express from "express";
import cors from "cors";

import pdfRagRoutes from "./modules/pdf-rag";
import researchAgentRoutes from "./modules/research-agent";
import { globalErrorHandler } from "./utils/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/pdf", pdfRagRoutes);
app.use("/api/research-agent", researchAgentRoutes);

app.get("/", (_, res) => {
  res.send("Kortex AI API Running");
});

// Global error handler (must be last middleware)
app.use(globalErrorHandler);

export { app };