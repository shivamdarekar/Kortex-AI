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

  const parser = new StringOutputParser();

  console.log("[research] generating summary");
  const summary = await summaryPrompt.pipe(model).pipe(parser).invoke({
    query,
    evidence,
  });

  console.log("[research] generating final report");

  const writerPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are an expert research writer. Write clear, structured and insightful reports.",
    ],
    [
      "human",
      `Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report as:
- Introduction
- Key Findings (minimum 3 well-explained points)
- Conclusion

IMPORTANT RULES:
- DO NOT include a Sources or References section in the report
- DO NOT include URLs or source citations in the report
- Focus only on the content analysis and insights
- Be detailed, factual and professional.`,
    ],
  ]);

  const criticPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a sharp and constructive research critic. Be honest and specific.",
    ],
    [
      "human",
      `Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this exact format:

Score: X/10

Strengths:
- ...
- ...

Areas to Improve:
- ...
- ...

One line verdict:
...`,
    ],
  ]);

  const report = await writerPrompt.pipe(model).pipe(parser).invoke({
    query,
    topic: query,
    research: `${summary}\n\n${evidence}`,
  });

  const critique = await criticPrompt.pipe(model).pipe(parser).invoke({
    report,
  });

  console.log("[research] report critique", critique);

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