import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import * as schema from '../db/schema.js';
import { wikiRoutes } from '../server/routes/wiki.js';
import { readWikiPage, writeWikiPage } from '../memory/wiki.js';

describe('Wiki Integration', () => {
  let tempDir: string;
  let db: ReturnType<typeof drizzle>;
  let app: FastifyInstance;
  let sqlite: Database.Database;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `wiki-int-${Date.now()}`);
    mkdirSync(join(tempDir, 'wiki', 'clients', 'test'), { recursive: true });

    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });

    // Create minimal schema manually
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

    // Seed test client
    await db.insert(schema.clients).values({
      slug: 'test',
      name: 'Test Client',
      createdAt: Date.now(),
    });

    // Seed initial wiki page
    await writeWikiPage(tempDir, 'clients/test/brand-voice-patterns.md', '# Patterns\n');

    // Initialize fastify with mock user context
    app = Fastify();

    // Add mock auth middleware
    app.addHook('onRequest', async (req) => {
      (req as any).user = { clientSlug: 'test' };
    });

    await app.register(wikiRoutes, { db, dataDir: tempDir });
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('operátor can approve proposal and wiki file updates', async () => {
    // Create proposal in DB
    const proposalId = 'prop-test-123';
    const newContent = '# Patterns\n\n## LinkedIn\nTest pattern for LinkedIn engagement';

    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'test',
      wikiPage: 'clients/test/brand-voice-patterns.md',
      newContent: newContent,
      reason: 'Add new LinkedIn pattern',
      createdAt: Date.now(),
    });

    // Verify proposal exists in DB
    const proposalsBefore = db
      .select()
      .from(schema.wikiProposals)
      .where(eq(schema.wikiProposals.id, proposalId))
      .all();

    expect(proposalsBefore).toHaveLength(1);
    expect(proposalsBefore[0].approvedAt).toBeNull();

    // Approve via API
    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/approve`,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; proposal_id: string }>();
    expect(body.success).toBe(true);
    expect(body.proposal_id).toBe(proposalId);

    // Verify wiki file was updated
    const content = await readWikiPage(tempDir, 'clients/test/brand-voice-patterns.md');
    expect(content).toBe(newContent);
    expect(content).toContain('Test pattern for LinkedIn engagement');

    // Verify proposal is marked as approved in DB
    const proposalsAfter = db
      .select()
      .from(schema.wikiProposals)
      .where(eq(schema.wikiProposals.id, proposalId))
      .all();

    expect(proposalsAfter).toHaveLength(1);
    expect(proposalsAfter[0].approvedAt).not.toBeNull();
    expect(proposalsAfter[0].approvedBy).toBe('test');
  });

  it('reject proposal prevents wiki update', async () => {
    const proposalId = 'prop-test-reject';
    const originalContent = '# Patterns\n';
    const newContent = '# Patterns\n\n## Bad Pattern\nDo not add this';

    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'test',
      wikiPage: 'clients/test/brand-voice-patterns.md',
      newContent: newContent,
      reason: 'Add pattern',
      createdAt: Date.now(),
    });

    // Reject via API
    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/reject`,
      payload: { reason: 'Does not match brand voice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(true);

    // Verify wiki file was NOT updated
    const content = await readWikiPage(tempDir, 'clients/test/brand-voice-patterns.md');
    expect(content).toBe(originalContent);
    expect(content).not.toContain('Bad Pattern');

    // Verify proposal is marked as rejected
    const proposals = db
      .select()
      .from(schema.wikiProposals)
      .where(eq(schema.wikiProposals.id, proposalId))
      .all();

    expect(proposals[0].rejectedAt).not.toBeNull();
    expect(proposals[0].rejectionReason).toBe('Does not match brand voice');
  });

  it('cannot approve already decided proposal', async () => {
    const proposalId = 'prop-test-decided';

    await db.insert(schema.wikiProposals).values({
      id: proposalId,
      clientSlug: 'test',
      wikiPage: 'clients/test/brand-voice-patterns.md',
      newContent: '# Patterns\n## New',
      reason: 'Test',
      createdAt: Date.now(),
      approvedAt: Date.now(),
      approvedBy: 'test',
    });

    // Try to approve again
    const res = await app.inject({
      method: 'POST',
      url: `/api/wiki/proposals/${proposalId}/approve`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string }>();
    expect(body.error).toBe('proposal already decided');
  });

  it('lists pending proposals ordered by creation time', async () => {
    // Create multiple proposals
    const now = Date.now();
    const proposals = [
      {
        id: 'prop-1',
        newContent: '# Patterns\n## First',
        createdAt: now,
      },
      {
        id: 'prop-2',
        newContent: '# Patterns\n## Second',
        createdAt: now + 1000,
      },
      {
        id: 'prop-3',
        newContent: '# Patterns\n## Third',
        createdAt: now + 2000,
      },
    ];

    for (const prop of proposals) {
      await db.insert(schema.wikiProposals).values({
        id: prop.id,
        clientSlug: 'test',
        wikiPage: 'clients/test/brand-voice-patterns.md',
        newContent: prop.newContent,
        reason: 'Test',
        createdAt: prop.createdAt,
      });
    }

    // Also create an approved proposal (should not appear)
    await db.insert(schema.wikiProposals).values({
      id: 'prop-approved',
      clientSlug: 'test',
      wikiPage: 'clients/test/brand-voice-patterns.md',
      newContent: '# Patterns\n## Approved',
      reason: 'Test',
      createdAt: now + 3000,
      approvedAt: now + 3000,
      approvedBy: 'test',
    });

    // Get pending proposals
    const res = await app.inject({
      method: 'GET',
      url: '/api/wiki/proposals',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ proposals: schema.WikiProposal[] }>();

    expect(body.proposals).toHaveLength(3);
    expect(body.proposals[0].id).toBe('prop-1');
    expect(body.proposals[1].id).toBe('prop-2');
    expect(body.proposals[2].id).toBe('prop-3');
  });

  it('returns 404 for non-existent proposal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/wiki/proposals/nonexistent/approve',
      payload: {},
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: string }>();
    expect(body.error).toBe('proposal not found');
  });
});
