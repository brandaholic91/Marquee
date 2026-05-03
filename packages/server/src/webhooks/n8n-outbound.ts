import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { deliverables, deliverableRevisions } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;

export interface FireOpts {
  retryDelaysMs?: number[];
}

export async function fireDeliverableShipped(
  webhookUrl: string,
  db: Db,
  deliverableId: string,
  opts: FireOpts = {}
): Promise<void> {
  const d = (await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).all())[0];
  if (!d) throw new Error(`deliverable not found: ${deliverableId}`);
  const rev = (await db.select().from(deliverableRevisions).where(eq(deliverableRevisions.id, d.currentRevisionId!)).all())[0];
  let contentMd = '';
  let structured: Record<string, unknown> | null = null;
  try {
    const raw = await readFile(rev.artifactPath, 'utf8');
    contentMd = raw;
    const m = raw.match(/<!--\s*structured_data\s*([\s\S]*?)\s*-->/);
    if (m) structured = JSON.parse(m[1]);
  } catch { /* artifact missing — still send with empty content */ }

  const payload = {
    event: 'deliverable_shipped',
    deliverable_id: d.id,
    title: d.title,
    deliverable_type: d.type,
    client_slug: d.clientSlug,
    current_revision: rev.revisionNo,
    artifact_path: rev.artifactPath,
    content_md: contentMd,
    structured_data: structured,
    shipped_at: d.updatedAt,
    approved_by: 'human',
  };

  const delays = opts.retryDelaysMs ?? [1000, 5000, 30000];
  let lastErr: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < delays.length - 1) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }
  throw lastErr;
}
