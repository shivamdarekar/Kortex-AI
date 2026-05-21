import Groq from "groq-sdk";
import { GROQ_CONTEXT_CHUNKS } from "../config";

export interface AnswerContextChunk {
  id: string;
  score: number;
  text: string;
  page?: number;
  chunkIndex?: number;
  sourceFile?: string;
  documentId?: string;
}

export interface AnswerQuestionInput {
  question: string;
  chunks: AnswerContextChunk[];
}

export interface GeneralAnswerQuestionInput {
  question: string;
}

export interface AnswerQuestionResult {
  answer: string;
  model: string;
  usedChunks: AnswerContextChunk[];
}

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }

  return new Groq({ apiKey });
};

const buildContext = (chunks: AnswerContextChunk[]): string => {
  return chunks
    .map((chunk, index) => {
      return `
[Chunk ${index + 1}]
Source: ${chunk.sourceFile || "unknown"}
Page: ${chunk.page ?? "unknown"}

${chunk.text}
`.trim();
    })
    .join("\n\n");
};

const createGroqCompletion = async (
  messages: Array<{ role: "system" | "user"; content: string }>,
  maxTokens = 1024,
) => {
  const groq = getGroqClient();

  return groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.1,
    max_tokens: maxTokens,
    messages,
  });
};

export const answerQuestionWithGroq = async (
  input: AnswerQuestionInput,
): Promise<AnswerQuestionResult> => {
  const limitedChunks = input.chunks.slice(0, GROQ_CONTEXT_CHUNKS);

  if (limitedChunks.length === 0) {
    return {
      answer:
        "I could not find any relevant chunks in Pinecone for this document.",
      model: GROQ_MODEL,
      usedChunks: [],
    };
  }

  const context = buildContext(limitedChunks);

  const completion = await createGroqCompletion([
    {
      role: "system",
      content: [
        `You are a grounded RAG assistant.

Answer questions using ONLY the provided context.

Guidelines:
- Use the context to make reasonable grounded inferences
- Do not invent unsupported facts
- If the document partially mentions a topic, provide the best grounded explanation possible
- Do not be overly defensive when enough contextual evidence exists
- If information is truly missing, clearly say so
- Summarize naturally and clearly
- Cite page numbers when available
- Keep answers concise but informative
- Identify the document type if obvious from context`,
      ].join(" "),
    },
    {
      role: "user",
      content: `
Question:
${input.question}

Context:
${context}

Answer using the context above.
Use grounded reasoning and concise explanations.
`,
    },
  ]);

  const answer =
    completion.choices[0]?.message?.content?.trim() || "No answer generated.";

  return {
    answer,
    model: GROQ_MODEL,
    usedChunks: limitedChunks,
  };
};

export const answerGeneralQuestionWithGroq = async (
  input: GeneralAnswerQuestionInput,
): Promise<AnswerQuestionResult> => {
  const completion = await createGroqCompletion([
    {
      role: "system",
      content: [
        "You are a helpful general knowledge assistant.",
        "Answer the question directly using your own knowledge.",
        "Do not claim to read from a document unless context is provided.",
        "Be concise, accurate, and structure the answer clearly.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Question: ${input.question}`,
    },
  ]);

  const answer =
    completion.choices[0]?.message?.content?.trim() || "No answer generated.";

  return {
    answer,
    model: GROQ_MODEL,
    usedChunks: [],
  };
};

export const generateSuggestedQuestions = async (
  chunks: AnswerContextChunk[],
): Promise<string[]> => {
  const context = buildContext(chunks.slice(0, 4));

  const completion = await createGroqCompletion([
    {
      role: "system",
      content: "You are a helpful assistant. Given document excerpts, generate exactly 3 short, specific questions a user might want to ask about this document. Return ONLY a JSON array of 3 strings, no explanation, no markdown.",
    },
    {
      role: "user",
      content: `Document excerpts:\n${context}\n\nReturn exactly: ["question1", "question2", "question3"]`,
    },
  ], 120); // 3 short questions need very few tokens

  const raw = completion.choices[0]?.message?.content?.trim() || "[]";

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String);
  } catch {
    // fallback: extract quoted strings
    const matches = raw.match(/"([^"]+)"/g);
    if (matches) return matches.slice(0, 3).map((s) => s.replace(/"/g, ""));
  }

  return [];
};
