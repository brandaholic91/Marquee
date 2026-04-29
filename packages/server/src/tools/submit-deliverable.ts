import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { deliverables, deliverableRevisions, delegations } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface SubmitDeliverableContext {
  db: Db;
  broker: Broker;
  dataDir: string;
  clientSlug: string;
  delegationId: string;
  agentSlug: string;
  deliverableType: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
}

export interface SubmitDeliverableInput {
  content_md: string;
  structured_data?: Record<string, unknown>;
}

export function makeSubmitDeliverableTool(ctx: SubmitDeliverableContext) {
  return {
    name: 'submit_deliverable',
    description: 'Add be a befejezett deliverable-t. A markdown tartalom és az opcionális structured_data automatikusan elmentődik artifact fájlként, és a deliverable jóváhagyásra vár státuszba kerül.',
    inputSchema: {
      type: 'object',
      properties: {
        content_md: { type: 'string' },
        structured_data: { type: 'object' },
      },
      required: ['content_md'],
    },
    execute: async (input: SubmitDeliverableInput) => {
      const existing = await ctx.db.select().from(deliverables).where(eq(deliverables.delegationId, ctx.delegationId)).all();
      const now = Date.now();
      let deliverableId: string;
      let revisionNo: number;

      if (existing.length === 0) {
        const delegRows = await ctx.db.select().from(delegations)
          .where(eq(delegations.id, ctx.delegationId)).limit(1).all();
        const campaignId = delegRows[0]?.campaignId ?? null;

        deliverableId = createId();
        await ctx.db.insert(deliverables).values({
          id: deliverableId,
          delegationId: ctx.delegationId,
          clientSlug: ctx.clientSlug,
          campaignId,
          type: ctx.deliverableType,
          status: 'awaiting_approval',
          currentRevisionId: null,
          createdAt: now,
          updatedAt: now,
        });
        revisionNo = 1;
      } else {
        deliverableId = existing[0].id;
        const revs = await ctx.db.select().from(deliverableRevisions)
          .where(eq(deliverableRevisions.deliverableId, deliverableId)).all();
        revisionNo = revs.length + 1;
      }

      const artifactDir = join(ctx.dataDir, 'artifacts', 'clients', ctx.clientSlug, deliverableId);
      await mkdir(artifactDir, { recursive: true });
      const artifactPath = join(artifactDir, `rev_${String(revisionNo).padStart(3, '0')}.md`);
      const fileContent = composeArtifact(input.content_md, input.structured_data);
      await writeFile(artifactPath, fileContent, { mode: 0o600 });

      const revisionId = createId();
      await ctx.db.insert(deliverableRevisions).values({
        id: revisionId,
        deliverableId,
        revisionNo,
        artifactPath,
        createdByAgent: ctx.agentSlug,
        feedbackNote: null,
        ts: now,
      });

      await ctx.db.update(deliverables)
        .set({ currentRevisionId: revisionId, status: 'awaiting_approval', updatedAt: now })
        .where(eq(deliverables.id, deliverableId));

      await ctx.db.update(delegations).set({ status: 'complete', completedAt: now }).where(eq(delegations.id, ctx.delegationId));

      ctx.broker.emit({
        type: 'deliverable_submitted',
        deliverable_id: deliverableId,
        revision_no: revisionNo,
        client_slug: ctx.clientSlug,
        agent_slug: ctx.agentSlug,
        delegation_id: ctx.delegationId,
      });

      return { deliverable_id: deliverableId, revision_no: revisionNo };
    },
  };
}

function composeArtifact(contentMd: string, structuredData?: Record<string, unknown>): string {
  if (!structuredData) return contentMd;
  return `${contentMd}\n\n<!-- structured_data\n${JSON.stringify(structuredData, null, 2)}\n-->\n`;
}
