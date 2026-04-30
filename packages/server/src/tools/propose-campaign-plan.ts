import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { campaigns, messages } from "../db/schema.js";

type Db = ReturnType<typeof drizzle>;
interface Broker {
	emit: (event: Record<string, unknown>) => void;
}

type GoalType = "lead-gen" | "awareness" | "nurture" | "activation" | "retention" | "other";
type Channel = "linkedin" | "email" | "blog" | "landing" | "ad" | "other";
type DeliverableType = "social_post" | "email" | "blog_post" | "ad_copy" | "content_brief_seo" | "seo_report";

export interface ProposeCampaignPlanInput {
	campaign_id: string;
	goal: string;
	goal_type: GoalType;
	audience: string;
	key_messages: Array<{ id: string; text: string }>;
	channel_mix: Array<{ channel: string; weight: number; note?: string }>;
	timeline_start?: number;
	timeline_end?: number;
	kpi?: string;
	calendar_items: Array<{
		channel: Channel;
		deliverable_type?: DeliverableType;
		target_date: number;
		intent: string;
		key_message_ref?: string;
	}>;
	rationale: string;
}

export interface ProposeCampaignPlanContext {
	db: Db;
	broker: Broker;
	clientSlug: string;
	threadId: string;
}

function validate(input: ProposeCampaignPlanInput): void {
	if (!input.goal.trim()) throw new Error("goal is required");
	if (!input.audience.trim()) throw new Error("audience is required");
	if (!input.rationale.trim()) throw new Error("rationale is required");
	const ids = new Set<string>();
	for (const km of input.key_messages) {
		if (!km.id.trim() || !km.text.trim()) throw new Error("key_messages entries must have id and text");
		if (ids.has(km.id)) throw new Error("key_messages ids must be unique");
		ids.add(km.id);
	}
	const totalWeight = input.channel_mix.reduce((sum, c) => sum + c.weight, 0);
	if (totalWeight > 100) throw new Error("channel_mix total weight must be <= 100");
	for (const item of input.calendar_items) {
		if (item.key_message_ref && !ids.has(item.key_message_ref)) {
			throw new Error("calendar item key_message_ref must reference key_messages.id");
		}
	}
}

export function makeProposeCampaignPlanTool(ctx: ProposeCampaignPlanContext) {
	return {
		name: "propose_campaign_plan",
		description: "Javasolj kampanytervet. Nem ment kozvetlenul tervet, csak jovahagyasra varo javaslatot hoz letre.",
		inputSchema: {
			type: "object",
			properties: {
				campaign_id: { type: "string" },
				goal: { type: "string" },
				goal_type: { type: "string" },
				audience: { type: "string" },
				key_messages: { type: "array" },
				channel_mix: { type: "array" },
				timeline_start: { type: "number" },
				timeline_end: { type: "number" },
				kpi: { type: "string" },
				calendar_items: { type: "array" },
				rationale: { type: "string" },
			},
			required: ["campaign_id", "goal", "goal_type", "audience", "key_messages", "channel_mix", "calendar_items", "rationale"],
		},
		execute: async (input: ProposeCampaignPlanInput) => {
			validate(input);
			const campaign = await ctx.db
				.select()
				.from(campaigns)
				.where(and(eq(campaigns.id, input.campaign_id), eq(campaigns.clientSlug, ctx.clientSlug)))
				.limit(1)
				.all();
			if (campaign.length === 0) throw new Error("campaign not found");

			const proposalId = createId();
			const messageId = createId();
			await ctx.db.insert(messages).values({
				id: messageId,
				threadId: ctx.threadId,
				agentSessionId: null,
				sender: "director",
				type: "plan_proposal",
				contentJson: JSON.stringify({ proposal_id: proposalId, proposal: input, status: "pending" }),
				ts: Date.now(),
			});
			ctx.broker.emit({ type: "plan.proposed", proposal_id: proposalId, campaign_id: input.campaign_id, thread_id: ctx.threadId });
			return { proposal_id: proposalId, plan_id: null };
		},
	};
}
