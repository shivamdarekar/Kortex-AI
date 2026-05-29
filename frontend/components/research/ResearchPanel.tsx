"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResearchMessage } from "./ResearchMessage";
import { ResearchInput } from "./ResearchInput";
import { useResearchAgent } from "@/features/research-agent/hooks/useResearchAgent";

export const ResearchPanel = () => {
  const { messages, status, isLoading, research, clearHistory } = useResearchAgent();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-medium text-muted-foreground">Research</h2>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon-sm" onClick={clearHistory} aria-label="Clear research">
            <Trash2 />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground max-w-[240px] text-center">
              Ask a research question — the agent will search the web, extract content, and write a
              grounded report.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {messages.map((msg) => (
              <ResearchMessage key={msg.id} message={msg} liveStatus={status} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ResearchInput onSubmit={research} isLoading={isLoading} />
    </div>
  );
};
