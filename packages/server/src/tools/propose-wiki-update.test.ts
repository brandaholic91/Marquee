import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeProposeWikiUpdateTool } from './propose-wiki-update.js';
import type { AgencyDb } from '../db/index.js';

describe('propose_wiki_update tool', () => {
  let mockDb: AgencyDb;
  let emittedEvents: Record<string, unknown>[];

  beforeEach(() => {
    emittedEvents = [];
    // Mock database with just the insert method we need
    mockDb = {
      insert: vi.fn((table) => ({
        values: vi.fn(() => Promise.resolve()),
      })),
    } as any as AgencyDb;
  });

  it('has correct tool name', () => {
    const broker = { emit: () => {} };
    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: null,
    });

    expect(tool.name).toBe('propose_wiki_update');
  });

  it('has correct tool description in Hungarian', () => {
    const broker = { emit: () => {} };
    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: null,
    });

    expect(tool.description).toContain('Wiki oldal');
    expect(tool.description).toContain('frissítés');
  });

  it('has correct input schema structure', () => {
    const broker = { emit: () => {} };
    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: null,
    });

    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties).toHaveProperty('page');
    expect(tool.inputSchema.properties).toHaveProperty('new_content');
    expect(tool.inputSchema.properties).toHaveProperty('reason');
    expect(tool.inputSchema.required).toEqual(['page', 'new_content', 'reason']);
  });

  it('accepts valid page names in schema', () => {
    const broker = { emit: () => {} };
    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: null,
    });

    const pageEnum = tool.inputSchema.properties.page.enum;
    expect(pageEnum).toContain('brand-voice-patterns.md');
    expect(pageEnum).toContain('seo-learnings.md');
    expect(pageEnum).toContain('content-performance.md');
    expect(pageEnum).toHaveLength(3);
  });

  it('returns proposal_id on successful execution', async () => {
    const broker = {
      emit: (_type: string, _payload: Record<string, unknown>) => {
        // no-op for this test
      },
    };

    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: 'session-123',
    });

    const result = await tool.execute({
      page: 'brand-voice-patterns.md',
      new_content: '# Updated Brand Voice\n\nNew patterns.',
      reason: 'Refined based on feedback.',
    });

    expect(result).toHaveProperty('proposal_id');
    expect(typeof result.proposal_id).toBe('string');
    expect(result.proposal_id.length).toBeGreaterThan(0);
  });

  it('emits wiki_proposal_created event with correct payload', async () => {
    const emittedCalls: Array<[string, Record<string, unknown>]> = [];
    const broker = {
      emit: (type: string, payload: Record<string, unknown>) => {
        emittedCalls.push([type, payload]);
      },
    };

    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: 'session-456',
    });

    const result = await tool.execute({
      page: 'seo-learnings.md',
      new_content: '# SEO Insights\n\nNew data.',
      reason: 'Q2 research update.',
    });

    expect(emittedCalls).toHaveLength(1);
    const [eventType, payload] = emittedCalls[0];
    expect(eventType).toBe('wiki_proposal_created');
    expect(payload.proposal_id).toBe(result.proposal_id);
    expect(payload.client_slug).toBe('test-client');
    expect(payload.wiki_page).toBe('seo-learnings.md');
    expect(payload.reason).toBe('Q2 research update.');
  });

  it('calls db.insert with correct table', async () => {
    const broker = { emit: () => {} };
    const insertMock = vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));
    mockDb.insert = insertMock as any;

    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: null,
    });

    await tool.execute({
      page: 'content-performance.md',
      new_content: '# Performance\n\nMetrics.',
      reason: 'Update metrics.',
    });

    expect(insertMock).toHaveBeenCalled();
    // Check that the first argument is the wikiProposals table (we can't directly check,
    // so we verify insert was called)
    expect(insertMock.mock.calls.length).toBe(1);
  });

  it('handles null agentSessionId gracefully', async () => {
    const broker = { emit: () => {} };

    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: null,
    });

    const result = await tool.execute({
      page: 'brand-voice-patterns.md',
      new_content: 'Content',
      reason: 'Test',
    });

    expect(result).toHaveProperty('proposal_id');
  });

  it('generates unique proposal_ids on multiple calls', async () => {
    const broker = { emit: () => {} };

    const tool = makeProposeWikiUpdateTool({
      db: mockDb,
      broker,
      clientSlug: 'test-client',
      agentSessionId: null,
    });

    const result1 = await tool.execute({
      page: 'brand-voice-patterns.md',
      new_content: 'Content 1',
      reason: 'Test 1',
    });

    const result2 = await tool.execute({
      page: 'seo-learnings.md',
      new_content: 'Content 2',
      reason: 'Test 2',
    });

    expect(result1.proposal_id).not.toBe(result2.proposal_id);
  });
});
