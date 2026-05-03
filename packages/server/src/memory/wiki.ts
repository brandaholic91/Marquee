import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export async function readWikiPage(
  dataDir: string,
  pageName: string
): Promise<string | null> {
  const path = join(dataDir, 'wiki', pageName);
  try {
    return await readFile(path, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeWikiPage(
  dataDir: string,
  pageName: string,
  content: string
): Promise<void> {
  const targetDir = join(dataDir, 'wiki');
  await mkdir(targetDir, { recursive: true });

  const targetPath = join(targetDir, pageName);
  const tempPath = `${targetPath}.tmp.${randomBytes(6).toString('hex')}`;

  await writeFile(tempPath, content, { mode: 0o600 });
  await rename(tempPath, targetPath);
}
