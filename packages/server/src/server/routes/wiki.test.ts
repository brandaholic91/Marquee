import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { wikiRoutes } from './wiki.js';
import * as schema from '../../db/schema.js';
import { writeWikiPage } from '../../memory/wiki.js';

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
let baseDir: string;
let sqlite: Database.Database;

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-wiki-routes-'));
  mkdirSync(join(baseDir, 'wiki/clients/default'), { recursive: true });
  sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });

  // Create minimal schema manually (migrations have issues in test env)
  sqlite.exec(`
    CREATE TABLE clients (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE agent_sessions (
      id TEXT PRIMARY KEY,
      client_slug TEXT NOT NULL,
      agent_slug TEXT NOT NULL,
      lifecycle TEXT NOT NULL,
      parent_delegation_id TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      FOREIGN KEY (client_slug) REFERENCES clients(slug)
    );
    CREATE TABLE wiki_proposals (
      id TEXT PRIMARY KEY,
      client_slug TEXT NOT NULL,
      wiki_page TEXT NOT NULL,
      new_content TEXT NOT NULL,
      reason TEXT NOT NULL,
      agent_session_id TEXT,
      created_at INTEGER NOT NULL,
      approved_at INTEGER,
      rejected_at INTEGER,
      approved_by TEXT,
      rejection_reason TEXT,
      FOREIGN KEY (client_slug) REFERENCES clients(slug),
      FOREIGN KEY (agent_session_id) REFERENCES agent_sessions(id)
    );
    CREATE INDEX idx_wiki_proposals_client_slug ON wiki_proposals (client_slug);
    CREATE INDEX idx_wiki_proposals_created_at ON wiki_proposals (created_at);
  `);

  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  app = Fastify();
  await app.register(wikiRoutes, { db, dataDir: baseDir });
});

describe('GET /api/wiki/:page', () => {
  it('returns wiki page content for valid pages', async () => {
    const content = '# Brand Voice Patterns\n\nThis is a test page.';
    await writeWikiPage(baseDir, 'clients/default/brand-voice-patterns.md', content);

    const res = await app.inject({ method: 'GET', url: '/api/wiki/brand-voice-patterns.md' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ page: string; content: string }>();
    expect(body.page).toBe('brand-voice-patterns.md');
    expect(body.content).toBe(content);
  });

  it('returns empty string for missing page', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/wiki/brand-voice-patterns.md' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ page: string; content: string }>();
    expect(body.page).toBe('brand-voice-patterns.md');
    expect(body.content).toBe('');
  });

  it('returns 400 for disallowed pages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/wiki/random-page.md' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid page' });
  });

  it('returns content for seo-learnings.md', async () => {
    const content = '# SEO Learnings\n\nTest content.';
    await writeWikiPage(baseDir, 'clients/default/seo-learnings.md', content);

    const res = await app.inject({ method: 'GET', url: '/api/wiki/seo-learnings.md' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ page: string; content: string }>();
    expect(body.content).toBe(content);
  });

  it('returns content for content-performance.md', async () => {
    const content = '# Content Performance\n\nAnalytics data.';
    await writeWikiPage(baseDir, 'clients/default/content-performance.md', content);

    const res = await app.inject({ method: 'GET', url: '/api/wiki/content-performance.md' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ page: string; content: string }>();
    expect(body.content).toBe(content);
  });

  it('returns content for SCHEMA.md', async () => {
    const content = '# Schema\n\nDatabase schema docs.';
    await writeWikiPage(baseDir, 'clients/default/SCHEMA.md', content);

    const res = await app.inject({ method: 'GET', url: '/api/wiki/SCHEMA.md' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ page: string; content: string }>();
    expect(body.content).toBe(content);
  });
});

describe('GET /api/wiki/proposals', () => {
  it('returns empty list when no proposals exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/wiki/proposals' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ proposals: unknown[] }>();
    expect(body.proposals).toEqual([]);
  });

  it('returns only pending proposals for the client', async () => {
    const now = Date.now();

    // Insert a pending proposal
    await db.insert(schema.wikiProposals).values({
      id: 'prop1',
      clientSlug: 'default',
      wikiPage: 'brand-voice-patterns.md',
      newContent: '# Updated',
      reason: 'test',
      agentSessionId: null,
      createdAt: now,
      approvedAt: null,
      rejectedAt: null,
      approvedBy: null,
      rejectionReason: null,
    });

    // Insert an approved proposal (should be filtered out)
    await db.insert(schema.wikiProposals).values({
      id: 'prop2',
      clientSlug: 'default',
      wikiPage: 'seo-learnings.md',
      newContent: '# Approved',
      reason: 'approved',
      agentSessionId: null,
      createdAt: now + 1000,
      approvedAt: now + 2000,
      rejectedAt: null,
      approvedBy: 'user1',
      rejectionReason: null,
    });

    const res = await app.inject({ method: 'GET', url: '/api/wiki/proposals' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ proposals: any[] }>();
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0].id).toBe('prop1');
  });
});

