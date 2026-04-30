import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, isNull, isNotNull, desc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { chatThreads } from '../../db/schema.js';

type Db = ReturnType<typeof drizzle>;

export interface ThreadsRoutesOpts { db: Db; }

export const threadsRoutes: FastifyPluginAsync<ThreadsRoutesOpts> = async (app, opts) => {
  const { db } = opts;

  app.post<{ Body?: { title?: string; campaign_id?: string | null } }>('/api/threads', async (req, reply) => {
    const id = createId();
    await db.insert(chatThreads).values({
      id,
      clientSlug: 'default',
      campaignId: req.body?.campaign_id ?? null,
      title: req.body?.title ?? null,
      archivedAt: null,
    });
    return reply.code(201).send({ thread_id: id });
  });

  app.get<{ Querystring: { campaign_id?: string } }>('/api/threads', async (req) => {
    const campaignId = req.query?.campaign_id;
    if (campaignId) {
      return db.select().from(chatThreads)
        .where(and(eq(chatThreads.clientSlug, 'default'), eq(chatThreads.campaignId, campaignId)))
        .orderBy(sql`rowid DESC`)
        .all();
    }

    const active = await db.select().from(chatThreads)
      .where(and(eq(chatThreads.clientSlug, 'default'), isNull(chatThreads.archivedAt)))
      .orderBy(sql`rowid DESC`)
      .all();

    if (active.length === 0) {
      // Auto-create one on first request
      const id = createId();
      await db.insert(chatThreads).values({
        id, clientSlug: 'default', title: null, archivedAt: null,
      });
      return [{ id, clientSlug: 'default', title: null, archivedAt: null }];
    }

    const archived = await db.select().from(chatThreads)
      .where(and(eq(chatThreads.clientSlug, 'default'), isNotNull(chatThreads.archivedAt)))
      .orderBy(desc(chatThreads.archivedAt))
      .all();

    return [...active, ...archived];
  });

  app.patch<{ Params: { id: string }; Body: { title: string } }>(
    '/api/threads/:id',
    async (req, reply) => {
      const title = req.body?.title;
      if (!title) return reply.code(400).send({ error: 'title required' });
      await db.update(chatThreads).set({ title })
        .where(and(eq(chatThreads.id, req.params.id), eq(chatThreads.clientSlug, 'default')));
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/threads/:id/archive',
    async (req, reply) => {
      const rows = await db.select().from(chatThreads)
        .where(and(eq(chatThreads.id, req.params.id), eq(chatThreads.clientSlug, 'default'))).all();
      if (rows.length === 0) return reply.code(404).send({ error: 'not found' });
      await db.update(chatThreads).set({ archivedAt: Date.now() })
        .where(eq(chatThreads.id, req.params.id));
      return { ok: true };
    },
  );
};
