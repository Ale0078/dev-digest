import type { LogLine } from "@devdigest/ui";
import type { RunTrace } from "@devdigest/shared";

export interface SkillsBlockMeta {
  /** Tokens of the skills block per prompt; null on pre-M2 traces. */
  tokens: number | null;
  /** Prompts the block was sent with (map-reduce chunks); shown only when > 1. */
  chunks: number;
  skills: { id: string; name: string; version: number }[];
}

/** Header meta for the Skills prompt block. Old traces lack the M2 fields. */
export function skillsBlockMeta(trace: RunTrace): SkillsBlockMeta {
  return {
    tokens: trace.prompt_assembly.skills_tokens ?? null,
    chunks: trace.tool_calls.length,
    skills: trace.config.skills ?? [],
  };
}

interface RawEvent {
  t: string;
  kind: string;
  msg: string;
}

/** Map run-bus events to the LiveLogStream LogLine shape. */
export function eventsToLog(events: RawEvent[]): LogLine[] {
  return events.map((e) => ({ t: e.t, k: e.kind as LogLine["k"], m: e.msg }));
}

/** Map a persisted trace's log to the LiveLogStream LogLine shape. */
export function traceLog(trace: RunTrace | undefined): LogLine[] {
  return trace?.log.map((l) => ({ t: l.t, k: l.kind as LogLine["k"], m: l.msg })) ?? [];
}

/** Seconds-formatted duration. */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export { formatCost, formatTokens } from "@/lib/format";
