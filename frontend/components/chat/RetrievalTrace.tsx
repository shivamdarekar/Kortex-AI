"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetrievalPipeline } from "@/lib/types";

const STEP_ICONS: Record<string, string> = {
  "Question embedded":   "🔢",
  "Searching Pinecone":  "🔍",
  "Chunks retrieved":    "📄",
  "Building context":    "🧩",
  "Generating answer":   "🤖",
  "Question received":   "💬",
};

interface Props {
  pipeline: RetrievalPipeline;
  isOptimistic?: boolean;
}

export const RetrievalTrace = ({ pipeline, isOptimistic }: Props) => {
  const [revealed, setRevealed] = useState(isOptimistic ? 0 : pipeline.steps.length);

  // When optimistic (still loading), animate steps one by one
  useEffect(() => {
    if (!isOptimistic) {
      setRevealed(pipeline.steps.length);
      return;
    }
    setRevealed(0);
    pipeline.steps.forEach((_, i) => {
      setTimeout(() => setRevealed(i + 1), i * 600);
    });
  }, [isOptimistic, pipeline.steps]);

  return (
    <div className="mt-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 space-y-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {pipeline.mode === "general" ? "General knowledge" : "RAG pipeline"}
      </p>

      {pipeline.steps.map((step, i) => {
        const isActive = isOptimistic && i === revealed - 1;
        const isDone = revealed > i;

        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 text-xs transition-all duration-300",
              isDone ? "opacity-100" : "opacity-0"
            )}
          >
            {isActive && isOptimistic ? (
              <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
            )}

            <span className="shrink-0">{STEP_ICONS[step.label] ?? "▸"}</span>

            <span className={cn("flex-1", isActive ? "text-foreground" : "text-muted-foreground")}>
              {step.label}
              {step.value !== undefined && step.value > 0 && (
                <span className="ml-1 font-medium text-foreground">({step.value})</span>
              )}
            </span>

            {!isOptimistic && step.ms > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">{step.ms}ms</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
