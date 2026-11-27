/* hooks/intent.ts — PR intent layer. Key: ["pr-intent", prId].
   Detection is synchronous on the server (one cheap model call), so the mutation's
   result replaces the cached intent directly. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { PrIntentRecord, PrIntentResponse } from "@devdigest/shared";

export const prIntentKey = (prId: string | null | undefined) => ["pr-intent", prId] as const;

export function usePrIntent(prId: string | null | undefined) {
  return useQuery({
    queryKey: prIntentKey(prId),
    queryFn: () => api.get<PrIntentResponse>(`/pulls/${prId}/intent`),
    enabled: !!prId,
  });
}

export function useDetectIntent(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PrIntentRecord>(`/pulls/${prId}/intent/detect`),
    onSuccess: (intent) => qc.setQueryData<PrIntentResponse>(prIntentKey(prId), { intent }),
  });
}
