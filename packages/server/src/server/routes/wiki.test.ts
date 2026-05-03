import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
