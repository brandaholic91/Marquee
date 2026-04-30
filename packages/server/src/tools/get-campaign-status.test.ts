import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema.js";
import { createPlan, createCalendarItem, setCalendarItemStatus } from "../db/queries.js";
import { makeGetCampaignStatusTool } from "./get-campaign-status.js";

let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
	const sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	await migrate(db, { migrationsFolder: "drizzle" });
	await db.insert(schema.clients).values({ slug: "default", name: "D", createdAt: Date.now() });
	await db.insert(schema.campaigns).values({ id: "c1", clientSlug: "default", title: "Campaign", status: "active", createdAt: Date.now() });
});

describe("get_campaign_status", () => {
	it("includes plan block with summary and progress", async () => {
		const planId = createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "Lead-gen Q2",
			goalType: "lead-gen",
			audience: "B2B SaaS",
			keyMessages: [{ id: "k1", text: "Tracking" }],
			channelMix: [],
		});
		const itemId = createCalendarItem(db, {
			planId,
			campaignId: "c1",
			clientSlug: "default",
			channel: "linkedin",
			targetDate: 1715000000,
			intent: "Top",
		});
		setCalendarItemStatus(db, itemId, "brief_created");

		const tool = makeGetCampaignStatusTool({ db, clientSlug: "default" });
		const out = await tool.execute();
		expect(out.campaigns[0]?.plan?.has_plan).toBe(true);
		expect(out.campaigns[0]?.plan?.calendar_progress?.brief_created).toBe(1);
		expect(typeof out.campaigns[0]?.plan?.summary).toBe("string");
	});
});
