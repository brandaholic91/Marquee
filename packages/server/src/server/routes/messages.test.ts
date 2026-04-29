import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { messagesRoutes } from './messages.js';
import * as schema from '../../db/schema.js';
import { createId } from '@paralleldrive/cuid2';

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
let threadId: string;
const emitSpy = vi.fn();
const broker = { emit: emitSpy };

beforeEach(async () => {
  emitSpy.mockClear();
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });

  threadId = createId();
  await db.insert(schema.chatThreads).values({
    id: threadId,
    clientSlug: 'default',
    title: 'Test thread',
    archivedAt: null,
  });

  app = Fastify();
  await app.register(messagesRoutes, { db, broker });
});

describe('messages routes', () => {
  it('POST /api/messages — inserts row with sender=user, type=chat and emits chat_message event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/messages',
      payload: { thread_id: threadId, content: 'Hello world' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ message_id: string }>();
    expect(body.message_id).toBeTruthy();

    const rows = await db.select().from(schema.messages).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].sender).toBe('user');
    expect(rows[0].type).toBe('chat');
    expect(rows[0].threadId).toBe(threadId);
    expect(JSON.parse(rows[0].contentJson)).toMatchObject({ text: 'Hello world' });

    expect(emitSpy).toHaveBeenCalledOnce();
    const emittedEvent = emitSpy.mock.calls[0][0];
    expect(emittedEvent.type).toBe('chat_message');
    expect(emittedEvent.thread_id).toBe(threadId);
    expect(emittedEvent.sender).toBe('user');
    expect(emittedEvent.text).toBe('Hello world');
    expect(emittedEvent.message_id).toBe(body.message_id);
  });

  it('GET /api/messages?thread_id= — returns rows ordered by ts ASC', async () => {
    const { eq, asc } = await import('drizzle-orm');

    // Insert two messages with explicit timestamps to ensure ordering
    const id1 = createId();
    const id2 = createId();
    const ts1 = 1000;
    const ts2 = 2000;
    await db.insert(schema.messages).values({
      id: id2, threadId, agentSessionId: null, sender: 'agent', type: 'chat',
      contentJson: JSON.stringify({ text: 'Second' }), ts: ts2,
    });
    await db.insert(schema.messages).values({
      id: id1, threadId, agentSessionId: null, sender: 'user', type: 'chat',
      contentJson: JSON.stringify({ text: 'First' }), ts: ts1,
    });

    const res = await app.inject({ method: 'GET', url: `/api/messages?thread_id=${threadId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; ts: number }[]>();
    expect(body).toHaveLength(2);
    expect(body[0].ts).toBe(ts1);
    expect(body[1].ts).toBe(ts2);
    expect(body[0].id).toBe(id1);
    expect(body[1].id).toBe(id2);
  });

  it('GET /api/messages without thread_id — returns empty array', async () => {
    // Insert a message so it would show if filtering was broken
    await db.insert(schema.messages).values({
      id: createId(), threadId, agentSessionId: null, sender: 'user', type: 'chat',
      contentJson: JSON.stringify({ text: 'hi' }), ts: Date.now(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/messages' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
