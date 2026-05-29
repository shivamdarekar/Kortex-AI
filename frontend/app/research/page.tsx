"use client";

import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ModeToggle } from "@/components/shared/ModeToggle";

const ResearchPanel = dynamic(
  () => import("@/components/research/ResearchPanel").then((m) => m.ResearchPanel),
  { ssr: false },
);

export default function ResearchPage() {
  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-7 rounded-lg bg-primary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3L7.5 8L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground" />
              <path d="M8 11H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">
            Kortex <span className="text-muted-foreground font-normal">AI</span>
          </span>
          <span className="text-xs text-muted-foreground border border-border rounded-md px-2 py-0.5">
            Research Agent
          </span>
        </div>

        <nav className="flex items-center gap-4">
          <ModeToggle />
          <ThemeToggle />
        </nav>
      </header>

      {/* Main layout — full width, no sidebar needed */}
      <main className="flex-1 min-h-0 flex flex-col max-w-3xl w-full mx-auto p-5 overflow-hidden">
        <ResearchPanel />
      </main>
    </div>
  );
}
