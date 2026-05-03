import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, sql } from 'drizzle-orm';
import { campaigns, deliverables } from '../../db/schema.js';
import { getPlanByCampaignId, listCalendarItems } from '../../db/queries.js';
import { createId } from '@paralleldrive/cuid2';

type Db = ReturnType<typeof drizzle>;
export interface CampaignsRoutesOpts { db: Db; }

export const campaignsRoutes: FastifyPluginAsync<CampaignsRoutesOpts> = async (app, opts) => {
  const { db } = opts;

  app.get('/api/campaigns', async () => {
    const rows = await db.select().from(campaigns)
      .where(eq(campaigns.clientSlug, 'default'))
      .orderBy(sql`${campaigns.createdAt} DESC`)
      .all();

    // Attach deliverable counts via separate query (SQLite doesn't need a join here)
    const counts = await db.select({
      campaignId: deliverables.campaignId,
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when ${deliverables.status} = 'awaiting_approval' then 1 else 0 end)`,
    }).from(deliverables)
      .where(eq(deliverables.clientSlug, 'default'))
      .groupBy(deliverables.campaignId)
      .all();

    const countMap = new Map(counts.map((c) => [c.campaignId, c]));

    return rows.map((c) => ({
      ...(() => {
        const plan = getPlanByCampaignId(db, c.id);
        if (!plan) return { plan_summary: { has_plan: false, calendar_progress: null } };
        const progress = { planned: 0, brief_created: 0, delivered: 0, cancelled: 0 };
        for (const item of listCalendarItems(db, plan.id)) progress[item.status] += 1;
        return { plan_summary: { has_plan: true, calendar_progress: progress } };
      })(),
      id: c.id,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      deliverableCount: countMap.get(c.id)?.total ?? 0,
      pendingApprovals: countMap.get(c.id)?.pending ?? 0,
    }));
  });

  app.get<{ Params: { id: string } }>('/api/campaigns/:id', async (req, reply) => {
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, req.params.id)).all();
    if (rows.length === 0) return reply.code(404).send({ error: 'not found' });
    const campaign = rows[0];

    const deliverableRows = await db.select().from(deliverables)
      .where(eq(deliverables.campaignId, req.params.id))
      .orderBy(sql`${deliverables.updatedAt} DESC`)
      .all();
    const plan = getPlanByCampaignId(db, campaign.id);
    const progress = plan
      ? (() => {
          const p = { planned: 0, brief_created: 0, delivered: 0, cancelled: 0 };
          for (const item of listCalendarItems(db, plan.id)) p[item.status] += 1;
          return { has_plan: true, calendar_progress: p };
        })()
      : { has_plan: false, calendar_progress: null };

    return { ...campaign, plan_summary: progress, deliverables: deliverableRows };
  });

  app.patch<{ Params: { id: string }; Body: { title?: string; status?: string } }>(
    '/api/campaigns/:id',
    async (req, reply) => {
      const rows = await db.select().from(campaigns).where(eq(campaigns.id, req.params.id)).all();
      if (rows.length === 0) return reply.code(404).send({ error: 'not found' });

      if (req.body?.title) {
        await db.update(campaigns).set({ title: req.body.title })
          .where(and(eq(campaigns.id, req.params.id), eq(campaigns.clientSlug, 'default')));
      }
      if (req.body?.status) {
        const s = req.body.status as 'active' | 'completed' | 'archived';
        await db.update(campaigns).set({ status: s })
          .where(and(eq(campaigns.id, req.params.id), eq(campaigns.clientSlug, 'default')));
      }

      return { ok: true };
    },
  );
  app.post<{ Body: { title?: string } }>(
    '/api/campaigns',
    async (req, reply) => {
      const title = req.body?.title?.trim();
      if (!title) return reply.code(400).send({ error: 'title_required' });

      const id = createId();
      try {
        await db.insert(campaigns).values({
          id,
          clientSlug: 'default',
          title,
          status: 'active',
          createdAt: Date.now(),
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          return reply.code(409).send({ error: 'campaign_exists' });
        }
        throw err;
      }

      return reply.code(201).send({ id, title, status: 'active', createdAt: Date.now() });
    },
  );


};
