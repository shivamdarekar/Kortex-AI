import fs from "node:fs/promises";
const pdfParse = require("pdf-parse");
import { cleanExtractedText } from "./textCleaning.service";

export interface ExtractionResult {
  text: string;
  pageCount: number;
  pages: Array<{ pageNumber: number; text: string }>;
  rawData: any;
}

export const extractTextFromPdf = async (
  filePath: string,
): Promise<ExtractionResult> => {
  try {
    const fileBuffer = await fs.readFile(filePath);

    const pageTexts: Array<{ pageNumber: number; text: string }> = [];

    const data = await pdfParse(fileBuffer, {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent();
        const rawPageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");

        const cleanedPageText = cleanExtractedText(rawPageText || "");
        pageTexts.push({
          pageNumber: pageData.pageNumber,
          text: cleanedPageText,
        });

        return cleanedPageText;
      },
    });

    const orderedPages = pageTexts.sort((a, b) => a.pageNumber - b.pageNumber);
    const cleanedText = orderedPages.map((page) => page.text).join("\n\n");

    return {
      text: cleanedText,
      pageCount: data.numpages || 0,
      pages: orderedPages,
      rawData: data,
    };
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    throw new Error(
      `Failed to extract PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};
