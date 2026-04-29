import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { makeSubmitDeliverableTool } from './submit-deliverable.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
let baseDir: string;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

beforeEach(async () => {
  events.length = 0;
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-sd-'));
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
    toAgent: 'social-manager', payloadJson: '{}', status: 'in_progress', requestedAt: Date.now(), completedAt: null,
  });
});

describe('submit_deliverable tool', () => {
  it('first submission creates deliverable + rev_001 + emits event', async () => {
    const tool = makeSubmitDeliverableTool({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      delegationId: 'del_1', agentSlug: 'social-manager',
      deliverableType: 'social_post',
    });
    const r = await tool.execute({
      content_md: '# Hello world',
      structured_data: { platform: 'instagram', text: 'hello', visual_brief: 'sunset' },
    });
    expect(r.deliverable_id).toMatch(/^[a-z0-9]+$/);
    expect(r.revision_no).toBe(1);

    const dels = await db.select().from(schema.deliverables).all();
    expect(dels).toHaveLength(1);
    expect(dels[0].status).toBe('awaiting_approval');
    expect(dels[0].type).toBe('social_post');

    const revs = await db.select().from(schema.deliverableRevisions).all();
    expect(revs).toHaveLength(1);
    expect(revs[0].revisionNo).toBe(1);
    expect(existsSync(revs[0].artifactPath)).toBe(true);
    const content = readFileSync(revs[0].artifactPath, 'utf8');
    expect(content).toContain('# Hello world');
    expect(content).toContain('"platform": "instagram"');

    expect(events.some((e) => e.type === 'deliverable_submitted')).toBe(true);
  });
});
