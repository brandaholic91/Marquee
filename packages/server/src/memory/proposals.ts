import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { memoryProposals } from '../db/schema.js';
import { writeMemoryFile } from './write.js';

type Db = ReturnType<typeof drizzle>;

export interface CreateProposalInput {
  clientSlug: string;
  file: string;
  newContent: string;
  reason: string;
  agentSessionId: string | null;
}

export async function createProposal(db: Db, input: CreateProposalInput): Promise<string> {
  const id = createId();
  await db.insert(memoryProposals).values({
    id,
    clientSlug: input.clientSlug,
    file: input.file,
    prevContentHash: null,
    newContent: input.newContent,
    agentSessionId: input.agentSessionId,
    reason: input.reason,
    status: 'pending',
    createdAt: Date.now(),
    decidedAt: null,
  });
  return id;
}

export async function listPending(db: Db, clientSlug: string) {
  return db.select()
    .from(memoryProposals)
    .where(and(eq(memoryProposals.clientSlug, clientSlug), eq(memoryProposals.status, 'pending')))
    .orderBy(desc(memoryProposals.createdAt))
    .all();
}

export async function decideProposal(
  db: Db,
  dataDir: string,
  proposalId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const rows = await db.select().from(memoryProposals).where(eq(memoryProposals.id, proposalId)).all();
  if (rows.length === 0) throw new Error(`proposal not found: ${proposalId}`);
  const p = rows[0];
  if (p.status !== 'pending') throw new Error(`proposal not pending: ${proposalId}`);

  if (decision === 'approved') {
    await writeMemoryFile(dataDir, db, p.clientSlug, p.file, p.newContent, 'agent:director');
  }
  await db.update(memoryProposals)
    .set({ status: decision, decidedAt: Date.now() })
    .where(eq(memoryProposals.id, proposalId));
}
