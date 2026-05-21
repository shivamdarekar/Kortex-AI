"use client";

import dynamic from "next/dynamic";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { usePdfPipeline } from "@/hooks/usePdfPipeline";

const UploadZone = dynamic(
  () => import("@/components/upload/UploadZone").then((m) => m.UploadZone),
  { ssr: false }
);

const ChatPanel = dynamic(
  () => import("@/components/chat/ChatPanel").then((m) => m.ChatPanel),
  { ssr: false }
);

const PipelineStatsPanel = dynamic(
  () => import("@/components/upload/PipelineStatsPanel").then((m) => m.PipelineStatsPanel),
  { ssr: false }
);

export default function Home() {
  const { status, file, stats, suggestions, error, process, reset } = usePdfPipeline();

  const isBusy = ["uploading", "embedding", "processing"].includes(status);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div className="flex items-center justify-center size-7 rounded-lg bg-primary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3L7.5 8L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground"/>
              <path d="M8 11H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground"/>
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">
            Kortex <span className="text-muted-foreground font-normal">AI</span>
          </span>
          <StatusBadge status={status} />
        </div>
        {file && (
          <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[260px]">
            {file.originalName}
          </span>
        )}
        <ThemeToggle />
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — upload + pipeline stats */}
        <aside className="w-80 shrink-0 flex flex-col gap-4 p-5 border-r border-border overflow-y-auto">
          <div>
            <h1 className="text-sm font-medium mb-1">Document</h1>
            <p className="text-xs text-muted-foreground mb-4">
              Upload a PDF and ask questions using semantic search.
            </p>
            <UploadZone
              status={status}
              originalName={file?.originalName}
              error={error}
              onFile={process}
              onReset={reset}
            />
          </div>

          {isBusy && (
            <>
              <Separator />
              <UploadProgress status={status} />
            </>
          )}

          {status === "ready" && stats && (
            <>
              <Separator />
              <PipelineStatsPanel stats={stats} />
            </>
          )}
        </aside>

        {/* Right panel — chat */}
        <main className="flex-1 min-h-0 flex flex-col p-5 overflow-hidden">
          <ChatPanel filename={file?.filename ?? null} pipelineStatus={status} suggestions={suggestions} />
        </main>
      </div>
    </div>
  );
}
