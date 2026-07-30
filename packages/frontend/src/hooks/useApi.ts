/**
 * API hooks using TanStack Query for control-plane data.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = "/api/v1";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Documents ────────────────────────────────────────────────

export interface DocumentMeta {
  id: string;
  doc_type: string;
  filename: string;
  label: string | null;
  chunk_count: number;
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: () =>
      apiFetch<{ documents: DocumentMeta[] }>("/documents").then(
        (r) => r.documents,
      ),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      file: File;
      docType: string;
      label?: string;
    }) => {
      const form = new FormData();
      form.append("file", args.file);
      form.append("doc_type", args.docType);
      if (args.label) form.append("label", args.label);

      const res = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Upload failed (${res.status})`);
      }
      return res.json() as Promise<DocumentMeta>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

// ── Sessions ─────────────────────────────────────────────────

export interface SessionMeta {
  id: string;
  mode: string;
  status: string;
  resume_id: string | null;
  jd_id: string | null;
  stealth_mode: boolean;
  created_at: string;
}

export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiFetch<SessionMeta[]>("/sessions"),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      mode: "live" | "prep";
      resume_id?: string;
      jd_id?: string;
      additional_context?: string;
      stealth_mode?: boolean;
    }) =>
      apiFetch<SessionMeta>("/sessions", {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

// ── Scoring ──────────────────────────────────────────────────

export interface ScoreHistoryEntry {
  session_id: string;
  date: string;
  average_score: number;
  dimension_averages: Record<string, number>;
  weakest_dimension: string;
}

export function useScoreHistory(userId: string) {
  return useQuery({
    queryKey: ["scoreHistory", userId],
    queryFn: () =>
      apiFetch<{ entries: ScoreHistoryEntry[] }>(
        `/scoring/history/${userId}`,
      ).then((r) => r.entries),
  });
}
