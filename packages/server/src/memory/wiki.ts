import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';

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

/**
 * Write a wiki page to disk and commit it to git if available.
 * Silently continues if git is not available or not a git repo.
 */
export async function writeWikiPageWithGit(
  dataDir: string,
  pageName: string,
  content: string,
  commitMessage: string
): Promise<void> {
  // Write the file first
  await writeWikiPage(dataDir, pageName, content);

  // Try to commit to git (fail gracefully if not a repo)
  try {
    const filePath = join('wiki', pageName);
    execSync(`cd "${dataDir}" && git add "${filePath}" && git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
      stdio: 'pipe',
    });
  } catch (err) {
    // Expected if not in a git repo or if git is not available
    console.warn('Git commit failed (expected if not in repo):', err instanceof Error ? err.message : err);
  }
}
