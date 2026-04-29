import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createProposal, listPending, decideProposal } from './proposals.js';
import * as schema from '../db/schema.js';

let baseDir: string;
let db: ReturnType<typeof drizzle>;

const validProfile = `---\nbusiness_description: "Foo"\ntarget_audience: ["a"]\nusp: "x"\ncompetitors: ["c"]\n---\n# Body`;

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-prop-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'Default', createdAt: Date.now() });
});

describe('memory proposals', () => {
  it('creates a pending proposal', async () => {
    const id = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'onboarding step 1',
      agentSessionId: null,
    });
    expect(id).toMatch(/^[a-z0-9]+$/);
    const pending = await listPending(db, 'default');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(id);
    expect(pending[0].reason).toBe('onboarding step 1');
  });

  it('approve writes the file and marks proposal approved', async () => {
    const id = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'r',
      agentSessionId: null,
    });
    await decideProposal(db, baseDir, id, 'approved');
    const pending = await listPending(db, 'default');
    expect(pending).toHaveLength(0);
    const all = await db.select().from(schema.memoryProposals).all();
    expect(all[0].status).toBe('approved');
    // file written via writeMemoryFile (audit row will exist)
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].source).toBe('agent:director');
  });

  it('reject does not write the file', async () => {
    const id = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'r',
      agentSessionId: null,
    });
    await decideProposal(db, baseDir, id, 'rejected');
    const all = await db.select().from(schema.memoryProposals).all();
    expect(all[0].status).toBe('rejected');
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(0);
  });
});
