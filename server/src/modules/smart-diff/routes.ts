import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { SmartDiffResponse } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';

/**
 * Smart diff.
 *   GET /pulls/:id/smart-diff → role-grouped files + finding lines (no LLM call)
 */
export default async function smartDiffRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const c = app.container;

  app.get(
    '/pulls/:id/smart-diff',
    { schema: { params: IdParams, response: { 200: SmartDiffResponse } } },
    async (req) => {
      const { workspaceId } = await getContext(c, req);
      return c.smartDiffService.get(workspaceId, req.params.id);
    },
  );
}
