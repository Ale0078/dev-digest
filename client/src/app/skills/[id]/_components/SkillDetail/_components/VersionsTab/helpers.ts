export type DiffKind = "same" | "add" | "del";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/**
 * Line diff via longest common subsequence: `from` → `to`. Deletions are
 * emitted before additions at each change point. O(n·m) memory, fine for
 * skill bodies (server caps SKILL.md at 64 KB).
 */
export function lineDiff(from: string, to: string): DiffLine[] {
  const a = from.split("\n");
  const b = to.split("\n");
  const n = a.length;
  const m = b.length;
  // Flat (n+1)×(m+1) table: L(i, j) = LCS length of a[i..] and b[j..].
  const w = m + 1;
  const table = new Array<number>((n + 1) * w).fill(0);
  const L = (i: number, j: number) => table[i * w + j] ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * w + j] = a[i] === b[j] ? L(i + 1, j + 1) + 1 : Math.max(L(i + 1, j), L(i, j + 1));
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const ai = a[i] ?? "";
    const bj = b[j] ?? "";
    if (ai === bj) {
      out.push({ kind: "same", text: ai });
      i++;
      j++;
    } else if (L(i + 1, j) >= L(i, j + 1)) {
      out.push({ kind: "del", text: ai });
      i++;
    } else {
      out.push({ kind: "add", text: bj });
      j++;
    }
  }
  for (; i < n; i++) out.push({ kind: "del", text: a[i] ?? "" });
  for (; j < m; j++) out.push({ kind: "add", text: b[j] ?? "" });
  return out;
}

export function hasChanges(diff: DiffLine[]): boolean {
  return diff.some((d) => d.kind !== "same");
}

/** Short local date for the version list. */
export function formatVersionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
