"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { useChat } from "@/features/pdf-rag/hooks/useChat";
import type { PipelineStatus } from "@/features/pdf-rag/types";

interface Props {
  filename: string | null;
  pipelineStatus: PipelineStatus;
  suggestions: string[];
}

export const ChatPanel = ({ filename, pipelineStatus, suggestions }: Props) => {
  const { messages, isLoading, mode, setMode, ask, clearHistory } = useChat(filename);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isReady = pipelineStatus === "ready";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-medium text-muted-foreground">Chat</h2>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon-sm" onClick={clearHistory} aria-label="Clear chat">
            <Trash2 />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-center">
            {isReady && suggestions.length > 0 ? (
              <SuggestedQuestions questions={suggestions} onSelect={ask} />
            ) : (
              <p className="text-sm text-muted-foreground max-w-[200px]">
                {isReady
                  ? "Ask a question about your document"
                  : "Upload a PDF to start chatting"}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} mode={mode} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={ask}
        isLoading={isLoading}
        disabled={!isReady && mode === "document"}
        mode={mode}
        onModeChange={setMode}
      />
    </div>
  );
};
