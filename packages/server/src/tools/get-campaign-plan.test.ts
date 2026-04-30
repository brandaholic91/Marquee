import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema.js";
import { makeGetCampaignPlanTool } from "./get-campaign-plan.js";
import { createPlan, createCalendarItem, setCalendarItemStatus } from "../db/queries.js";

let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
	const sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	await migrate(db, { migrationsFolder: "drizzle" });
	await db.insert(schema.clients).values({ slug: "default", name: "D", createdAt: Date.now() });
	await db.insert(schema.campaigns).values({
		id: "c1",
		clientSlug: "default",
		title: "Campaign One",
		status: "active",
		createdAt: Date.now(),
	});
});

describe("get_campaign_plan", () => {
	it("returns null plan if campaign has no plan yet", async () => {
		const tool = makeGetCampaignPlanTool({ db, clientSlug: "default" });
		const out = await tool.execute({ campaign_id: "c1" });
		expect(out.has_plan).toBe(false);
		expect(out.plan).toBeUndefined();
	});

	it("returns plan summary + calendar progress", async () => {
		const planId = createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "Lead-gen Q2",
			goalType: "lead-gen",
			audience: "B2B",
			keyMessages: [{ id: "k1", text: "Tracking" }],
			channelMix: [{ channel: "linkedin", weight: 100 }],
			kpi: "50",
		});
		const itemId = createCalendarItem(db, {
			planId,
			campaignId: "c1",
			clientSlug: "default",
			channel: "linkedin",
			targetDate: 1715000000,
			intent: "Top funnel",
		});
		setCalendarItemStatus(db, itemId, "brief_created");

		const tool = makeGetCampaignPlanTool({ db, clientSlug: "default" });
		const out = await tool.execute({ campaign_id: "c1" });
		expect(out.has_plan).toBe(true);
		expect(out.plan?.calendar_progress.brief_created).toBe(1);
		expect(out.plan?.goal).toBe("Lead-gen Q2");
	});

	it("groups calendar items by status", async () => {
		const planId = createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "Lead-gen Q2",
			goalType: "lead-gen",
			audience: "B2B",
			keyMessages: [],
			channelMix: [],
		});
		const a = createCalendarItem(db, {
			planId,
			campaignId: "c1",
			clientSlug: "default",
			channel: "linkedin",
			targetDate: 1715000000,
			intent: "A",
		});
		const b = createCalendarItem(db, {
			planId,
			campaignId: "c1",
			clientSlug: "default",
			channel: "email",
			targetDate: 1715100000,
			intent: "B",
		});
		setCalendarItemStatus(db, a, "delivered");
		setCalendarItemStatus(db, b, "cancelled");

		const tool = makeGetCampaignPlanTool({ db, clientSlug: "default" });
		const out = await tool.execute({ campaign_id: "c1" });
		expect(out.plan?.calendar_progress.delivered).toBe(1);
		expect(out.plan?.calendar_progress.cancelled).toBe(1);
	});
});
