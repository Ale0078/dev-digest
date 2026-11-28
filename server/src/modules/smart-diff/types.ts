/**
 * Ports for the smart-diff module. `SmartDiffService` depends on this
 * interface only; `repository.ts` implements it with Drizzle.
 */

export interface SmartDiffFileRow {
  path: string;
  additions: number;
  deletions: number;
}

/** A `kind='review'` review with the placement of its findings. */
export interface ReviewFindingLines {
  id: string;
  agentId: string | null;
  findings: { file: string; start_line: number }[];
}

export interface SmartDiffStore {
  /** Tenancy guard: does the PR exist in this workspace? */
  pullExists(workspaceId: string, prId: string): Promise<boolean>;
  listFiles(prId: string): Promise<SmartDiffFileRow[]>;
  /** `kind='review'` reviews of the PR, newest first. */
  listReviewFindings(prId: string): Promise<ReviewFindingLines[]>;
}
