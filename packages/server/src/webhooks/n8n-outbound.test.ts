import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fireDeliverableShipped } from './n8n-outbound.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
const fetchMock = vi.fn();
global.fetch = fetchMock as never;

beforeEach(async () => {
  fetchMock.mockReset();
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.briefs).values({ id: 'br_1', clientSlug: 'default', sourceThreadId: null, contentMd: '{}', status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now() });
  await db.insert(schema.delegations).values({ id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director', toAgent: 'social-manager', payloadJson: '{}', status: 'complete', requestedAt: Date.now(), completedAt: Date.now() });
  await db.insert(schema.deliverables).values({ id: 'dl_1', delegationId: 'del_1', clientSlug: 'default', type: 'social_post', status: 'shipped', currentRevisionId: null, createdAt: Date.now(), updatedAt: Date.now() });
  await db.insert(schema.deliverableRevisions).values({ id: 'rv_1', deliverableId: 'dl_1', revisionNo: 1, artifactPath: '/tmp/fake.md', createdByAgent: 'social-manager', feedbackNote: null, ts: Date.now() });
  await db.update(schema.deliverables).set({ currentRevisionId: 'rv_1' });
});

describe('fireDeliverableShipped', () => {
  it('POSTs payload to webhook URL', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });
    await fireDeliverableShipped('http://n8n.example/webhook', db, 'dl_1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://n8n.example/webhook');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.event).toBe('deliverable_shipped');
    expect(body.deliverable_id).toBe('dl_1');
    expect(body.deliverable_type).toBe('social_post');
  });

  it('retries 3x with backoff on failure, then throws', async () => {
    fetchMock.mockRejectedValue(new Error('econnrefused'));
    await expect(fireDeliverableShipped('http://n8n.example/webhook', db, 'dl_1', { retryDelaysMs: [1, 1, 1] }))
      .rejects.toThrow(/econnrefused/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
