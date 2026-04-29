import { writeFile, rename, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import matter from 'gray-matter';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { validateFrontmatter } from './validate.js';
import { memoryAudit } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;

export async function writeMemoryFile(
  dataDir: string,
  db: Db,
  clientSlug: string,
  file: string,
  newContent: string,
  source: string
): Promise<void> {
  // 1. validate
  const parsed = matter(newContent);
  validateFrontmatter(file, parsed.data as Record<string, unknown>);

  const targetDir = join(dataDir, 'memory', 'clients', clientSlug);
  await mkdir(targetDir, { recursive: true });
  const targetPath = join(targetDir, file);
  const tempPath = `${targetPath}.tmp.${randomBytes(6).toString('hex')}`;

  // 2. read existing for prev_hash
  let prevHash: string | null = null;
  try {
    const prev = await readFile(targetPath, 'utf8');
    prevHash = sha256(prev);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  // 3. write to temp + atomic rename
  await writeFile(tempPath, newContent, { mode: 0o600 });
  await rename(tempPath, targetPath);

  // 4. audit log
  await db.insert(memoryAudit).values({
    clientSlug,
    file,
    source,
    prevContentHash: prevHash,
    newContentHash: sha256(newContent),
    ts: Date.now(),
  });
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}
