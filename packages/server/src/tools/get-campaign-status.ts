import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import { campaigns, briefs, deliverables } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;

export interface GetCampaignStatusContext {
  db: Db;
  clientSlug: string;
}

export function makeGetCampaignStatusTool(ctx: GetCampaignStatusContext) {
  return {
    name: 'get_campaign_status',
    description: 'Lekéri az összes aktív kampány aktuális állapotát: hány brief és deliverable tartozik hozzájuk, és mi a státuszuk. Használd ha az operátor kampány haladásáról kérdez.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const activeCampaigns = await ctx.db.select().from(campaigns)
        .where(and(eq(campaigns.clientSlug, ctx.clientSlug), eq(campaigns.status, 'active')))
        .all();

      if (activeCampaigns.length === 0) {
        return { campaigns: [], summary: 'Nincs aktív kampány.' };
      }

      const result = await Promise.all(activeCampaigns.map(async (campaign) => {
        const campaignBriefs = await ctx.db.select().from(briefs)
          .where(and(eq(briefs.clientSlug, ctx.clientSlug), eq(briefs.campaignId, campaign.id)))
          .all();

        const campaignDeliverables = await ctx.db.select().from(deliverables)
          .where(and(eq(deliverables.clientSlug, ctx.clientSlug), eq(deliverables.campaignId, campaign.id)))
          .all();

        const byStatus = campaignDeliverables.reduce<Record<string, number>>((acc, d) => {
          acc[d.status] = (acc[d.status] ?? 0) + 1;
          return acc;
        }, {});

        return {
          campaign: campaign.title,
          briefs_total: campaignBriefs.length,
          deliverables_total: campaignDeliverables.length,
          awaiting_approval: byStatus['awaiting_approval'] ?? 0,
          shipped: byStatus['shipped'] ?? 0,
          drafting: byStatus['drafting'] ?? 0,
        };
      }));

      return { campaigns: result };
    },
  };
}
