import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, ne, like } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { briefs, campaigns } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (event: Record<string, unknown>) => void; }

const SPECIALIST_FOR: Record<string, string[]> = {
  copywriter: ['email', 'blog_post'],
  'social-manager': ['social_post'],
  'paid-specialist': ['ad_copy'],
};

export interface ProposeBriefInput {
  title: string;
  content_md: string;
  deliverable_type: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
  target_specialist: 'copywriter' | 'social-manager' | 'paid-specialist';
  platform?: string;
  campaign_name?: string;
}

export interface ProposeBriefContext {
  db: Db;
  broker: Broker;
  clientSlug: string;
  threadId: string;
}

export function makeProposeBriefTool(ctx: ProposeBriefContext) {
  return {
    name: 'propose_brief',
    description: 'Javasolj egy briefet az operátornak. A brief draft státuszban kerül a chat-be approval kártyaként; az operátor approve-olja és a megfelelő specialist megkapja.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content_md: { type: 'string' },
        deliverable_type: { type: 'string', enum: ['social_post', 'email', 'blog_post', 'ad_copy'] },
        target_specialist: { type: 'string', enum: ['copywriter', 'social-manager', 'paid-specialist'] },
        platform: { type: 'string' },
        campaign_name: { type: 'string', description: 'Opcionális kampánynév. Ha meg van adva, a brief egy kampányhoz tartozik. Azonos névvel több brief is kerülhet egy kampányba.' },
      },
      required: ['title', 'content_md', 'deliverable_type', 'target_specialist'],
    },
    execute: async (input: ProposeBriefInput) => {
      const allowed = SPECIALIST_FOR[input.target_specialist] ?? [];
      if (!allowed.includes(input.deliverable_type)) {
        throw new Error(`${input.target_specialist} cannot produce ${input.deliverable_type}`);
      }

      // Find or create campaign if campaign_name provided
      let campaignId: string | null = null;
      if (input.campaign_name) {
        const existing = await ctx.db.select().from(campaigns)
          .where(and(
            eq(campaigns.clientSlug, ctx.clientSlug),
            like(campaigns.title, input.campaign_name),
            ne(campaigns.status, 'archived'),
          ))
          .limit(1).all();
        if (existing.length > 0) {
          campaignId = existing[0].id;
        } else {
          campaignId = createId();
          await ctx.db.insert(campaigns).values({
            id: campaignId,
            clientSlug: ctx.clientSlug,
            title: input.campaign_name,
            status: 'active',
            createdAt: Date.now(),
          });
        }
      }

      const id = createId();
      await ctx.db.insert(briefs).values({
        id,
        clientSlug: ctx.clientSlug,
        sourceThreadId: ctx.threadId,
        campaignId,
        contentMd: JSON.stringify({
          title: input.title,
          body: input.content_md,
          deliverable_type: input.deliverable_type,
          target_specialist: input.target_specialist,
          platform: input.platform ?? null,
        }),
        status: 'draft',
        createdAt: Date.now(),
        dispatchedAt: null,
      });
      ctx.broker.emit({
        type: 'brief_proposed',
        brief_id: id,
        client_slug: ctx.clientSlug,
        thread_id: ctx.threadId,
        title: input.title,
        content_md: input.content_md,
        deliverable_type: input.deliverable_type,
        target_specialist: input.target_specialist,
        platform: input.platform ?? null,
      });
      return { brief_id: id };
    },
  };
}
