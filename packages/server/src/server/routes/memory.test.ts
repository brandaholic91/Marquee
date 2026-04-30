import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { memoryRoutes } from './memory.js';
import * as schema from '../../db/schema.js';
import { writeMemoryFile } from '../../memory/write.js';
import { createProposal } from '../../memory/proposals.js';

const validProfile = `---
business_description: "Foo"
target_audience: ["a"]
usp: "x"
competitors: ["c"]
---
# Body`;

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
let baseDir: string;

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-memory-routes-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  app = Fastify();
  await app.register(memoryRoutes, { db, dataDir: baseDir });
});

describe('GET /api/memory/clients/:slug/files', () => {
  it('returns 6 entries with exists flags', async () => {
    // Write one file so one exists = true
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');

    const res = await app.inject({ method: 'GET', url: '/api/memory/clients/default/files' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ file: string; exists: boolean }[]>();
    expect(body).toHaveLength(6);
    const profile = body.find(f => f.file === 'profile.md');
    expect(profile).toBeDefined();
    expect(profile!.exists).toBe(true);
    const other = body.filter(f => f.file !== 'profile.md');
    expect(other.every(f => !f.exists)).toBe(true);
  });
});

describe('GET /api/memory/clients/:slug/:file', () => {
  it('returns parsed content for existing file', async () => {
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    const res = await app.inject({ method: 'GET', url: '/api/memory/clients/default/profile.md' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ frontmatter: Record<string, unknown>; body: string; rawContent: string }>();
    expect(body.frontmatter.business_description).toBe('Foo');
    expect(body.body.trim()).toContain('# Body');
    expect(body.rawContent).toContain('business_description');
  });

  it('returns 404 for missing file', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/memory/clients/default/profile.md' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for unknown filename outside MEMORY_FILES', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/memory/clients/default/random.md' });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /api/memory/clients/:slug/:file', () => {
  it('writes file and creates audit row with source=user', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/memory/clients/default/profile.md',
      payload: { content: validProfile },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    // Verify audit row
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].source).toBe('user');
    expect(audit[0].clientSlug).toBe('default');
    expect(audit[0].file).toBe('profile.md');
  });

  it('returns 400 on invalid frontmatter', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/memory/clients/default/profile.md',
      payload: { content: '---\nfoo: bar\n---\nbody' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for unknown filename outside MEMORY_FILES', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/memory/clients/default/random.md',
      payload: { content: validProfile },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/memory/clients/:slug/proposals', () => {
  it('returns only pending proposals', async () => {
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    // Insert a pending proposal and an approved one
    await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'test',
      agentSessionId: null,
    });
    const res = await app.inject({ method: 'GET', url: '/api/memory/clients/default/proposals?status=pending' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string }[]>();
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body.every(p => p.status === 'pending')).toBe(true);
  });
});

describe('POST /api/memory/proposals/:id/approve', () => {
  it('writes file (audit row source=agent:director) and marks approved', async () => {
    const proposalId = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'agent wants to update',
      agentSessionId: null,
    });

    const res = await app.inject({ method: 'POST', url: `/api/memory/proposals/${proposalId}/approve` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    // Proposal should be approved
    const proposals = await db.select().from(schema.memoryProposals).all();
    expect(proposals[0].status).toBe('approved');

    // Audit row should exist with source='agent:director'
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].source).toBe('agent:director');
  });

  it('returns 400 if proposal already decided', async () => {
    const proposalId = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'test',
      agentSessionId: null,
    });
    // First approval
    await app.inject({ method: 'POST', url: `/api/memory/proposals/${proposalId}/approve` });
    // Second attempt should fail
    const res = await app.inject({ method: 'POST', url: `/api/memory/proposals/${proposalId}/approve` });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/memory/proposals/:id/reject', () => {
  it('marks rejected without writing the file', async () => {
    const proposalId = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'agent wants to update',
      agentSessionId: null,
    });

    const res = await app.inject({ method: 'POST', url: `/api/memory/proposals/${proposalId}/reject` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    // Proposal should be rejected
    const proposals = await db.select().from(schema.memoryProposals).all();
    expect(proposals[0].status).toBe('rejected');

    // No audit row (file was NOT written)
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(0);
  });
});

describe('GET /api/memory/clients/:slug/:file/audit', () => {
  it('returns audit rows ordered by ts DESC', async () => {
    // Write file twice to create 2 audit rows
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    // Small delay to get distinct timestamps
    await new Promise(r => setTimeout(r, 5));
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile + '\nUpdated', 'agent:director');

    const res = await app.inject({ method: 'GET', url: '/api/memory/clients/default/profile.md/audit' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ source: string; ts: number }[]>();
    expect(body).toHaveLength(2);
    // Most recent first
    expect(body[0].ts).toBeGreaterThanOrEqual(body[1].ts);
    expect(body[0].source).toBe('agent:director');
    expect(body[1].source).toBe('user');
  });

  it('returns 400 for unknown filename outside MEMORY_FILES', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/memory/clients/default/random.md/audit' });
    expect(res.statusCode).toBe(400);
  });
});
