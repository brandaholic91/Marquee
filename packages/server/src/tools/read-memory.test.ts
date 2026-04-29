import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeReadMemoryTool } from './read-memory.js';

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-rm-'));
  const target = join(baseDir, 'memory', 'clients', 'default');
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, 'profile.md'),
    `---\nbusiness_description: "Foo"\ntarget_audience: []\nusp: "x"\ncompetitors: []\n---\nbody`,
    'utf8'
  );
});

describe('read_memory tool', () => {
  it('returns parsed frontmatter and body', async () => {
    const tool = makeReadMemoryTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ file: 'profile.md' });
    expect(r.frontmatter.business_description).toBe('Foo');
    expect(r.body).toBe('body');
  });

  it('throws for unknown file', async () => {
    const tool = makeReadMemoryTool({ dataDir: baseDir, clientSlug: 'default' });
    await expect(tool.execute({ file: 'nope.md' as never })).rejects.toThrow();
  });

  it('returns empty when file does not exist', async () => {
    const tool = makeReadMemoryTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ file: 'brand_voice.md' });
    expect(r.frontmatter).toEqual({});
    expect(r.body).toBe('');
  });
});
