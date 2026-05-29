import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { SourceChunk } from "@/features/pdf-rag/types";

export const SourcesAccordion = ({ sources }: { sources: SourceChunk[] }) => {
  if (!sources.length) return null;

  return (
    <Accordion type="single" collapsible className="mt-2">
      <AccordionItem value="sources" className="border-none">
        <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
          {sources.length} source{sources.length > 1 ? "s" : ""} retrieved
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 pt-1">
            {sources.map((src, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs space-y-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">Page {src.page}</Badge>
                  <Badge variant="outline" className="text-[10px]">Chunk #{src.chunkIndex}</Badge>
                  <span className="text-muted-foreground ml-auto">
                    score: {src.score.toFixed(3)}
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed line-clamp-3">{src.text}</p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
