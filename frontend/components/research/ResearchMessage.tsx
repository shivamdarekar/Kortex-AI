import { AlertCircle } from "lucide-react";
import { ThinkingIndicator } from "@/components/shared/ThinkingIndicator";
import { ResearchTrace } from "./ResearchTrace";
import { ResearchReport } from "./ResearchReport";
import { cn } from "@/lib/utils";
import type { ResearchMessage as ResearchMessageType, ResearchStatus } from "@/features/research-agent/types";

interface Props {
  message: ResearchMessageType;
  liveStatus: ResearchStatus;
}

export const ResearchMessage = ({ message, liveStatus }: Props) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col w-full", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "w-full max-w-[96%] rounded-3xl px-6 py-5 text-sm transition-all duration-200",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-lg"
            : message.isError
            ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-lg"
            : "bg-background border border-border/60 rounded-bl-lg shadow-sm hover:border-border/80",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap font-medium">{message.query}</p>
        ) : message.isOptimistic ? (
          <ThinkingIndicator />
        ) : message.isError ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <p className="whitespace-pre-wrap">{message.errorText}</p>
          </div>
        ) : message.result ? (
          <ResearchReport result={message.result} />
        ) : null}
      </div>

      {/* Live pipeline trace while optimistic */}
      {!isUser && message.isOptimistic && (
        <div className="w-full max-w-[96%] mt-2">
          <ResearchTrace status={liveStatus} />
        </div>
      )}

      {/* Timestamp after done */}
      {!isUser && !message.isOptimistic && message.result && (
        <span className="mt-2 px-2 text-xs text-muted-foreground">
          {new Date(message.result.generatedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};
