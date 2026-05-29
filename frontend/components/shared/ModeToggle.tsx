"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const ModeToggle = () => {
  const pathname = usePathname();
  const isResearch = pathname === "/research";

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-border/60 bg-muted/30 backdrop-blur-sm">
      <Link
        href="/"
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
          !isResearch
            ? "bg-background text-foreground shadow-sm border border-border/40"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="PDF Chat - Upload and chat with your documents"
      >
        <FileText className="size-3.5" />
        <span className="hidden sm:inline">PDF Chat</span>
      </Link>
      <Link
        href="/research"
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
          isResearch
            ? "bg-background text-foreground shadow-sm border border-border/40"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Research Agent - Search and generate reports"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Research</span>
      </Link>
    </div>
  );
};
