"use client";

import { useRef, useState, useCallback } from "react";
import { UploadCloud, FileText, X, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineStatus } from "@/lib/types";

interface Props {
  status: PipelineStatus;
  originalName?: string;
  error?: string | null;
  onFile: (file: File) => void;
  onReset: () => void;
}

const BUSY: PipelineStatus[] = ["uploading", "embedding", "processing"];

export const UploadZone = ({ status, originalName, error, onFile, onReset }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isBusy = BUSY.includes(status);
  const isReady = status === "ready";
  const isError = status === "error";

  const handleFile = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        setLocalError("Only PDF files are supported.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setLocalError("File exceeds the 10 MB limit.");
        return;
      }
      setLocalError(null);
      onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const displayError = localError ?? error;

  // Ready state
  if (isReady && originalName) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="size-4 text-muted-foreground" />
          <span className="font-medium truncate max-w-[180px]">{originalName}</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onReset} aria-label="Remove PDF">
          <X />
        </Button>
      </div>
    );
  }

  // Error state
  if (isError && displayError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-destructive">Processing failed</p>
            <p className="text-xs text-destructive/80 break-words">{displayError}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => { onReset(); inputRef.current?.click(); }}
        >
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
    );
  }

  // Default / drag-drop state
  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload PDF"
        onClick={() => !isBusy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !isBusy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
          dragging ? "border-ring bg-accent" : "border-border hover:border-ring hover:bg-accent/50",
          isBusy && "pointer-events-none opacity-60"
        )}
      >
        <UploadCloud className="size-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Max 10 MB · PDF only</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {localError && (
        <div className="flex items-center gap-2 px-1">
          <AlertCircle className="size-3.5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{localError}</p>
        </div>
      )}
    </div>
  );
};
