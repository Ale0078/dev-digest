import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { readContainedFile } from '../../platform/contained-read.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { ConventionsRepository } from './repository.js';
import { ConventionsService } from './service.js';

/**
 * Conventions Extractor.
 *   GET    /repos/:id/conventions           → candidates (line ranges located on read)
 *   POST   /repos/:id/conventions/extract   → run / re-scan (one model call) → ConventionExtractResult
 *   PATCH  /repos/:id/conventions/:cid      → edit rule / accept
 *   DELETE /repos/:id/conventions/:cid      → 204 (reject)
 *   POST   /repos/:id/conventions/skills    → 201 Skill (type convention, source extracted)
 */

const ConventionParams = z.object({ id: z.string().uuid(), cid: z.string().uuid() });

const UpdateConventionBody = z
  .object({
    rule: z.string().trim().min(1).max(2000).optional(),
    accepted: z.boolean().optional(),
  })
  .refine((b) => b.rule !== undefined || b.accepted !== undefined, {
    message: 'Provide rule and/or accepted',
  });

const CreateConventionSkillBody = z.object({
  name: z
    .string()
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and dashes'),
  description: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1),
  enabled: z.boolean().default(false),
  convention_ids: z.array(z.string().uuid()).min(1),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const c = app.container;
  const service = new ConventionsService(
    new ConventionsRepository(c.db),
    { getConventionSamples: (repoId, n) => c.repoIntel.getConventionSamples(repoId, n) },
    (root, rel) => readContainedFile(root, rel),
    async (workspaceId) => {
      const choice = await resolveFeatureModel(c, workspaceId, 'conventions');
      return { llm: await c.llm(choice.provider), model: choice.model };
    },
    c.skillsService,
  );

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(c, req);
    return service.list(workspaceId, req.params.id);
  });

  app.post('/repos/:id/conventions/extract', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(c, req);
    return service.extract(workspaceId, req.params.id);
  });

  app.patch(
    '/repos/:id/conventions/:cid',
    { schema: { params: ConventionParams, body: UpdateConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(c, req);
      return service.update(workspaceId, req.params.id, req.params.cid, req.body);
    },
  );

  app.delete(
    '/repos/:id/conventions/:cid',
    { schema: { params: ConventionParams } },
    async (req, reply) => {
      const { workspaceId } = await getContext(c, req);
      await service.reject(workspaceId, req.params.id, req.params.cid);
      reply.status(204);
    },
  );

  app.post(
    '/repos/:id/conventions/skills',
    { schema: { params: IdParams, body: CreateConventionSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(c, req);
      const b = req.body;
      const skill = await service.createSkill(workspaceId, req.params.id, {
        name: b.name,
        description: b.description,
        body: b.body,
        enabled: b.enabled,
        conventionIds: b.convention_ids,
      });
      reply.status(201);
      return skill;
    },
  );
}
