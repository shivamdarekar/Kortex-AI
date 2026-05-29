"use client";

import { useState, useCallback } from "react";

import { runResearch } from "../api";
import type { ResearchMessage, ResearchStatus } from "../types";

export const useResearchAgent = () => {
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [status, setStatus] = useState<ResearchStatus>("idle");

  const research = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || status === "searching" || status === "extracting" || status === "summarizing" || status === "reporting") return;

    const userMsg: ResearchMessage = {
      id: crypto.randomUUID(),
      role: "user",
      query: trimmed,
    };

    const optimisticId = crypto.randomUUID();
    const optimisticMsg: ResearchMessage = {
      id: optimisticId,
      role: "assistant",
      query: trimmed,
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, userMsg, optimisticMsg]);

    // Animate through pipeline stages while waiting
    setStatus("searching");
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    stageTimers.push(setTimeout(() => setStatus("extracting"), 3000));
    stageTimers.push(setTimeout(() => setStatus("summarizing"), 8000));
    stageTimers.push(setTimeout(() => setStatus("reporting"), 14000));

    try {
      const result = await runResearch(trimmed);
      stageTimers.forEach(clearTimeout);
      setStatus("done");

      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId
            ? { ...m, result, isOptimistic: false }
            : m,
        ),
      );
    } catch (err) {
      stageTimers.forEach(clearTimeout);
      setStatus("error");

      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId
            ? {
                ...m,
                isOptimistic: false,
                isError: true,
                errorText: err instanceof Error ? err.message : "Research failed. Please try again.",
              }
            : m,
        ),
      );
    }
  }, [status]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setStatus("idle");
  }, []);

  const isLoading = ["searching", "extracting", "summarizing", "reporting"].includes(status);

  return { messages, status, isLoading, research, clearHistory };
};
