import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeReadWikiTool } from './read-wiki.js';

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-rw-'));
  const target = join(baseDir, 'wiki', 'clients', 'default');
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, 'brand-voice-patterns.md'),
    '# Brand Voice Patterns\n\nDirect, actionable tone.',
    'utf8'
  );
  writeFileSync(
    join(target, 'seo-learnings.md'),
    '# SEO Learnings\n\nKeyword research insights.',
    'utf8'
  );
  writeFileSync(
    join(target, 'content-performance.md'),
    '# Content Performance\n\nEngagement metrics and trends.',
    'utf8'
  );
  writeFileSync(
    join(target, 'SCHEMA.md'),
    '# Wiki Schema\n\nStructure documentation.',
    'utf8'
  );
});

afterEach(() => {
  if (baseDir) {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

describe('read_wiki tool', () => {
  it('reads wiki page content for brand-voice-patterns.md', async () => {
    const tool = makeReadWikiTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ page: 'brand-voice-patterns.md' });
    expect(r.page).toBe('brand-voice-patterns.md');
    expect(r.content).toContain('Direct, actionable tone');
  });

  it('reads wiki page content for seo-learnings.md', async () => {
    const tool = makeReadWikiTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ page: 'seo-learnings.md' });
    expect(r.page).toBe('seo-learnings.md');
    expect(r.content).toContain('Keyword research insights');
  });

  it('reads wiki page content for content-performance.md', async () => {
    const tool = makeReadWikiTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ page: 'content-performance.md' });
    expect(r.page).toBe('content-performance.md');
    expect(r.content).toContain('Engagement metrics');
  });

  it('reads wiki page content for SCHEMA.md', async () => {
    const tool = makeReadWikiTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ page: 'SCHEMA.md' });
    expect(r.page).toBe('SCHEMA.md');
    expect(r.content).toContain('Structure documentation');
  });

  it('returns empty string when page does not exist', async () => {
    // Create a second client with no files
    const target2 = join(baseDir, 'wiki', 'clients', 'empty');
    mkdirSync(target2, { recursive: true });

    const tool = makeReadWikiTool({ dataDir: baseDir, clientSlug: 'empty' });
    const r = await tool.execute({ page: 'brand-voice-patterns.md' });
    expect(r.page).toBe('brand-voice-patterns.md');
    expect(r.content).toBe('');
  });

  it('rejects unknown page names', async () => {
    const tool = makeReadWikiTool({ dataDir: baseDir, clientSlug: 'default' });
    await expect(tool.execute({ page: 'unknown.md' as never })).rejects.toThrow(
      'unknown wiki page: unknown.md'
    );
  });

  it('has correct tool metadata', () => {
    const tool = makeReadWikiTool({ dataDir: baseDir, clientSlug: 'default' });
    expect(tool.name).toBe('read_wiki');
    expect(tool.description).toContain('Wiki oldal');
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties.page.enum).toEqual([
      'brand-voice-patterns.md',
      'seo-learnings.md',
      'content-performance.md',
      'SCHEMA.md',
    ]);
    expect(tool.inputSchema.required).toEqual(['page']);
  });

  it('trims whitespace from returned content', async () => {
    const tool = makeReadWikiTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ page: 'brand-voice-patterns.md' });
    expect(r.content).toBe(r.content.trim());
  });
});
