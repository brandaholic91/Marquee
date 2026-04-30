import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { campaigns } from "../db/schema.js";
import { getPlanByCampaignId, listCalendarItems } from "../db/queries.js";

type Db = ReturnType<typeof drizzle>;

export interface GetCampaignPlanContext {
	db: Db;
	clientSlug: string;
}

export function makeGetCampaignPlanTool(ctx: GetCampaignPlanContext) {
	return {
		name: "get_campaign_plan",
		description:
			"Lekeri egy kampany tervet es a naptar item allapotait. Hasznald, ha a Director terv-kontextusra vagy item statuszokra kerdez ra.",
		inputSchema: {
			type: "object",
			properties: {
				campaign_id: { type: "string" },
			},
			required: ["campaign_id"],
		},
		execute: async (input: { campaign_id: string }) => {
			const campaign = await ctx.db
				.select()
				.from(campaigns)
				.where(and(eq(campaigns.id, input.campaign_id), eq(campaigns.clientSlug, ctx.clientSlug)))
				.limit(1)
				.all();
			if (campaign.length === 0) {
				throw new Error("campaign not found");
			}

			const plan = getPlanByCampaignId(ctx.db, input.campaign_id);
			if (!plan) {
				return { has_plan: false };
			}

			const items = listCalendarItems(ctx.db, plan.id);
			const progress = { planned: 0, brief_created: 0, delivered: 0, cancelled: 0 };
			for (const item of items) {
				progress[item.status] += 1;
			}

			const upcoming = items
				.filter((item) => item.status === "planned" || item.status === "brief_created")
				.slice(0, 10)
				.map((item) => ({
					id: item.id,
					channel: item.channel,
					type: item.deliverableType,
					target_date: item.targetDate,
					intent: item.intent,
					key_message_ref: item.keyMessageRef,
					status: item.status,
				}));

			return {
				has_plan: true,
				plan: {
					id: plan.id,
					goal: plan.goal,
					goal_type: plan.goalType,
					audience: plan.audience,
					key_messages: plan.keyMessages,
					channel_mix: plan.channelMix,
					timeline_start: plan.timelineStart,
					timeline_end: plan.timelineEnd,
					kpi: plan.kpi,
					calendar_progress: progress,
					upcoming_items: upcoming,
				},
			};
		},
	};
}
