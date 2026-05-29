import ReactMarkdown from "react-markdown";
import { ExternalLink } from "lucide-react";
import type { ResearchResult } from "@/features/research-agent/types";

interface Props {
  result: ResearchResult;
}

export const ResearchReport = ({ result }: Props) => (
  <div className="flex flex-col gap-8 py-2">
    {/* Summary Section */}
    {result.summary && (
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-linear-to-r from-blue-500 to-cyan-500" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Key Insights
          </p>
        </div>
        <div className="rounded-2xl border border-blue-500/20 bg-linear-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 px-6 py-5 backdrop-blur-sm">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm prose-p:my-1.5 prose-ul:my-2 prose-li:my-0.5 prose-li:marker:text-blue-600 dark:prose-li:marker:text-blue-400">
            <ReactMarkdown>{result.summary}</ReactMarkdown>
          </div>
        </div>
      </div>
    )}

    {result.usedFallback && (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        <p className="font-medium">⚠ Fallback mode</p>
        <p className="mt-1 text-amber-600 dark:text-amber-300">GROQ_API_KEY not configured. Limited report generation available.</p>
      </div>
    )}

    {/* Full Report Section */}
    <div className="flex flex-col gap-4">
      <div className="prose prose-sm dark:prose-invert max-w-none text-sm prose-p:my-4 prose-p:leading-relaxed prose-headings:scroll-mt-24 prose-h1:mt-8 prose-h1:mb-4 prose-h1:text-2xl prose-h1:font-bold prose-h1:leading-tight prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-lg prose-h2:font-semibold prose-h2:text-foreground prose-h2:border-l-4 prose-h2:border-primary/40 prose-h2:pl-4 prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-base prose-h3:font-semibold prose-ul:my-4 prose-ol:my-4 prose-li:my-2 prose-li:marker:font-semibold prose-li:marker:text-primary/60 prose-strong:font-semibold prose-strong:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-a:text-primary prose-a:underline prose-a:decoration-primary/30 hover:prose-a:decoration-primary/60">
        <ReactMarkdown>{result.report}</ReactMarkdown>
      </div>
    </div>

    {/* Sources Section */}
    {result.sources.length > 0 && (
      <div className="flex flex-col gap-3 border-t border-border/50 pt-6">
        <div className="inline-flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-linear-to-r from-emerald-500 to-teal-500" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sources ({result.sources.length})
          </p>
        </div>
        <div className="grid gap-2">
          {result.sources.map((source, index) => (
            <a
              key={`${source.url ?? source.sourceLink}-${index}`}
              href={source.sourceLink || source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-xs transition-all duration-200 hover:border-primary/60 hover:bg-background hover:shadow-md"
            >
              <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:text-primary group-hover:scale-110" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="line-clamp-2 font-medium text-foreground group-hover:text-primary transition-colors leading-5">
                  {source.title || source.url}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{source.url}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    )}
  </div>
);
