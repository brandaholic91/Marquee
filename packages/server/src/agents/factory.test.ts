import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnAgent } from './factory.js';
import * as schema from '../db/schema.js';

vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: class FakeAgent {
    constructor(public opts: any) {}
    async prompt(text: string) { return { text }; }
  },
}));

let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: vi.fn() };

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-fac-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  broker.emit.mockClear();
});

describe('spawnAgent', () => {
  it('spawns director with director tools and warm lifecycle', async () => {
    const a = await spawnAgent({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      role: 'director', threadId: 'thr_1',
    });
    expect(a.session.lifecycle).toBe('warm');
    const tools = (a.agent as any).opts.initialState.tools.map((t: any) => t.name).sort();
    expect(tools).toEqual([
      'get_campaign_plan',
      'get_campaign_status',
      'load_skill',
      'propose_brief',
      'propose_calendar_item',
      'propose_campaign_plan',
      'propose_memory_update',
      'read_memory',
      'update_campaign_plan',
    ]);
  });

  it('spawns transient social-manager bound to a delegation', async () => {
    await db.insert(schema.briefs).values({ id: 'br_1', clientSlug: 'default', sourceThreadId: null, contentMd: '{}', status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now() });
    await db.insert(schema.delegations).values({ id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director', toAgent: 'social-manager', payloadJson: '{}', status: 'in_progress', requestedAt: Date.now(), completedAt: null });
    const a = await spawnAgent({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      role: 'social-manager', delegationId: 'del_1', deliverableType: 'social_post',
    });
    expect(a.session.lifecycle).toBe('transient');
    const tools = (a.agent as any).opts.initialState.tools.map((t: any) => t.name).sort();
    expect(tools).toEqual(['load_skill', 'read_memory', 'submit_deliverable']);
  });
});

describe('spawnAgent — progressive disclosure system prompt', () => {
  it('includes <skills> catalog but not skill body in system prompt', async () => {
    mkdirSync(join(baseDir, 'skills/director'), { recursive: true });
    writeFileSync(
      join(baseDir, 'skills/director/brief_parser.md'),
      '---\nname: brief_parser\ndescription: Parses briefs\n---\n\nSECRET BODY TEXT',
    );
    const a = await spawnAgent({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      role: 'director', threadId: 'thr_1',
    });
    const prompt = (a.agent as any).opts.initialState.systemPrompt as string;
    expect(prompt).toContain('<skill name="brief_parser">Parses briefs</skill>');
    expect(prompt).not.toContain('SECRET BODY TEXT');
  });

  it('includes identity block at start of system prompt', async () => {
    mkdirSync(join(baseDir, 'agents/director'), { recursive: true });
    writeFileSync(join(baseDir, 'agents/director/identity.md'), 'IDENTITY BLOCK CONTENT');
    const a = await spawnAgent({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      role: 'director', threadId: 'thr_1',
    });
    const prompt = (a.agent as any).opts.initialState.systemPrompt as string;
    expect(prompt).toContain('IDENTITY BLOCK CONTENT');
    expect(prompt.indexOf('IDENTITY BLOCK CONTENT')).toBeLessThan(
      prompt.indexOf('<skills>') === -1 ? prompt.length : prompt.indexOf('<skills>'),
    );
  });

  it('adds load_skill to the tool list', async () => {
    const a = await spawnAgent({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      role: 'director', threadId: 'thr_1',
    });
    const toolNames = (a.agent as any).opts.initialState.tools.map((t: any) => t.name);
    expect(toolNames).toContain('load_skill');
  });
});
