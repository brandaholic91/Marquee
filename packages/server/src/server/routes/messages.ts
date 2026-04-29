import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, asc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { messages } from '../../db/schema.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface MessagesRoutesOpts {
  db: Db;
  broker: Broker;
}

export const messagesRoutes: FastifyPluginAsync<MessagesRoutesOpts> = async (app, opts) => {
  const { db, broker } = opts;

  app.post<{ Body: { thread_id: string; content: string } }>('/api/messages', async (req, reply) => {
    const { thread_id, content } = req.body;
    const id = createId();
    const ts = Date.now();
    await db.insert(messages).values({
      id,
      threadId: thread_id,
      agentSessionId: null,
      sender: 'user',
      type: 'chat',
      contentJson: JSON.stringify({ text: content }),
      ts,
    });
    broker.emit({ type: 'chat_message', message_id: id, thread_id, sender: 'user', text: content, ts });
    return reply.code(201).send({ message_id: id });
  });

  app.get<{ Querystring: { thread_id: string } }>('/api/messages', async (req) => {
    const tid = req.query.thread_id;
    if (!tid) return [];
    return db.select().from(messages)
      .where(eq(messages.threadId, tid))
      .orderBy(asc(messages.ts))
      .all();
  });
};
