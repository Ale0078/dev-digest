import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrIntentRecord, PrIntentResponse } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';

/**
 * Intent layer.
 *   GET  /pulls/:id/intent          → { intent: PrIntentRecord | null } (stale flag computed on read)
 *   POST /pulls/:id/intent/detect   → PrIntentRecord (one cheap model call; the only place intent is classified)
 */
export default async function intentRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const c = app.container;

  app.get(
    '/pulls/:id/intent',
    { schema: { params: IdParams, response: { 200: PrIntentResponse } } },
    async (req) => {
      const { workspaceId } = await getContext(c, req);
      return c.intentService.get(workspaceId, req.params.id);
    },
  );

  // Tight per-route limit: each call can fetch external links and spend LLM tokens.
  app.post(
    '/pulls/:id/intent/detect',
    {
      schema: { params: IdParams, response: { 200: PrIntentRecord } },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { workspaceId } = await getContext(c, req);
      return c.intentService.detect(workspaceId, req.params.id, req.log);
    },
  );
}
