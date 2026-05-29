import axios from "axios";

import type { ResearchResult } from "./types";

const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_RESEARCH_AGENT_API_URL ??
    "http://localhost:5000/api/research-agent",
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err?.response?.data?.message ||
      (err?.code === "ERR_NETWORK" ? "Cannot reach the server. Is the backend running?" : null) ||
      err?.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  },
);

export const runResearch = async (query: string): Promise<ResearchResult> => {
  const { data } = await api.post<{ success: boolean; data: ResearchResult }>("/research", {
    query,
  });
  return data.data;
};
