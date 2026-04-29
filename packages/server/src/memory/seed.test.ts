import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedClientIfNeeded } from './seed.js';

let dataDir: string;
let seedDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'marquee-data-'));
  seedDir = mkdtempSync(join(tmpdir(), 'marquee-seed-'));
  mkdirSync(join(seedDir, 'memory'), { recursive: true });
  writeFileSync(join(seedDir, 'memory', 'profile.md'), '---\nbusiness_description: ""\ntarget_audience: []\nusp: ""\ncompetitors: []\n---\n', 'utf8');
  mkdirSync(join(seedDir, 'skills', 'director'), { recursive: true });
  writeFileSync(join(seedDir, 'skills', 'director', 'a.md'), 'director recipe', 'utf8');
});

describe('seedClientIfNeeded', () => {
  it('copies seed memory + skills on first run', async () => {
    await seedClientIfNeeded(dataDir, seedDir, 'default');
    expect(existsSync(join(dataDir, 'memory', 'clients', 'default', 'profile.md'))).toBe(true);
    expect(existsSync(join(dataDir, 'skills', 'director', 'a.md'))).toBe(true);
  });

  it('does not overwrite existing files', async () => {
    await seedClientIfNeeded(dataDir, seedDir, 'default');
    const path = join(dataDir, 'memory', 'clients', 'default', 'profile.md');
    writeFileSync(path, 'modified by user', 'utf8');
    await seedClientIfNeeded(dataDir, seedDir, 'default');
    expect(readFileSync(path, 'utf8')).toBe('modified by user');
  });
});
