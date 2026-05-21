import { Sparkles } from "lucide-react";

interface Props {
  questions: string[];
  onSelect: (q: string) => void;
}

export const SuggestedQuestions = ({ questions, onSelect }: Props) => {
  if (!questions.length) return null;

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3" />
        <span>Suggested questions</span>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="text-left text-sm px-4 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted hover:border-ring transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};
