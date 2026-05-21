"use client";

import { useState, useCallback } from "react";
import { uploadPdf, generateEmbeddings, fetchSuggestedQuestions } from "@/lib/api";
import type { PipelineStatus, UploadedFile, PipelineStats } from "@/lib/types";

interface PipelineState {
  status: PipelineStatus;
  file: UploadedFile | null;
  stats: PipelineStats | null;
  suggestions: string[];
  error: string | null;
  uploadDone: boolean;
  embeddingDone: boolean;
}

export const usePdfPipeline = () => {
  const [state, setState] = useState<PipelineState>({
    status: "idle",
    file: null,
    stats: null,
    suggestions: [],
    error: null,
    uploadDone: false,
    embeddingDone: false,
  });

  const set = (partial: Partial<PipelineState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  const process = useCallback(async (rawFile: File) => {
    set({ status: "uploading", error: null, file: null, stats: null, suggestions: [], uploadDone: false, embeddingDone: false });

    try {
      const uploaded = await uploadPdf(rawFile);
      set({ file: uploaded, status: "embedding", uploadDone: true });

      const stats = await generateEmbeddings(uploaded.filename);
      set({ status: "ready", stats, embeddingDone: true });

      // Non-blocking — don't fail the pipeline if suggestions error
      fetchSuggestedQuestions(uploaded.filename)
        .then((suggestions) => set({ suggestions }))
        .catch(() => {});
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      status: "idle",
      file: null,
      stats: null,
      suggestions: [],
      error: null,
      uploadDone: false,
      embeddingDone: false,
    });
  }, []);

  return { ...state, process, reset };
};
