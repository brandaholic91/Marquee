import { wikiProposals } from '../db/schema.js';
import { createId } from '@paralleldrive/cuid2';
import type { AgencyDb } from '../db/index.js';

type Db = AgencyDb;

interface Broker {
  emit: (type: string, payload: Record<string, unknown>) => void;
}

export interface ProposeWikiUpdateContext {
  db: Db;
  broker: Broker;
  clientSlug: string;
  agentSessionId: string | null;
}

export function makeProposeWikiUpdateTool(ctx: ProposeWikiUpdateContext) {
  return {
    name: 'propose_wiki_update',
    description: 'Wiki oldal frissítésének javaslása. Az operátor a queue-ból approve-olja vagy elveti.',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: ['brand-voice-patterns.md', 'seo-learnings.md', 'content-performance.md'],
        },
        new_content: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['page', 'new_content', 'reason'],
    },
    execute: async (input: {
      page: string;
      new_content: string;
      reason: string;
    }) => {
      const id = createId();
      const now = Date.now();

      await ctx.db.insert(wikiProposals).values({
        id,
        clientSlug: ctx.clientSlug,
        wikiPage: input.page,
        newContent: input.new_content,
        reason: input.reason,
        agentSessionId: ctx.agentSessionId,
        createdAt: now,
      });

      ctx.broker.emit('wiki_proposal_created', {
        proposal_id: id,
        client_slug: ctx.clientSlug,
        wiki_page: input.page,
        reason: input.reason,
      });

      return { proposal_id: id };
    },
  };
}
