import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createPlan } from "../db/queries.js";
import * as schema from "../db/schema.js";
import { makeProposeCalendarItemTool } from "./propose-calendar-item.js";

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
	await db.insert(schema.campaigns).values({ id: "c1", clientSlug: "default", title: "Campaign", status: "active", createdAt: Date.now() });
});

describe("propose_calendar_item", () => {
	it("creates calendar_item_proposal message", async () => {
		const planId = createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "g",
			goalType: "lead-gen",
			audience: "a",
			keyMessages: [{ id: "k1", text: "uzenet" }],
			channelMix: [],
		});
		const tool = makeProposeCalendarItemTool({ db, broker, threadId: "thr_1" });
		const out = await tool.execute({
			plan_id: planId,
			channel: "linkedin",
			target_date: 1715000000,
			intent: "intent",
			key_message_ref: "k1",
			rationale: "ok",
		});
		expect(out.proposal_id).toBeDefined();
		const msgs = await db.select().from(schema.messages).all();
		expect(msgs[0].type).toBe("calendar_item_proposal");
	});
});
