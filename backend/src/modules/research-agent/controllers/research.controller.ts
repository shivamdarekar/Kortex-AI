import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../../../utils/errorHandler";
import { normalizeWhitespace } from "../utils/text";
import { runResearchWorkflow } from "../workflows/research.workflow";

function readQueryFromBody(body: unknown): string {
  if (!body || typeof body !== "object" || !("query" in body)) {
    throw new ApiError(400, "query is required");
  }

  const rawQuery = (body as { query?: unknown }).query;

  if (typeof rawQuery !== "string") {
    throw new ApiError(400, "query must be a string");
  }

  const query = normalizeWhitespace(rawQuery);

  if (query.length < 3) {
    throw new ApiError(400, "query must be at least 3 characters");
  }

  if (query.length > 300) {
    throw new ApiError(400, "query must be 300 characters or fewer");
  }

  return query;
}

export async function handleResearchRequest(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = readQueryFromBody(request.body);
    const result = await runResearchWorkflow(query);

    response.status(200).json({
      success: true,
      message: "Research report generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}