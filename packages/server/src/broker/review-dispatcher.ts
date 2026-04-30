import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { deliverables, deliverableRevisions } from '../db/schema.js';
import { spawnAgent } from '../agents/factory.js';
import { AuthManager } from '../providers/auth.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface DispatchReviewInput {
  db: Db;
  broker: Broker;
  dataDir: string;
  deliverableId: string;
  authManager?: AuthManager;
}

export async function dispatchReview(input: DispatchReviewInput): Promise<void> {
  const rows = await input.db.select().from(deliverables)
    .where(eq(deliverables.id, input.deliverableId)).all();
  if (rows.length === 0) throw new Error(`deliverable not found: ${input.deliverableId}`);
  const deliverable = rows[0];

  let artifactContent = '(tartalom nem érhető el)';
  if (deliverable.currentRevisionId) {
    const revRows = await input.db.select().from(deliverableRevisions)
      .where(eq(deliverableRevisions.id, deliverable.currentRevisionId)).all();
    if (revRows.length > 0 && revRows[0].artifactPath) {
      try {
        artifactContent = await readFile(revRows[0].artifactPath, 'utf-8');
      } catch {
        // artifact missing — continue with placeholder
      }
    }
  }

  input.broker.emit({ type: 'review_started', deliverable_id: input.deliverableId });

  const { agent } = await spawnAgent({
    db: input.db,
    broker: input.broker,
    dataDir: input.dataDir,
    clientSlug: deliverable.clientSlug,
    role: 'brand-voice-guardian',
    deliverableId: input.deliverableId,
    authManager: input.authManager,
  });

  const prompt = [
    '# Brand Voice Ellenőrzés',
    '',
    `Deliverable típus: ${deliverable.type}`,
    '',
    '## Deliverable szövege',
    artifactContent,
    '',
    'Ellenőrizd a fenti szöveget a brand voice guidelines alapján.',
    'Hívd meg a submit_review tool-t a strukturált visszajelzéssel.',
  ].join('\n');

  agent.prompt(prompt).catch((err) => {
    input.broker.emit({
      type: 'error',
      source: 'guardian',
      deliverable_id: input.deliverableId,
      message: String(err),
    });
  });
}
