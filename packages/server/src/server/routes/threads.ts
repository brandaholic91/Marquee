import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { chatThreads } from '../../db/schema.js';

type Db = ReturnType<typeof drizzle>;

export interface ThreadsRoutesOpts { db: Db; }

export const threadsRoutes: FastifyPluginAsync<ThreadsRoutesOpts> = async (app, opts) => {
  const { db } = opts;

  app.post<{ Body?: { title?: string } }>('/api/threads', async (req, reply) => {
    const id = createId();
    await db.insert(chatThreads).values({
      id,
      clientSlug: 'default',
      title: req.body?.title ?? null,
      archivedAt: null,
    });
    return reply.code(201).send({ thread_id: id });
  });

  app.get('/api/threads', async () => {
    const active = await db.select().from(chatThreads)
      .where(and(eq(chatThreads.clientSlug, 'default'), isNull(chatThreads.archivedAt)))
      .orderBy(desc(chatThreads.id))
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
};
