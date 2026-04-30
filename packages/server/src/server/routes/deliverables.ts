import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { readFile } from 'node:fs/promises';
import { deliverables, deliverableRevisions, approvals, delegations, briefs, deliverableReviews } from '../../db/schema.js';
import { spawnAgent } from '../../agents/factory.js';
import { fireDeliverableShipped } from '../../webhooks/n8n-outbound.js';
import { dispatchReview } from '../../broker/review-dispatcher.js';
import type { AuthManager } from '../../providers/auth.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface DeliverablesRoutesOpts {
  db: Db;
  broker: Broker;
  dataDir: string;
  n8nWebhookUrl: string | null;
  authManager?: AuthManager;
}

export const deliverablesRoutes: FastifyPluginAsync<DeliverablesRoutesOpts> = async (app, opts) => {
  const { db, broker, dataDir, n8nWebhookUrl } = opts;

  app.get<{ Querystring: { status?: string } }>('/api/deliverables', async (req) => {
    const statuses = req.query.status ? [req.query.status] : ['drafting', 'awaiting_approval', 'shipped', 'archived'];
    return db.select().from(deliverables)
      .where(and(eq(deliverables.clientSlug, 'default'), inArray(deliverables.status, statuses as never)))
      .orderBy(desc(deliverables.updatedAt)).all();
  });

  app.get<{ Params: { id: string } }>('/api/deliverables/:id', async (req, reply) => {
    const ds = await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all();
    if (ds.length === 0) return reply.code(404).send({ error: 'not_found' });
    const revs = await db.select().from(deliverableRevisions)
      .where(eq(deliverableRevisions.deliverableId, req.params.id))
      .orderBy(asc(deliverableRevisions.revisionNo)).all();
    return { deliverable: ds[0], revisions: revs };
  });

  app.get<{ Params: { id: string; revisionId: string } }>('/api/deliverables/:id/revisions/:revisionId/content', async (req, reply) => {
    const rev = await db.select().from(deliverableRevisions)
      .where(and(eq(deliverableRevisions.deliverableId, req.params.id), eq(deliverableRevisions.id, req.params.revisionId)))
      .all();
    if (rev.length === 0) return reply.code(404).send({ error: 'not_found' });
    const artifactPath = rev[0].artifactPath;
    if (!artifactPath) return reply.code(404).send({ error: 'no_artifact' });
    try {
      const content = await readFile(artifactPath, 'utf-8');
      return { content };
    } catch (err) {
      console.error(`failed to read artifact ${artifactPath}:`, err);
      return reply.code(500).send({ error: 'read_failed' });
    }
  });

  app.post<{ Params: { id: string } }>('/api/deliverables/:id/approve', async (req, reply) => {
    const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
    if (!d) return reply.code(404).send({ error: 'not_found' });
    if (d.status !== 'awaiting_approval') return reply.code(400).send({ error: 'not_awaiting_approval' });
    const now = Date.now();
    await db.update(deliverables).set({ status: 'shipped', updatedAt: now }).where(eq(deliverables.id, d.id));
    await db.insert(approvals).values({
      id: createId(), deliverableId: d.id, revisionId: d.currentRevisionId!,
      decision: 'approved', note: null, decidedAt: now,
    });
    broker.emit({ type: 'deliverable_approved', deliverable_id: d.id });
    if (n8nWebhookUrl) {
      void fireDeliverableShipped(n8nWebhookUrl, db, d.id).catch((err) => {
        broker.emit({ type: 'error', source: 'n8n_webhook', message: String(err) });
      });
    }
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string }; Body: { note?: string } }>('/api/deliverables/:id/return', async (req, reply) => {
    const note = req.body?.note ?? null;
    const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
    if (!d) return reply.code(404).send({ error: 'not_found' });
    if (d.status !== 'awaiting_approval') return reply.code(400).send({ error: 'not_awaiting_approval' });
    const now = Date.now();

    await db.update(deliverables).set({ status: 'drafting', updatedAt: now }).where(eq(deliverables.id, d.id));
    await db.insert(approvals).values({
      id: createId(), deliverableId: d.id, revisionId: d.currentRevisionId!,
      decision: 'requested_changes', note, decidedAt: now,
    });

    const oldDel = (await db.select().from(delegations).where(eq(delegations.id, d.delegationId)).all())[0];
    const brief = (await db.select().from(briefs).where(eq(briefs.id, oldDel.briefId)).all())[0];
    const newDelId = createId();
    await db.insert(delegations).values({
      id: newDelId, briefId: brief.id, clientSlug: brief.clientSlug, fromAgent: 'director',
      toAgent: oldDel.toAgent, payloadJson: brief.contentMd, status: 'in_progress',
      requestedAt: now, completedAt: null,
    });
    await db.update(deliverables).set({ delegationId: newDelId, updatedAt: now }).where(eq(deliverables.id, d.id));

    const payload = JSON.parse(brief.contentMd);
    const { agent, session } = await spawnAgent({
      db, broker, dataDir, clientSlug: brief.clientSlug,
      role: oldDel.toAgent as never,
      delegationId: newDelId, deliverableType: d.type as never,
    });
    broker.emit({ type: 'deliverable_returned', deliverable_id: d.id, delegation_id: newDelId });
    broker.emit({ type: 'delegation_started', delegation_id: newDelId, agent_slug: oldDel.toAgent, session_id: session.id });

    const prevRev = (await db.select().from(deliverableRevisions).where(eq(deliverableRevisions.id, d.currentRevisionId!)).all())[0];
    const prompt = [
      `# Brief: ${payload.title}`,
      `Deliverable típus: ${payload.deliverable_type}`,
      payload.platform ? `Platform: ${payload.platform}` : '',
      '',
      payload.body,
      '',
      '## ELŐZŐ VERZIÓ (file)',
      prevRev.artifactPath,
      '',
      '## OPERATOR FEEDBACK',
      note ?? '(nincs konkrét megjegyzés)',
      '',
      'Készítsd el az új verziót a feedback alapján.',
    ].filter(Boolean).join('\n');
    void agent.prompt(prompt).catch((err) => broker.emit({ type: 'error', source: 'specialist', message: String(err) }));

    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string }; Body: { note?: string } }>('/api/deliverables/:id/discard', async (req, reply) => {
    const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
    if (!d) return reply.code(404).send({ error: 'not_found' });
    const now = Date.now();
    await db.update(deliverables).set({ status: 'archived', updatedAt: now }).where(eq(deliverables.id, d.id));
    await db.insert(approvals).values({
      id: createId(), deliverableId: d.id, revisionId: d.currentRevisionId!,
      decision: 'discarded', note: req.body?.note ?? null, decidedAt: now,
    });
    broker.emit({ type: 'deliverable_discarded', deliverable_id: d.id });
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/deliverables/:id/review', async (req, reply) => {
    const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
    if (!d) return reply.code(404).send({ error: 'not_found' });

    await dispatchReview({
      db, broker, dataDir, deliverableId: req.params.id, authManager: opts.authManager,
    }).catch((err) => {
      broker.emit({ type: 'error', source: 'guardian', message: String(err) });
    });

    return reply.send({ ok: true });
  });

  app.get<{ Params: { id: string } }>('/api/deliverables/:id/reviews', async (req, reply) => {
    const rows = await db.select().from(deliverableReviews)
      .where(eq(deliverableReviews.deliverableId, req.params.id))
      .orderBy(desc(deliverableReviews.createdAt))
      .all();
    return rows.map((r) => ({
      ...r,
      comments: JSON.parse(r.comments),
      suggestions: JSON.parse(r.suggestions),
    }));
  });
};
