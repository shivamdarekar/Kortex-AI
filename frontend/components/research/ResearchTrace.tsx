"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchStatus } from "@/features/research-agent/types";

const STAGES: { key: ResearchStatus; label: string; icon: string }[] = [
  { key: "searching",   label: "Searching the web (Tavily)",       icon: "🔍" },
  { key: "extracting",  label: "Extracting page content (Jina)",   icon: "📄" },
  { key: "summarizing", label: "Summarising evidence (Groq)",      icon: "🧠" },
  { key: "reporting",   label: "Writing full report (Groq)",       icon: "📝" },
];

const ORDER: ResearchStatus[] = ["searching", "extracting", "summarizing", "reporting", "done"];

interface Props {
  status: ResearchStatus;
}

export const ResearchTrace = ({ status }: Props) => {
  const currentIndex = ORDER.indexOf(status);

  // Reveal stages one by one as status advances
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const stageIndex = STAGES.findIndex((s) => s.key === status);
    if (stageIndex >= 0) setRevealed(stageIndex + 1);
    if (status === "done") setRevealed(STAGES.length);
  }, [status]);

  return (
    <div className="mt-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 space-y-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Research pipeline
      </p>

      {STAGES.map((stage, i) => {
        const stageOrder = ORDER.indexOf(stage.key);
        const isDone = currentIndex > stageOrder || status === "done";
        const isActive = stage.key === status;
        const isVisible = revealed > i;

        return (
          <div
            key={stage.key}
            className={cn(
              "flex items-center gap-2 text-xs transition-all duration-300",
              isVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {isActive ? (
              <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <CheckCircle2
                className={cn(
                  "size-3 shrink-0",
                  isDone ? "text-emerald-500" : "text-muted-foreground/30",
                )}
              />
            )}
            <span className="shrink-0">{stage.icon}</span>
            <span className={cn("flex-1", isActive ? "text-foreground" : "text-muted-foreground")}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
