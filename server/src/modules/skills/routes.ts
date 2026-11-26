import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import {
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../platform/errors.js';
import { IMPORT_LIMITS } from './import-parser.js';
import { SkillsRepository } from './repository.js';
import { SkillsService } from './service.js';

/**
 * M2 — skills module.
 *   GET    /skills                                → workspace list (newest updated first)
 *   POST   /skills                                → create (manual, or confirm an import)
 *   POST   /skills/token-count                    → { text } → { tokens }
 *   POST   /skills/import/preview                 → multipart .md/.zip → preview (writes nothing)
 *   GET    /skills/:id                            → one skill
 *   PUT    /skills/:id                            → edit (versions content) / toggle enabled
 *   DELETE /skills/:id                            → 204 (agent links cascade)
 *   GET    /skills/:id/versions                   → newest first
 *   POST   /skills/:id/versions/:version/restore  → new version from vN
 *   GET    /skills/:id/stats                      → 30-day Stats tab
 */

const VersionParams = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

const CreateSkillBody = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  type: SkillType,
  body: z.string().min(1),
  source: z.enum(['manual', 'imported']).default('manual'),
  enabled: z.boolean().optional(),
  message: z.string().optional(),
});

const UpdateSkillBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: SkillType.optional(),
  body: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  message: z.string().optional(),
});

const TokenCountBody = z.object({ text: z.string() });

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(new SkillsRepository(app.container.db), app.container.tokenizer);

  // Scoped to this plugin (not fastify-plugin wrapped), so only skills routes parse multipart.
  await app.register(multipart, {
    limits: { fileSize: IMPORT_LIMITS.maxUploadBytes, files: 1, fields: 0, parts: 1 },
  });

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const b = req.body;
    const skill = await service.create(workspaceId, {
      name: b.name,
      description: b.description,
      type: b.type,
      body: b.body,
      source: b.source,
      ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
      ...(b.message !== undefined ? { message: b.message } : {}),
    });
    reply.status(201);
    return skill;
  });

  app.post('/skills/token-count', { schema: { body: TokenCountBody } }, async (req) => {
    await getContext(app.container, req);
    return { tokens: service.countTokens(req.body.text) };
  });

  app.post('/skills/import/preview', async (req) => {
    await getContext(app.container, req);
    if (!req.isMultipart()) {
      throw new UnsupportedMediaTypeError('Expected a multipart/form-data upload');
    }
    const file = await req.file();
    if (!file || file.fieldname !== 'file') {
      throw new ValidationError('Upload a single file in the "file" field');
    }
    let bytes: Buffer;
    try {
      bytes = await file.toBuffer();
    } catch (err) {
      if (err instanceof app.multipartErrors.RequestFileTooLargeError) {
        throw new PayloadTooLargeError('File is larger than 1 MB');
      }
      throw err;
    }
    return service.previewImport(file.filename, new Uint8Array(bytes));
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return reply.status(204).send();
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.post(
    '/skills/:id/versions/:version/restore',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.restore(workspaceId, req.params.id, req.params.version);
    },
  );

  app.get('/skills/:id/stats', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const stats = await service.stats(workspaceId, req.params.id);
    if (!stats) throw new NotFoundError('Skill not found');
    return stats;
  });
}
