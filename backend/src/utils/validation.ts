import type { Request } from "express";
import path from "node:path";
import { UPLOADS_DIR } from "../config";
import { ApiError } from "./errorHandler";

export const ensureFilename = (value: unknown): string => {
  if (!value || typeof value !== "string") {
    throw new ApiError(400, "filename is required in request body.");
  }
  return value;
};

export const ensureQuestion = (value: unknown): string => {
  if (!value || typeof value !== "string") {
    throw new ApiError(400, "question is required in request body.");
  }
  return value;
};

export const buildSafeFilePath = (filename: string): string => {
  const uploadsDir = UPLOADS_DIR;
  const filePath = path.join(uploadsDir, filename);

  if (!filePath.startsWith(uploadsDir)) {
    throw new ApiError(400, "Invalid file path.");
  }

  return filePath;
};

export const getTopK = (val: unknown): number => {
  const parsed = Number(val);
  if (Number.isNaN(parsed) || !isFinite(parsed) || parsed <= 0) return 5;
  return Math.floor(parsed);
};

export const getMode = (req: Request): "document" | "general" => {
  return req.body?.mode === "general" ? "general" : "document";
};
