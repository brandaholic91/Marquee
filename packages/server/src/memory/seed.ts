import { mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function seedClientIfNeeded(dataDir: string, seedDir: string, clientSlug: string): Promise<void> {
  // 1. Memory templates → memory/clients/<slug>/
  const memTarget = join(dataDir, 'memory', 'clients', clientSlug);
  await mkdir(memTarget, { recursive: true });
  for (const f of await readdir(join(seedDir, 'memory'))) {
    const target = join(memTarget, f);
    if (await exists(target)) continue;
    await copyFile(join(seedDir, 'memory', f), target);
  }
  // 2. Skill recipes → skills/<role>/
  for (const role of await readdir(join(seedDir, 'skills'))) {
    const roleTarget = join(dataDir, 'skills', role);
    await mkdir(roleTarget, { recursive: true });
    for (const f of await readdir(join(seedDir, 'skills', role))) {
      const target = join(roleTarget, f);
      if (await exists(target)) continue;
      await copyFile(join(seedDir, 'skills', role, f), target);
    }
  }
  // 3. Wiki templates → wiki/clients/<slug>/
  const wikiTarget = join(dataDir, 'wiki', 'clients', clientSlug);
  await mkdir(wikiTarget, { recursive: true });
  for (const f of await readdir(join(seedDir, 'wiki'))) {
    const target = join(wikiTarget, f);
    if (await exists(target)) continue;
    await copyFile(join(seedDir, 'wiki', f), target);
  }
}

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}
