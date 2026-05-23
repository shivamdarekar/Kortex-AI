import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { enrichSourcesWithReadableContent } from "../services/extraction.service";
import { createGroqModel } from "../services/llm.service";
import {
  buildEvidenceBlock,
  buildFallbackReport,
  toPublicSources,
} from "../services/report.service";
import { getResearchSources } from "../services/search.service";
import type { ResearchResult } from "../types";

export async function runResearchWorkflow(query: string): Promise<ResearchResult> {
  console.log("[research] workflow started", { query });

  console.log("[research] running Tavily search");
  const sources = await getResearchSources(query);
  console.log("[research] search complete", { count: sources.length });

  const topSources = sources.slice(0, 5);

  console.log("[research] extracting readable content", {
    count: topSources.length,
  });
  const sourcesWithContent = await enrichSourcesWithReadableContent(topSources);
  console.log("[research] extraction complete");

  const evidence = buildEvidenceBlock(sourcesWithContent);
  const model = createGroqModel();

  if (!model) {
    console.log("[research] GROQ_API_KEY missing, using fallback report mode");

    const summary =
      "No GROQ_API_KEY is configured. Search and extraction completed, but report generation is running in fallback mode.";

    console.log("[research] workflow finished in fallback mode");

    return {
      query,
      summary,
      report: buildFallbackReport(query, sourcesWithContent, summary),
      sources: toPublicSources(sourcesWithContent),
      generatedAt: new Date().toISOString(),
      usedFallback: true,
    };
  }

  const summaryPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
You are an expert research analyst.

Your task:
- analyze the provided evidence carefully
- extract the most important findings
- identify tradeoffs and patterns
- avoid generic statements
- do not invent information
- only use evidence provided

Focus on:
- key insights
- practical implications
- advantages/disadvantages
- consensus across sources
- conflicting viewpoints if present

Keep the response concise and information-dense.
`,
    ],
    [
      "user",
      `
Research Question:
{query}

Evidence:
{evidence}

Generate:
- 4 to 6 concise bullet points
- each bullet should contain a meaningful insight
- avoid repetition
- avoid marketing language
`,
    ],
  ]);

  const reportPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
You are a senior technical research writer.

Write grounded, evidence-based markdown reports.

Rules:
- use ONLY the provided evidence
- do not invent facts
- do not exaggerate claims
- synthesize information across sources
- highlight tradeoffs and practical considerations
- prefer clarity over verbosity
- avoid generic filler text
- cite sources when relevant
- keep recommendations realistic and evidence-backed

The report should feel analytical, concise, and actionable.
`,
    ],
    [
      "user",
      `
Research Question:
{query}

Summary:
{summary}

Evidence:
{evidence}

Generate a markdown report with these sections:

# Overview
Brief explanation of the topic.

# Key Findings
Most important insights synthesized from evidence.

# Tradeoffs / Comparisons
Important advantages, disadvantages, or competing perspectives.

# Recommendation
Most practical recommendation based on evidence.

# Caveats
Limitations, risks, or uncertainty areas.

# Sources
List referenced source titles or URLs.

Requirements:
- keep sections concise
- avoid repeating the same points
- prefer analytical writing over generic summaries
- do not include unsupported claims
`,
    ],
  ]);

  const parser = new StringOutputParser();

  console.log("[research] generating summary");
  const summary = await summaryPrompt.pipe(model).pipe(parser).invoke({
    query,
    evidence,
  });

  console.log("[research] generating final report");

  const report = await reportPrompt.pipe(model).pipe(parser).invoke({
    query,
    summary,
    evidence,
  });

  console.log("[research] workflow completed successfully");

  return {
    query,
    summary,
    report,
    sources: toPublicSources(sourcesWithContent),
    generatedAt: new Date().toISOString(),
    usedFallback: false,
  };
}