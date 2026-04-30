import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { campaignPlans, messages } from "../db/schema.js";

type Db = ReturnType<typeof drizzle>;
interface Broker {
	emit: (event: Record<string, unknown>) => void;
}

export interface ProposeCalendarItemInput {
	plan_id: string;
	channel: "linkedin" | "email" | "blog" | "landing" | "ad" | "other";
	deliverable_type?: "social_post" | "email" | "blog_post" | "ad_copy" | "content_brief_seo" | "seo_report";
	target_date: number;
	intent: string;
	key_message_ref?: string;
	rationale: string;
}

export interface ProposeCalendarItemContext {
	db: Db;
	broker: Broker;
	threadId: string;
}

export function makeProposeCalendarItemTool(ctx: ProposeCalendarItemContext) {
	return {
		name: "propose_calendar_item",
		description: "Egyetlen uj naptar itemet javasol meglevo tervhez approval flow-val.",
		inputSchema: {
			type: "object",
			properties: {
				plan_id: { type: "string" },
				channel: { type: "string" },
				deliverable_type: { type: "string" },
				target_date: { type: "number" },
				intent: { type: "string" },
				key_message_ref: { type: "string" },
				rationale: { type: "string" },
			},
			required: ["plan_id", "channel", "target_date", "intent", "rationale"],
		},
		execute: async (input: ProposeCalendarItemInput) => {
			if (!input.intent.trim()) throw new Error("intent is required");
			if (!input.rationale.trim()) throw new Error("rationale is required");
			const rows = await ctx.db.select().from(campaignPlans).where(eq(campaignPlans.id, input.plan_id)).limit(1).all();
			if (rows.length === 0) throw new Error("plan not found");
			if (input.key_message_ref) {
				const keys = rows[0].keyMessages ?? [];
				if (!keys.some((k) => k.id === input.key_message_ref)) {
					throw new Error("key_message_ref must reference plan key_messages");
				}
			}

			const proposalId = createId();
			await ctx.db.insert(messages).values({
				id: createId(),
				threadId: ctx.threadId,
				agentSessionId: null,
				sender: "director",
				type: "calendar_item_proposal",
				contentJson: JSON.stringify({ proposal_id: proposalId, proposal: input, status: "pending" }),
				ts: Date.now(),
			});
			ctx.broker.emit({ type: "calendar_item.added", proposal_id: proposalId, plan_id: input.plan_id, thread_id: ctx.threadId });
			return { proposal_id: proposalId };
		},
	};
}
