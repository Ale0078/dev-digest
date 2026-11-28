/* diff-viewer — unified-diff viewer with optional inline GitHub comments and
   inline findings. Public surface: the DiffViewer component + the
   DiffCommentApi / DiffFindingApi / DiffGroup contracts. */
export { DiffViewer } from "./DiffViewer";
export type { DiffCommentApi } from "./comments";
export type { DiffFindingApi, DiffGroup } from "./findings";
