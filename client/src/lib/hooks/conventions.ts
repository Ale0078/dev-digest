/* hooks/conventions.ts — Conventions Extractor. Key: ["conventions", repoId].
   Extraction is synchronous on the server (one model call), so the mutation's
   result replaces the list in the cache directly. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ConventionCandidate, ConventionExtractResult, Skill } from "@devdigest/shared";

const key = (repoId: string | null | undefined) => ["conventions", repoId] as const;

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: key(repoId),
    queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

export function useExtractConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConventionExtractResult>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (data) => qc.setQueryData(key(repoId), data.candidates),
  });
}

export interface ConventionPatch {
  rule?: string;
  accepted?: boolean;
}

export function useUpdateConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ConventionPatch }) =>
      api.patch<ConventionCandidate>(`/repos/${repoId}/conventions/${id}`, patch),
    onSuccess: (updated) =>
      qc.setQueryData<ConventionCandidate[]>(key(repoId), (list) =>
        list?.map((c) => (c.id === updated.id ? updated : c)),
      ),
  });
}

/** Reject = the server deletes the candidate; the page keeps a dimmed snapshot. */
export function useRejectConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/repos/${repoId}/conventions/${id}`),
    onSuccess: (_data, id) =>
      qc.setQueryData<ConventionCandidate[]>(key(repoId), (list) => list?.filter((c) => c.id !== id)),
  });
}

export interface CreateConventionSkillInput {
  name: string;
  description: string;
  body: string;
  enabled: boolean;
  convention_ids: string[];
}

/** Saves a `convention` / `extracted` skill from accepted conventions. */
export function useCreateConventionSkill(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skills`, input),
    onSuccess: (skill) => {
      qc.setQueryData(["skill", skill.id], skill);
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
    },
  });
}
