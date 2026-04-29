import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { briefs } from '../../db/schema.js';
import { dispatchBrief } from '../../broker/router.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface BriefsRoutesOpts {
  db: Db;
  broker: Broker;
  dataDir: string;
}

export const briefsRoutes: FastifyPluginAsync<BriefsRoutesOpts> = async (app, opts) => {
  const { db, broker, dataDir } = opts;

  app.post<{ Body: any }>('/api/briefs', async (req, reply) => {
    const b = req.body;
    const id = createId();
    await db.insert(briefs).values({
      id,
      clientSlug: 'default',
      sourceThreadId: null,
      contentMd: JSON.stringify({
        title: b.title,
        body: b.content_md,
        deliverable_type: b.deliverable_type,
        target_specialist: b.target_specialist,
        platform: b.platform ?? null,
      }),
      status: 'draft',
      createdAt: Date.now(),
      dispatchedAt: null,
    });
    return reply.code(201).send({ brief_id: id });
  });

  app.get('/api/briefs', async () => {
    const all = await db.select().from(briefs).where(eq(briefs.clientSlug, 'default')).orderBy(desc(briefs.createdAt)).all();
    return all;
  });

  app.post<{ Params: { id: string } }>('/api/briefs/:id/dispatch', async (req, reply) => {
    try {
      await dispatchBrief({ db, broker, dataDir, briefId: req.params.id });
      return reply.send({ ok: true });
    } catch (err) {
      return reply.code(400).send({ error: String((err as Error).message) });
    }
  });
};