describe('POST /api/wiki/proposals/:id/approve', () => {
  it('approves a pending proposal and writes the file', async () => {
    const now = Date.now();
    const proposalId = 'prop-approve-1';
    const pageName = 'clients/default/brand-voice-patterns.md';

    // Insert a pending proposal
    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'default',
      wikiPage: pageName,
      newContent: '# Updated Brand Voice\n\nNew patterns here.',
      reason: 'Added new patterns',
      agentSessionId: null,
      createdAt: now,
      approvedAt: null,
      rejectedAt: null,
      approvedBy: null,
      rejectionReason: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/approve`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; proposal_id: string }>();
    expect(body.success).toBe(true);
    expect(body.proposal_id).toBe(proposalId);

    // Verify database was updated
    const updated = db.select().from(schema.wikiProposals).where(eq(schema.wikiProposals.id, proposalId)).all();
    expect(updated).toHaveLength(1);
    expect(updated[0].approvedAt).not.toBeNull();
    expect(updated[0].approvedBy).toBe('default');
    expect(updated[0].rejectedAt).toBeNull();

    // Verify file was written
    const { readFile } = await import('node:fs/promises');
    const filePath = join(baseDir, 'wiki', pageName);
    const content = await readFile(filePath, 'utf8');
    expect(content).toBe('# Updated Brand Voice\n\nNew patterns here.');
  });

  it('returns 404 if proposal does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/wiki/proposals/nonexistent/approve',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'proposal not found' });
  });

  it('returns 400 if proposal is already approved', async () => {
    const now = Date.now();
    const proposalId = 'prop-already-approved';

    // Insert an already-approved proposal
    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'default',
      wikiPage: 'brand-voice-patterns.md',
      newContent: '# Updated',
      reason: 'test',
      agentSessionId: null,
      createdAt: now,
      approvedAt: now + 1000,
      rejectedAt: null,
      approvedBy: 'user1',
      rejectionReason: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/approve`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'proposal already decided' });
  });

  it('returns 400 if proposal is already rejected', async () => {
    const now = Date.now();
    const proposalId = 'prop-already-rejected';

    // Insert an already-rejected proposal
    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'default',
      wikiPage: 'brand-voice-patterns.md',
      newContent: '# Updated',
      reason: 'test',
      agentSessionId: null,
      createdAt: now,
      approvedAt: null,
      rejectedAt: now + 1000,
      approvedBy: null,
      rejectionReason: 'Spam',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/approve`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'proposal already decided' });
  });
});

describe('POST /api/wiki/proposals/:id/reject', () => {
  it('rejects a pending proposal without writing file', async () => {
    const now = Date.now();
    const proposalId = 'prop-reject-1';

    // Insert a pending proposal
    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'default',
      wikiPage: 'brand-voice-patterns.md',
      newContent: '# Bad content',
      reason: 'Spam proposal',
      agentSessionId: null,
      createdAt: now,
      approvedAt: null,
      rejectedAt: null,
      approvedBy: null,
      rejectionReason: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/reject`,
      payload: { reason: 'This is spam' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; proposal_id: string }>();
    expect(body.success).toBe(true);
    expect(body.proposal_id).toBe(proposalId);

    // Verify database was updated
    const updated = db.select().from(schema.wikiProposals).where(eq(schema.wikiProposals.id, proposalId)).all();
    expect(updated).toHaveLength(1);
    expect(updated[0].rejectedAt).not.toBeNull();
    expect(updated[0].rejectionReason).toBe('This is spam');
    expect(updated[0].approvedAt).toBeNull();
  });

  it('rejects without a reason', async () => {
    const now = Date.now();
    const proposalId = 'prop-reject-no-reason';

    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'default',
      wikiPage: 'seo-learnings.md',
      newContent: '# Bad',
      reason: 'Test',
      agentSessionId: null,
      createdAt: now,
      approvedAt: null,
      rejectedAt: null,
      approvedBy: null,
      rejectionReason: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/reject`,
      payload: {},
    });

    expect(res.statusCode).toBe(200);

    // Verify rejection with null reason
    const updated = db.select().from(schema.wikiProposals).where(eq(schema.wikiProposals.id, proposalId)).all();
    expect(updated[0].rejectedAt).not.toBeNull();
    expect(updated[0].rejectionReason).toBeNull();
  });

  it('returns 404 if proposal does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/wiki/proposals/nonexistent/reject',
      payload: { reason: 'Not found' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'proposal not found' });
  });

  it('returns 400 if proposal is already approved', async () => {
    const now = Date.now();
    const proposalId = 'prop-already-approved-reject';

    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'default',
      wikiPage: 'brand-voice-patterns.md',
      newContent: '# Updated',
      reason: 'test',
      agentSessionId: null,
      createdAt: now,
      approvedAt: now + 1000,
      rejectedAt: null,
      approvedBy: 'user1',
      rejectionReason: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/reject`,
      payload: { reason: 'Too late' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'proposal already decided' });
  });

  it('returns 400 if proposal is already rejected', async () => {
    const now = Date.now();
    const proposalId = 'prop-already-rejected-reject';

    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'default',
      wikiPage: 'brand-voice-patterns.md',
      newContent: '# Updated',
      reason: 'test',
      agentSessionId: null,
      createdAt: now,
      approvedAt: null,
      rejectedAt: now + 1000,
      approvedBy: null,
      rejectionReason: 'Already rejected',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/reject`,
      payload: { reason: 'Double rejection' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'proposal already decided' });
  });
});
