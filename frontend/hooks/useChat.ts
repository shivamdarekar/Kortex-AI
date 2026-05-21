"use client";

import { useState, useCallback } from "react";
import { askQuestion } from "@/lib/api";
import type { ChatMessage, ChatMode } from "@/lib/types";

export const useChat = (filename: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("document");

  const ask = useCallback(
    async (question: string) => {
      if (!question.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      };

      const optimisticId = crypto.randomUUID();
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        role: "assistant",
        content: "",
        isOptimistic: true,
      };

      setMessages((prev) => [...prev, userMsg, optimisticMsg]);
      setIsLoading(true);

      try {
        const result = await askQuestion(filename ?? "", question, mode);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  content: result.answer,
                  sources: result.sources,
                  model: result.model,
                  pipeline: result.pipeline,
                  isOptimistic: false,
                }
              : m
          )
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  content: err instanceof Error ? err.message : "Failed to get an answer. Please try again.",
                  isOptimistic: false,
                  isError: true,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [filename, isLoading, mode]
  );

  const clearHistory = useCallback(() => setMessages([]), []);

  return { messages, isLoading, mode, setMode, ask, clearHistory };
};
