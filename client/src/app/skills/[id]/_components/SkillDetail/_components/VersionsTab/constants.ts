import type { DiffKind } from "./helpers";

/** Gutter mark per diff line kind. */
export const DIFF_MARK: Record<DiffKind, string> = { same: " ", add: "+", del: "-" };
