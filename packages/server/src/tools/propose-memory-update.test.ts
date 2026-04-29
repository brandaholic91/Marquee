import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { makeProposeMemoryUpdateTool } from './propose-memory-update.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

const validProfile = `---\nbusiness_description: "Foo"\ntarget_audience: ["a"]\nusp: "x"\ncompetitors: ["c"]\n---\n# Body`;

beforeEach(async () => {
  events.length = 0;
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
});

describe('propose_memory_update tool', () => {
  it('creates pending proposal + emits memory_proposed event', async () => {
    const tool = makeProposeMemoryUpdateTool({
      db, broker, clientSlug: 'default', agentSessionId: null,
    });
    const r = await tool.execute({
      file: 'profile.md',
      new_content: validProfile,
      reason: 'onboarding step 1',
    });
    expect(r.proposal_id).toMatch(/^[a-z0-9]+$/);
    const all = await db.select().from(schema.memoryProposals).all();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('pending');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('memory_proposed');
  });

  it('rejects invalid frontmatter', async () => {
    const tool = makeProposeMemoryUpdateTool({
      db, broker, clientSlug: 'default', agentSessionId: null,
    });
    await expect(tool.execute({
      file: 'profile.md',
      new_content: '---\nfoo: bar\n---\nnope',
      reason: 'bad',
    })).rejects.toThrow(/missing required frontmatter/);
  });
});
