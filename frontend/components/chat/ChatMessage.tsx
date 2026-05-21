import ReactMarkdown from "react-markdown";
import { AlertCircle } from "lucide-react";
import { ThinkingIndicator } from "@/components/shared/ThinkingIndicator";
import { SourcesAccordion } from "./SourcesAccordion";
import { RetrievalTrace } from "./RetrievalTrace";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType, RetrievalPipeline } from "@/lib/types";

// Optimistic pipeline shown while waiting — steps animate in live
const OPTIMISTIC_DOC_PIPELINE: RetrievalPipeline = {
  mode: "document",
  steps: [
    { label: "Question embedded",  ms: 0 },
    { label: "Searching Pinecone", ms: 0 },
    { label: "Chunks retrieved",   ms: 0 },
    { label: "Building context",   ms: 0 },
    { label: "Generating answer",  ms: 0 },
  ],
};

const OPTIMISTIC_GENERAL_PIPELINE: RetrievalPipeline = {
  mode: "general",
  steps: [
    { label: "Question received",  ms: 0 },
    { label: "Generating answer",  ms: 0 },
  ],
};

export const ChatMessage = ({
  message,
  mode,
}: {
  message: ChatMessageType;
  mode?: "document" | "general";
}) => {
  const isUser = message.role === "user";

  const optimisticPipeline =
    mode === "general" ? OPTIMISTIC_GENERAL_PIPELINE : OPTIMISTIC_DOC_PIPELINE;

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : message.isError
            ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {message.isOptimistic ? (
          <ThinkingIndicator />
        ) : message.isError ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Show retrieval trace only while waiting; hide it once answer arrives */}
      {!isUser && (
        <div className="w-full max-w-[85%]">
          {message.isOptimistic && (
            <RetrievalTrace pipeline={optimisticPipeline} isOptimistic />
          )}

          {!message.isOptimistic && message.sources && message.sources.length > 0 && (
            <SourcesAccordion sources={message.sources} />
          )}
        </div>
      )}

      {!isUser && message.model && !message.isOptimistic && (
        <span className="mt-1 text-[10px] text-muted-foreground px-1">{message.model}</span>
      )}
    </div>
  );
};
