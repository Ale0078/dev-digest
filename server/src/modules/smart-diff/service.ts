import type { SmartDiff } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { latestReviewPerAgent } from '../pulls/status.js';
import { buildSmartDiff } from './classify.js';
import type { SmartDiffStore } from './types.js';

/** Role-grouped file list with the lines of the latest review's findings. No LLM, no GitHub. */
export class SmartDiffService {
  constructor(private store: SmartDiffStore) {}

  async get(workspaceId: string, prId: string): Promise<SmartDiff> {
    if (!(await this.store.pullExists(workspaceId, prId))) {
      throw new NotFoundError('Pull request not found');
    }
    const [files, reviews] = await Promise.all([
      this.store.listFiles(prId),
      this.store.listReviewFindings(prId),
    ]);
    const findings = latestReviewPerAgent(reviews).flatMap((r) => r.findings);
    return buildSmartDiff(files, findings);
  }
}
