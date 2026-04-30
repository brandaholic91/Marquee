import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { briefs, campaigns } from '../../db/schema.js';
import { dispatchBrief } from '../../broker/router.js';
import { AuthManager } from '../../providers/auth.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface BriefsRoutesOpts {
  db: Db;
  broker: Broker;
  dataDir: string;
  authManager: AuthManager;
}

export const briefsRoutes: FastifyPluginAsync<BriefsRoutesOpts> = async (app, opts) => {
  const { db, broker, dataDir, authManager } = opts;

  app.post<{ Body: Record<string, unknown> }>('/api/briefs', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
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

  app.patch<{ Params: { id: string }; Body: { title?: string; content_md?: string; campaign_name?: string | null } }>(
    '/api/briefs/:id',
    async (req, reply) => {
      const rows = await db.select().from(briefs).where(eq(briefs.id, req.params.id)).all();
      if (rows.length === 0) return reply.code(404).send({ error: 'not_found' });
      if (rows[0].status !== 'draft') return reply.code(400).send({ error: 'only_draft_editable' });

      const current = JSON.parse(rows[0].contentMd) as Record<string, unknown>;
      if (req.body?.title) current.title = req.body.title;
      if (req.body?.content_md) current.body = req.body.content_md;

      const updates: Record<string, unknown> = { contentMd: JSON.stringify(current) };

      if (req.body?.campaign_name !== undefined) {
        const name = req.body.campaign_name?.trim() ?? '';
        if (name) {
          const tentativeId = createId();
          await db.insert(campaigns).values({
            id: tentativeId, clientSlug: 'default', title: name,
            status: 'active', createdAt: Date.now(),
          }).onConflictDoNothing();
          const found = await db.select().from(campaigns)
            .where(and(eq(campaigns.clientSlug, 'default'), eq(campaigns.title, name)))
            .limit(1).all();
          updates.campaignId = found[0]?.id ?? null;
        } else {
          updates.campaignId = null;
        }
      }

      await db.update(briefs).set(updates as never).where(eq(briefs.id, req.params.id));
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>('/api/briefs/:id/dispatch', async (req, reply) => {
    try {
      await dispatchBrief({ db, broker, dataDir, authManager, briefId: req.params.id });
      return reply.send({ ok: true });
    } catch (err) {
      const msg = String((err as Error).message);
      console.error(`[dispatchBrief error] ${req.params.id}:`, msg);
      return reply.code(400).send({ error: msg });
    }
  });
};
