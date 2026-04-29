import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { writeMemoryFile } from './write.js';
import * as schema from '../db/schema.js';

let baseDir: string;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-mem-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  // Seed default client
  await db.insert(schema.clients).values({ slug: 'default', name: 'Default', createdAt: Date.now() });
});

const validProfile = `---
business_description: "Foo"
target_audience: ["a"]
usp: "x"
competitors: ["c"]
---
# Body`;

describe('writeMemoryFile', () => {
  it('atomically writes file and creates audit row', async () => {
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    const path = join(baseDir, 'memory', 'clients', 'default', 'profile.md');
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(validProfile);
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].source).toBe('user');
    expect(audit[0].file).toBe('profile.md');
    expect(audit[0].newContentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects content with invalid frontmatter', async () => {
    const bad = `---\nfoo: bar\n---\n# Body`;
    await expect(
      writeMemoryFile(baseDir, db, 'default', 'profile.md', bad, 'user')
    ).rejects.toThrow(/missing required frontmatter/);
  });

  it('records prev_content_hash on overwrite', async () => {
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile + '\n# Updated', 'agent:director');
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(2);
    expect(audit[1].prevContentHash).toBe(audit[0].newContentHash);
    expect(audit[1].source).toBe('agent:director');
  });

  it('does not leave .tmp files behind', async () => {
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    const dir = join(baseDir, 'memory', 'clients', 'default');
    const files = readdirSync(dir);
    expect(files.some((f) => f.includes('.tmp'))).toBe(false);
  });
});
