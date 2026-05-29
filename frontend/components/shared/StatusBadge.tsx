import { Badge } from "@/components/ui/badge";
import type { PipelineStatus } from "@/features/pdf-rag/types";

const CONFIG: Record<PipelineStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  idle:       { label: "No document",  variant: "outline" },
  uploading:  { label: "Uploading…",   variant: "secondary" },
  processing: { label: "Processing…",  variant: "secondary" },
  embedding:  { label: "Embedding…",   variant: "secondary" },
  ready:      { label: "Ready",        variant: "default" },
  error:      { label: "Error",        variant: "destructive" },
};

export const StatusBadge = ({ status }: { status: PipelineStatus }) => {
  const { label, variant } = CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
};
