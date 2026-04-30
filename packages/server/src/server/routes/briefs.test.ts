import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { briefsRoutes } from './briefs.js';
import * as schema from '../../db/schema.js';
import { AuthManager } from '../../providers/auth.js';

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: () => {} };
const authManager = {
  getApiKey: () => 'test-key',
  start: async () => {},
  stop: () => {},
} as unknown as AuthManager;

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-routes-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.campaigns).values({ id: 'c1', clientSlug: 'default', title: 'Campaign', status: 'active', createdAt: Date.now() });
  await db.insert(schema.campaignPlans).values({
    id: 'p1', campaignId: 'c1', clientSlug: 'default', goal: 'g', goalType: 'lead-gen', audience: 'a',
    keyMessages: [], channelMix: [], timelineStart: null, timelineEnd: null, kpi: '', createdAt: Date.now(), updatedAt: Date.now(),
  });
  app = Fastify();
  await app.register(briefsRoutes, { db, broker, dataDir: baseDir, authManager });
});

describe('briefs routes', () => {
  it('POST /api/briefs — creates brief (n8n-driven)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/briefs',
      payload: {
        title: 't',
        content_md: 'b',
        deliverable_type: 'social_post',
        target_specialist: 'social-manager',
        platform: 'instagram',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.brief_id).toMatch(/^[a-z0-9]+$/);
    const briefs = await db.select().from(schema.briefs).all();
    expect(briefs).toHaveLength(1);
    expect(briefs[0].status).toBe('draft');
  });

  it('GET /api/briefs — lists briefs for default client', async () => {
    await db.insert(schema.campaignCalendarItems).values({
      id: 'i1', planId: 'p1', campaignId: 'c1', clientSlug: 'default', channel: 'linkedin', deliverableType: 'social_post',
      targetDate: 1715000000, intent: 'intent', keyMessageRef: null, status: 'planned', createdAt: Date.now(), updatedAt: Date.now(),
    });
    await db.insert(schema.briefs).values({
      id: 'br_1', clientSlug: 'default', sourceThreadId: null,
      contentMd: '{"title":"x","body":"y","deliverable_type":"email","target_specialist":"copywriter"}',
      campaignId: 'c1', calendarItemId: 'i1',
      status: 'draft', createdAt: Date.now(), dispatchedAt: null, parentDeliverableId: null,
    });
    const res = await app.inject({ method: 'GET', url: '/api/briefs' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].calendar_item?.id).toBe('i1');
  });

  it('GET /api/briefs?calendar_item_id filters by linked item', async () => {
    await db.insert(schema.campaignCalendarItems).values([
      {
        id: 'i1', planId: 'p1', campaignId: 'c1', clientSlug: 'default', channel: 'linkedin', deliverableType: 'social_post',
        targetDate: 1715000000, intent: 'intent', keyMessageRef: null, status: 'planned', createdAt: Date.now(), updatedAt: Date.now(),
      },
      {
        id: 'i2', planId: 'p1', campaignId: 'c1', clientSlug: 'default', channel: 'email', deliverableType: 'email',
        targetDate: 1715100000, intent: 'intent2', keyMessageRef: null, status: 'planned', createdAt: Date.now(), updatedAt: Date.now(),
      },
    ]);
    await db.insert(schema.briefs).values([
      {
        id: 'br_1', clientSlug: 'default', sourceThreadId: null, campaignId: 'c1', calendarItemId: 'i1',
        contentMd: '{}', status: 'draft', createdAt: Date.now(), dispatchedAt: null, parentDeliverableId: null,
      },
      {
        id: 'br_2', clientSlug: 'default', sourceThreadId: null, campaignId: 'c1', calendarItemId: 'i2',
        contentMd: '{}', status: 'draft', createdAt: Date.now(), dispatchedAt: null, parentDeliverableId: null,
      },
    ]);
    const res = await app.inject({ method: 'GET', url: '/api/briefs?calendar_item_id=i1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('br_1');
  });

  it('POST /api/briefs/:id/dispatch — dispatches the brief', async () => {
    const create = await app.inject({
      method: 'POST', url: '/api/briefs',
      payload: { title: 't', content_md: 'b', deliverable_type: 'social_post', target_specialist: 'social-manager' },
    });
    const briefId = create.json().brief_id;
    const res = await app.inject({ method: 'POST', url: `/api/briefs/${briefId}/dispatch` });
    expect(res.statusCode).toBe(200);
    const briefs = await db.select().from(schema.briefs).all();
    expect(briefs[0].status).toBe('dispatched');
  });
});
