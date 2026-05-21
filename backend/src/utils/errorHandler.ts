import type { Request, Response, NextFunction } from "express";
import multer from "multer";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const multerErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        message: "File too large. Maximum size is 10 MB.",
        error: err.code,
      });
      return;
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        success: false,
        message: "Only one file is allowed.",
        error: err.code,
      });
      return;
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({
        success: false,
        message: "Unexpected file field.",
        error: err.code,
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: err.message,
      error: err.code,
    });
    return;
  }

  if (err instanceof Error) {
    if (err.message === "Only PDF files are allowed.") {
      res.status(400).json({
        success: false,
        message: err.message,
        error: "INVALID_FILE_TYPE",
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: err.message,
      error: "FILE_UPLOAD_ERROR",
    });
    return;
  }

  next(err);
};

const mapExternalServiceError = (err: unknown): ApiError | null => {
  if (!(err instanceof Error)) return null;

  const msg = err.message || "";

  // Env / config problems
  if (msg.includes("HF_TOKEN")) {
    return new ApiError(400, "Hugging Face API token not configured. Set HF_TOKEN in .env");
  }

  if (msg.includes("PINECONE_API_KEY") || msg.includes("PINECONE_INDEX_NAME")) {
    return new ApiError(400, msg);
  }

  if (msg.includes("GROQ_API_KEY")) {
    return new ApiError(400, "Groq API key not configured. Set GROQ_API_KEY in .env");
  }

  // Rate limiting / upstream 429s
  if (msg.match(/rate limit|429|throttl/i)) {
    return new ApiError(429, "Upstream rate limit exceeded. Try again later.");
  }

  // Network / upstream availability issues
  if (msg.match(/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/)) {
    return new ApiError(502, "Upstream service unavailable. Try again later.");
  }

  return null;
};

export const globalErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // If controllers threw ApiError, forward cleanly
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  // Map known external service errors to friendly ApiError responses
  const mapped = mapExternalServiceError(err);
  if (mapped) {
    res.status(mapped.statusCode).json({ success: false, message: mapped.message });
    return;
  }

  // Fallback: expose minimal error info in non-prod
  const isProd = process.env.NODE_ENV === "production";
  if (err instanceof Error) {
    res.status(500).json({
      success: false,
      message: isProd ? "Internal server error" : err.message,
    });
    return;
  }

  res.status(500).json({ success: false, message: "Unknown server error" });
};
