import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatchReview } from './review-dispatcher.js';
import * as schema from '../db/schema.js';

vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: class FakeAgent {
    constructor(public opts: any) {}
    async prompt(_: string) {}
  },
}));

let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: vi.fn() };

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-rd-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.chatThreads).values({ id: 'thr_1', clientSlug: 'default', title: 't', archivedAt: null });
  await db.insert(schema.briefs).values({
    id: 'br_1', clientSlug: 'default', sourceThreadId: 'thr_1', contentMd: '{}',
    status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now(),
  });
  await db.insert(schema.delegations).values({
    id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director',
    toAgent: 'copywriter', payloadJson: '{}', status: 'complete', requestedAt: Date.now(), completedAt: Date.now(),
  });
  await db.insert(schema.deliverables).values({
    id: 'dlv_1', delegationId: 'del_1', clientSlug: 'default', campaignId: null,
    type: 'blog_post', status: 'awaiting_approval',
    currentRevisionId: 'rev_1', createdAt: Date.now(), updatedAt: Date.now(),
  });
  const artDir = join(baseDir, 'artifacts', 'clients', 'default', 'dlv_1');
  mkdirSync(artDir, { recursive: true });
  const artPath = join(artDir, 'rev_001.md');
  writeFileSync(artPath, '# Test blog poszt\nEz egy teszt tartalom.');
  await db.insert(schema.deliverableRevisions).values({
    id: 'rev_1', deliverableId: 'dlv_1', revisionNo: 1,
    artifactPath: artPath, createdByAgent: 'copywriter', feedbackNote: null, ts: Date.now(),
  });
  broker.emit.mockClear();
});

describe('dispatchReview', () => {
  it('emits review_started event', async () => {
    await dispatchReview({ db, broker, dataDir: baseDir, deliverableId: 'dlv_1' });
    expect(broker.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review_started', deliverable_id: 'dlv_1' })
    );
  });

  it('throws when deliverable not found', async () => {
    await expect(
      dispatchReview({ db, broker, dataDir: baseDir, deliverableId: 'nonexistent' })
    ).rejects.toThrow(/deliverable not found/);
  });
});
