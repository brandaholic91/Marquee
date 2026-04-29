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

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: () => {} };

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-routes-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  app = Fastify();
  await app.register(briefsRoutes, { db, broker, dataDir: baseDir });
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
    await db.insert(schema.briefs).values({
      id: 'br_1', clientSlug: 'default', sourceThreadId: null,
      contentMd: '{"title":"x","body":"y","deliverable_type":"email","target_specialist":"copywriter"}',
      status: 'draft', createdAt: Date.now(), dispatchedAt: null,
    });
    const res = await app.inject({ method: 'GET', url: '/api/briefs' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
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
