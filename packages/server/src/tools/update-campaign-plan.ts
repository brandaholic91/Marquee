import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { campaignPlans, messages } from "../db/schema.js";

type Db = ReturnType<typeof drizzle>;
interface Broker {
	emit: (event: Record<string, unknown>) => void;
}

export interface UpdateCampaignPlanInput {
	plan_id: string;
	patch: Partial<{
		goal: string;
		goal_type: string;
		audience: string;
		key_messages: Array<{ id: string; text: string }>;
		channel_mix: Array<{ channel: string; weight: number; note?: string }>;
		timeline_start: number;
		timeline_end: number;
		kpi: string;
	}>;
	rationale: string;
}

export interface UpdateCampaignPlanContext {
	db: Db;
	broker: Broker;
	threadId: string;
}

export function makeUpdateCampaignPlanTool(ctx: UpdateCampaignPlanContext) {
	return {
		name: "update_campaign_plan",
		description: "Meglevo kampanyterv frissitesi javaslatat kuldi approval flow-ba.",
		inputSchema: {
			type: "object",
			properties: {
				plan_id: { type: "string" },
				patch: { type: "object" },
				rationale: { type: "string" },
			},
			required: ["plan_id", "patch", "rationale"],
		},
		execute: async (input: UpdateCampaignPlanInput) => {
			if (!input.rationale.trim()) throw new Error("rationale is required");
			if (Object.keys(input.patch).length === 0) throw new Error("patch must include at least one field");
			const plan = await ctx.db.select().from(campaignPlans).where(eq(campaignPlans.id, input.plan_id)).limit(1).all();
			if (plan.length === 0) throw new Error("plan not found");

			const proposalId = createId();
			await ctx.db.insert(messages).values({
				id: createId(),
				threadId: ctx.threadId,
				agentSessionId: null,
				sender: "director",
				type: "plan_update_proposal",
				contentJson: JSON.stringify({ proposal_id: proposalId, proposal: input, status: "pending" }),
				ts: Date.now(),
			});
			ctx.broker.emit({ type: "plan.proposed", proposal_id: proposalId, plan_id: input.plan_id, thread_id: ctx.threadId });
			return { proposal_id: proposalId };
		},
	};
}
