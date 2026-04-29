import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc } from 'drizzle-orm';
import { memoryAudit } from '../../db/schema.js';
import { MEMORY_FILES } from '../../memory/validate.js';
import { readMemoryFile } from '../../memory/read.js';
import { writeMemoryFile } from '../../memory/write.js';
import { listPending, decideProposal } from '../../memory/proposals.js';

type Db = ReturnType<typeof drizzle>;

export interface MemoryRoutesOpts {
  db: Db;
  dataDir: string;
}

export const memoryRoutes: FastifyPluginAsync<MemoryRoutesOpts> = async (app, opts) => {
  const { db, dataDir } = opts;

  // 1. GET /api/memory/clients/:slug/files
  app.get<{ Params: { slug: string } }>('/api/memory/clients/:slug/files', async (req) => {
    const { slug } = req.params;
    const results = await Promise.all(
      MEMORY_FILES.map(async (file) => {
        const content = await readMemoryFile(dataDir, slug, file);
        return { file, exists: content !== null };
      })
    );
    return results;
  });

  // 2. GET /api/memory/clients/:slug/:file
  app.get<{ Params: { slug: string; file: string } }>('/api/memory/clients/:slug/:file', async (req, reply) => {
    const { slug, file } = req.params;
    if (!MEMORY_FILES.includes(file as never)) {
      return reply.code(400).send({ error: `unknown memory file: ${file}` });
    }
    const content = await readMemoryFile(dataDir, slug, file);
    if (content === null) return reply.code(404).send({ error: 'not_found' });
    return content;
  });

  // 3. PUT /api/memory/clients/:slug/:file
  app.put<{ Params: { slug: string; file: string }; Body: { content: string } }>(
    '/api/memory/clients/:slug/:file',
    async (req, reply) => {
      const { slug, file } = req.params;
      if (!MEMORY_FILES.includes(file as never)) {
        return reply.code(400).send({ error: `unknown memory file: ${file}` });
      }
      const { content } = req.body;
      try {
        await writeMemoryFile(dataDir, db, slug, file, content, 'user');
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
      return reply.send({ ok: true });
    }
  );

  // 4. GET /api/memory/clients/:slug/proposals?status=pending
  app.get<{ Params: { slug: string }; Querystring: { status?: string } }>(
    '/api/memory/clients/:slug/proposals',
    async (req) => {
      const { slug } = req.params;
      return listPending(db, slug);
    }
  );

  // 5. POST /api/memory/proposals/:id/approve
  app.post<{ Params: { id: string } }>('/api/memory/proposals/:id/approve', async (req, reply) => {
    try {
      await decideProposal(db, dataDir, req.params.id, 'approved');
      return reply.send({ ok: true });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // 6. POST /api/memory/proposals/:id/reject
  app.post<{ Params: { id: string } }>('/api/memory/proposals/:id/reject', async (req, reply) => {
    try {
      await decideProposal(db, dataDir, req.params.id, 'rejected');
      return reply.send({ ok: true });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // 7. GET /api/memory/clients/:slug/:file/audit
  app.get<{ Params: { slug: string; file: string } }>(
    '/api/memory/clients/:slug/:file/audit',
    async (req, reply) => {
      const { slug, file } = req.params;
      if (!MEMORY_FILES.includes(file as never)) {
        return reply.code(400).send({ error: `unknown memory file: ${file}` });
      }
      return db.select().from(memoryAudit)
        .where(and(eq(memoryAudit.clientSlug, slug), eq(memoryAudit.file, file)))
        .orderBy(desc(memoryAudit.ts))
        .all();
    }
  );
};
