/* hooks/skills.ts — React Query hooks for the M2 Skills screens + the agent
   editor's Skills tab. Keys: ["skills"], ["skill", id], ["skill-versions", id],
   ["skill-stats", id], ["agent-skills", agentId], ["skill-token-count", text]. */
"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AgentSkillLink,
  Skill,
  SkillImportPreview,
  SkillStats,
  SkillType,
  SkillVersion,
} from "@devdigest/shared";

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export function useSkillStats(id: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["skill-stats", id],
    queryFn: () => api.get<SkillStats>(`/skills/${id}/stats`),
    enabled: !!id && (opts?.enabled ?? true),
  });
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  /** Server forces `imported` skills to disabled. */
  source?: "manual" | "imported";
  enabled?: boolean;
  message?: string;
}

export type UpdateSkillPatch = Partial<
  Pick<Skill, "name" | "description" | "type" | "body" | "enabled"> & { message: string }
>;

/** Everything a skill mutation can change: the list, the detail, its history,
    and (via the global toggle / delete cascade) every agent's link list. */
function invalidateSkillDerived(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["skills"] });
  qc.invalidateQueries({ queryKey: ["agent-skills"] });
  if (id) {
    qc.invalidateQueries({ queryKey: ["skill-versions", id] });
    qc.invalidateQueries({ queryKey: ["skill-stats", id] });
  }
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: (data) => {
      qc.setQueryData(["skill", data.id], data);
      invalidateSkillDerived(qc);
    },
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateSkillPatch }) =>
      api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.setQueryData(["skill", data.id], data);
      invalidateSkillDerived(qc, data.id);
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: ["skill", id] });
      qc.removeQueries({ queryKey: ["skill-versions", id] });
      qc.removeQueries({ queryKey: ["skill-stats", id] });
      invalidateSkillDerived(qc);
    },
  });
}

export function useRestoreSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post<Skill>(`/skills/${id}/versions/${version}/restore`),
    onSuccess: (data) => {
      qc.setQueryData(["skill", data.id], data);
      invalidateSkillDerived(qc, data.id);
    },
  });
}

/** Parse an uploaded .md/.zip into an editable preview. Writes nothing. */
export function useImportSkillPreview() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<SkillImportPreview>("/skills/import/preview", form);
    },
  });
}

/** Debounce a fast-changing value (e.g. textarea content). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/** Live token count for the editor (debounced `POST /skills/token-count`).
    Keeps the previous count while a new one loads, so the badge doesn't flicker. */
export function useSkillTokenCount(text: string, delayMs = 400) {
  const debounced = useDebouncedValue(text, delayMs);
  return useQuery({
    queryKey: ["skill-token-count", debounced],
    queryFn: () => api.post<{ tokens: number }>("/skills/token-count", { text: debounced }),
    select: (r) => r.tokens,
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
}

// ---- Agent ↔ skill links ----
export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

/** `N skills` on an agent card = links with `enabled`. */
export function useAgentSkillCount(agentId: string | null | undefined) {
  const q = useAgentSkills(agentId);
  return q.data?.filter((l) => l.enabled).length;
}

export interface AgentSkillItem {
  skill_id: string;
  enabled: boolean;
}

/** Persist every row (ordered) as a link with its enabled flag. */
export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, items }: { agentId: string; items: AgentSkillItem[] }) =>
      api.post<AgentSkillLink[]>(`/agents/${agentId}/skills`, { items }),
    onSuccess: (data, { agentId }) => {
      qc.setQueryData(["agent-skills", agentId], data);
      // agent_count on skill cards / stats "used by" change with link state.
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-stats"] });
    },
  });
}
