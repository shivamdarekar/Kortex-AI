"use client";

import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/lib/types";

interface Props {
  onSend: (question: string) => void;
  isLoading: boolean;
  disabled: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

export const ChatInput = ({ onSend, isLoading, disabled, mode, onModeChange }: Props) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const q = value.trim();
    if (!q || isLoading || disabled) return;
    onSend(q);
    setValue("");
    textareaRef.current?.focus();
  }, [value, isLoading, disabled, onSend]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
        {(["document", "general"] as ChatMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize",
              mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "document" ? "📄 Document" : "🌐 General"}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            disabled
              ? "Upload and process a PDF first…"
              : mode === "document"
              ? "Ask about the document…"
              : "Ask anything…"
          }
          disabled={disabled || isLoading}
          className="min-h-[44px] max-h-[160px] resize-none"
          rows={1}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              onClick={submit}
              disabled={!value.trim() || isLoading || disabled}
              aria-label="Send"
            >
              <Send />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Send (Enter)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
