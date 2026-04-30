import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { makeProposeCampaignPlanTool } from "./propose-campaign-plan.js";

let db: ReturnType<typeof drizzle>;
const events: Record<string, unknown>[] = [];
const broker = { emit: (e: Record<string, unknown>) => events.push(e) };

beforeEach(async () => {
	events.length = 0;
	const sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	await migrate(db, { migrationsFolder: "drizzle" });
	await db.insert(schema.clients).values({ slug: "default", name: "D", createdAt: Date.now() });
	await db.insert(schema.chatThreads).values({ id: "thr_1", clientSlug: "default", title: "plan" });
	await db.insert(schema.campaigns).values({
		id: "c1",
		clientSlug: "default",
		title: "Campaign",
		status: "active",
		createdAt: Date.now(),
	});
});

describe("propose_campaign_plan", () => {
	it("inserts a plan_proposal message into the thread", async () => {
		const tool = makeProposeCampaignPlanTool({ db, broker, clientSlug: "default", threadId: "thr_1" });
		const out = await tool.execute({
			campaign_id: "c1",
			goal: "Lead-gen",
			goal_type: "lead-gen",
			audience: "B2B",
			key_messages: [{ id: "k1", text: "Tracking" }],
			channel_mix: [{ channel: "linkedin", weight: 100 }],
			calendar_items: [],
			rationale: "Ok",
		});
		expect(out.proposal_id).toBeDefined();
		const msg = await db.select().from(schema.messages).where(eq(schema.messages.threadId, "thr_1")).all();
		expect(msg).toHaveLength(1);
		expect(msg[0].type).toBe("plan_proposal");
	});

	it("rejects payload with missing required fields", async () => {
		const tool = makeProposeCampaignPlanTool({ db, broker, clientSlug: "default", threadId: "thr_1" });
		await expect(
			tool.execute({
				campaign_id: "c1",
				goal: "",
				goal_type: "lead-gen",
				audience: "B2B",
				key_messages: [],
				channel_mix: [],
				calendar_items: [],
				rationale: "Ok",
			} as never),
		).rejects.toThrow(/goal is required/);
	});
});
