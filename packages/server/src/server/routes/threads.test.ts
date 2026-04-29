import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { threadsRoutes } from './threads.js';
import * as schema from '../../db/schema.js';

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  app = Fastify();
  await app.register(threadsRoutes, { db });
});

describe('threads routes', () => {
  it('POST /api/threads — creates a row with clientSlug=default and returns thread_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/threads',
      payload: { title: 'Test thread' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ thread_id: string }>();
    expect(body.thread_id).toBeTruthy();
    expect(typeof body.thread_id).toBe('string');

    const rows = await db.select().from(schema.chatThreads).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].clientSlug).toBe('default');
    expect(rows[0].title).toBe('Test thread');
    expect(rows[0].archivedAt).toBeNull();
  });

  it('POST /api/threads — accepts empty body and creates thread with null title', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/threads' });
    expect(res.statusCode).toBe(201);
    const rows = await db.select().from(schema.chatThreads).all();
    expect(rows[0].title).toBeNull();
  });

  it('GET /api/threads — auto-creates one thread when DB is empty', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/threads' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; clientSlug: string }[]>();
    expect(body).toHaveLength(1);
    expect(body[0].clientSlug).toBe('default');
    expect(body[0].id).toBeTruthy();

    // Verify it was persisted in DB
    const rows = await db.select().from(schema.chatThreads).all();
    expect(rows).toHaveLength(1);
  });

  it('GET /api/threads — returns active threads first, then archived', async () => {
    // Create two active threads via POST
    const r1 = await app.inject({ method: 'POST', url: '/api/threads', payload: { title: 'Active 1' } });
    const r2 = await app.inject({ method: 'POST', url: '/api/threads', payload: { title: 'Active 2' } });
    const id1 = r1.json<{ thread_id: string }>().thread_id;
    const id2 = r2.json<{ thread_id: string }>().thread_id;

    // Archive the first thread directly in DB
    await db.update(schema.chatThreads)
      .set({ archivedAt: Date.now() })
      .where(eq(schema.chatThreads.id, id1));

    const res = await app.inject({ method: 'GET', url: '/api/threads' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; archivedAt: number | null }[]>();

    // Should have 2 rows total
    expect(body).toHaveLength(2);

    // Active (id2) must come before archived (id1)
    const firstArchivedIndex = body.findIndex(t => t.archivedAt !== null);
    expect(firstArchivedIndex).toBeGreaterThan(-1);
    // All items before the first archived must be active
    const activeBeforeArchived = body.slice(0, firstArchivedIndex).filter(t => t.archivedAt === null);
    expect(activeBeforeArchived).toHaveLength(firstArchivedIndex);

    // Archived thread appears in results
    const archivedInResult = body.filter(t => t.archivedAt !== null);
    expect(archivedInResult).toHaveLength(1);
    expect(archivedInResult[0].id).toBe(id1);

    // Active thread appears in results
    const activeInResult = body.filter(t => t.archivedAt === null);
    expect(activeInResult).toHaveLength(1);
    expect(activeInResult[0].id).toBe(id2);
  });
});
