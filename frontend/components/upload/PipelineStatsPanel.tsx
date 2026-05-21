"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Layers, Cpu, Database } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PipelineStats } from "@/lib/types";

interface Step {
  icon: React.ReactNode;
  label: string;
  detail: string;
}

const buildSteps = (stats: PipelineStats): Step[] => [
  {
    icon: <FileText className="size-3.5" />,
    label: "PDF extracted",
    detail: `${stats.pageCount} page${stats.pageCount !== 1 ? "s" : ""} · ${(stats.totalTextLength / 1000).toFixed(1)}k chars`,
  },
  {
    icon: <Layers className="size-3.5" />,
    label: "Semantic chunks created",
    detail: `${stats.totalChunks} chunks · ~${stats.avgChunkSize} chars avg`,
  },
  {
    icon: <Cpu className="size-3.5" />,
    label: "Embeddings generated",
    detail: `${stats.embeddingDimensions}‑dim vectors · ${stats.embeddingModel}`,
  },
  {
    icon: <Database className="size-3.5" />,
    label: "Vectors stored in Pinecone",
    detail: `${stats.storedVectors} vectors · ns: ${stats.pineconeNamespace}`,
  },
];

export const PipelineStatsPanel = ({ stats }: { stats: PipelineStats }) => {
  const steps = buildSteps(stats);
  const [visible, setVisible] = useState(0);

  // Stagger each step appearing
  useEffect(() => {
    setVisible(0);
    steps.forEach((_, i) => {
      setTimeout(() => setVisible(i + 1), i * 220);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Processing complete
      </p>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2.5 transition-all duration-300",
              visible > i ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            )}
          >
            <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium leading-tight">{step.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                {step.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Pages",      value: stats.pageCount },
          { label: "Chunks",     value: stats.totalChunks },
          { label: "Dimensions", value: stats.embeddingDimensions },
          { label: "Vectors",    value: stats.storedVectors },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-base font-semibold tabular-nums">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
