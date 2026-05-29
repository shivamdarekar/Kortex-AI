import { Progress } from "@/components/ui/progress";
import type { PipelineStatus } from "@/features/pdf-rag/types";

const STEPS: { status: PipelineStatus; label: string; value: number }[] = [
  { status: "uploading",  label: "Uploading PDF",       value: 33 },
  { status: "embedding",  label: "Generating embeddings", value: 66 },
  { status: "ready",      label: "Ready to chat",        value: 100 },
];

export const UploadProgress = ({ status }: { status: PipelineStatus }) => {
  const current = STEPS.find((s) => s.status === status);
  if (!current) return null;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{current.label}</span>
        <span>{current.value}%</span>
      </div>
      <Progress value={current.value} className="h-1.5" />
    </div>
  );
};
