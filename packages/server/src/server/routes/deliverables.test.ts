import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deliverablesRoutes } from './deliverables.js';
import * as schema from '../../db/schema.js';

vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: class FakeAgent {
    constructor(public opts: any) {}
    async prompt() { /* no-op for tests */ }
  },
}));

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
let baseDir: string;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

async function seedDeliverable() {
  const now = Date.now();
  await db.insert(schema.briefs).values({
    id: 'br_1', clientSlug: 'default', sourceThreadId: null,
    contentMd: JSON.stringify({ title: 't', body: 'b', deliverable_type: 'social_post', target_specialist: 'social-manager', platform: 'instagram' }),
    status: 'dispatched', createdAt: now, dispatchedAt: now,
  });
  await db.insert(schema.delegations).values({
    id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director',
    toAgent: 'social-manager', payloadJson: '{}', status: 'complete', requestedAt: now, completedAt: now,
  });
  // Insert deliverable first (without currentRevisionId) to satisfy the FK from deliverable_revisions → deliverables
  await db.insert(schema.deliverables).values({
    id: 'd_1', delegationId: 'del_1', clientSlug: 'default',
    type: 'social_post', status: 'awaiting_approval',
    currentRevisionId: null, createdAt: now, updatedAt: now,
  });
  await db.insert(schema.deliverableRevisions).values({
    id: 'rev_1', deliverableId: 'd_1', revisionNo: 1,
    artifactPath: '/tmp/test/rev_001.md', createdByAgent: 'social-manager',
    feedbackNote: null, ts: now,
  });
  // Now set currentRevisionId back (revision row now exists)
  await db.update(schema.deliverables).set({ currentRevisionId: 'rev_1' });
}

beforeEach(async () => {
  events.length = 0;
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-deliv-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  app = Fastify();
  await app.register(deliverablesRoutes, { db, broker, dataDir: baseDir, n8nWebhookUrl: null });
});

describe('deliverables routes', () => {
  it('GET /api/deliverables — lists by client (default)', async () => {
    await seedDeliverable();
    const res = await app.inject({ method: 'GET', url: '/api/deliverables' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('d_1');
  });

  it('GET /api/deliverables?status=awaiting_approval — filters', async () => {
    await seedDeliverable();
    const res = await app.inject({ method: 'GET', url: '/api/deliverables?status=awaiting_approval' });
    expect(res.json()).toHaveLength(1);
    const res2 = await app.inject({ method: 'GET', url: '/api/deliverables?status=shipped' });
    expect(res2.json()).toHaveLength(0);
  });

  it('GET /api/deliverables/:id — returns deliverable + revisions', async () => {
    await seedDeliverable();
    const res = await app.inject({ method: 'GET', url: '/api/deliverables/d_1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deliverable.id).toBe('d_1');
    expect(body.revisions).toHaveLength(1);
  });

  it('GET /api/deliverables/:id — 404 for missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/deliverables/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /:id/approve — sets shipped + inserts approval + emits event', async () => {
    await seedDeliverable();
    const res = await app.inject({ method: 'POST', url: '/api/deliverables/d_1/approve' });
    expect(res.statusCode).toBe(200);
    const ds = await db.select().from(schema.deliverables).all();
    expect(ds[0].status).toBe('shipped');
    const ap = await db.select().from(schema.approvals).all();
    expect(ap).toHaveLength(1);
    expect(ap[0].decision).toBe('approved');
    expect(events.some(e => e.type === 'deliverable_approved')).toBe(true);
  });

  it('POST /:id/approve — 400 if not awaiting_approval', async () => {
    await seedDeliverable();
    await db.update(schema.deliverables).set({ status: 'shipped' }).run();
    const res = await app.inject({ method: 'POST', url: '/api/deliverables/d_1/approve' });
    expect(res.statusCode).toBe(400);
  });

  it('POST /:id/return — sets drafting + creates new delegation + emits events', async () => {
    await seedDeliverable();
    const res = await app.inject({
      method: 'POST', url: '/api/deliverables/d_1/return',
      payload: { note: 'túl rövid' },
    });
    expect(res.statusCode).toBe(200);
    const ds = await db.select().from(schema.deliverables).all();
    expect(ds[0].status).toBe('drafting');
    const dels = await db.select().from(schema.delegations).all();
    expect(dels).toHaveLength(2);
    const newDel = dels.find(d => d.id !== 'del_1');
    expect(newDel?.status).toBe('in_progress');
    expect(ds[0].delegationId).toBe(newDel?.id);
    const ap = await db.select().from(schema.approvals).all();
    expect(ap[0].decision).toBe('requested_changes');
    expect(ap[0].note).toBe('túl rövid');
    expect(events.some(e => e.type === 'deliverable_returned')).toBe(true);
    expect(events.some(e => e.type === 'delegation_started')).toBe(true);
  });

  it('POST /:id/discard — sets archived + inserts discarded approval + emits event', async () => {
    await seedDeliverable();
    const res = await app.inject({
      method: 'POST', url: '/api/deliverables/d_1/discard',
      payload: { note: 'irreleváns' },
    });
    expect(res.statusCode).toBe(200);
    const ds = await db.select().from(schema.deliverables).all();
    expect(ds[0].status).toBe('archived');
    const ap = await db.select().from(schema.approvals).all();
    expect(ap[0].decision).toBe('discarded');
    expect(ap[0].note).toBe('irreleváns');
    expect(events.some(e => e.type === 'deliverable_discarded')).toBe(true);
  });
});
