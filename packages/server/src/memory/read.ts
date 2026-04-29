import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

export interface MemoryFileContent {
  frontmatter: Record<string, unknown>;
  body: string;
  rawContent: string;
}

export async function readMemoryFile(
  dataDir: string,
  clientSlug: string,
  file: string
): Promise<MemoryFileContent | null> {
  const path = join(dataDir, 'memory', 'clients', clientSlug, file);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
    rawContent: raw,
  };
}
