import { ChatGroq } from "@langchain/groq";

import { getOptionalEnv } from "../utils/env";

export function createGroqModel(): ChatGroq | null {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new ChatGroq({
    apiKey,
    model: getOptionalEnv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    temperature: 0.2,
  });
}