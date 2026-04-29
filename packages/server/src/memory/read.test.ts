import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readMemoryFile } from './read.js';

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-mem-'));
  const target = join(baseDir, 'memory', 'clients', 'default');
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, 'profile.md'),
    `---\nbusiness_description: "Foo Bar"\ntarget_audience: ["a"]\nusp: "x"\ncompetitors: ["c1"]\n---\n# Profile body\nHello.`,
    'utf8'
  );
});

describe('readMemoryFile', () => {
  it('parses frontmatter and body for default client', async () => {
    const r = await readMemoryFile(baseDir, 'default', 'profile.md');
    expect(r!.frontmatter.business_description).toBe('Foo Bar');
    expect(r!.frontmatter.target_audience).toEqual(['a']);
    expect(r!.body.trim()).toContain('Profile body');
  });

  it('returns null for missing file', async () => {
    const r = await readMemoryFile(baseDir, 'default', 'brand_voice.md');
    expect(r).toBeNull();
  });

  it('returns null for missing client', async () => {
    const r = await readMemoryFile(baseDir, 'other', 'profile.md');
    expect(r).toBeNull();
  });
});
