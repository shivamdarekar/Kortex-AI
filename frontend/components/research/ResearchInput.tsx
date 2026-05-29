"use client";

import { useState, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export const ResearchInput = ({ onSubmit, isLoading }: Props) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const q = value.trim();
    if (!q || isLoading) return;
    onSubmit(q);
    setValue("");
    textareaRef.current?.focus();
  }, [value, isLoading, onSubmit]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={isLoading ? "Researching…" : "Ask a research question…"}
        disabled={isLoading}
        className="min-h-[44px] max-h-[160px] resize-none"
        rows={1}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            onClick={submit}
            disabled={!value.trim() || isLoading}
            aria-label="Research"
          >
            <Search />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Research (Enter)</TooltipContent>
      </Tooltip>
    </div>
  );
};
