import { beforeEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { plansRoutes } from "./plans.js";

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
const events: Record<string, unknown>[] = [];
const broker = { emit: (e: Record<string, unknown>) => events.push(e) };

beforeEach(async () => {
	events.length = 0;
	const sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	await migrate(db, { migrationsFolder: "drizzle" });
	await db.insert(schema.clients).values({ slug: "default", name: "D", createdAt: Date.now() });
	await db.insert(schema.campaigns).values({ id: "c1", clientSlug: "default", title: "Campaign", status: "active", createdAt: Date.now() });
	await db.insert(schema.chatThreads).values({ id: "thr_1", clientSlug: "default", campaignId: "c1", title: "Plan Chat", archivedAt: null });
	app = Fastify();
	await app.register(plansRoutes, { db, broker });
});

describe("plans routes", () => {
	it("GET /api/campaigns/:id/plan returns null when no plan", async () => {
		const res = await app.inject({ method: "GET", url: "/api/campaigns/c1/plan" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ plan: null, calendar_items: [] });
	});

	it("PUT /api/campaigns/:id/plan upserts plan", async () => {
		const res = await app.inject({
			method: "PUT",
			url: "/api/campaigns/c1/plan",
			payload: {
				goal: "Lead-gen",
				goal_type: "lead-gen",
				audience: "B2B",
				key_messages: [{ id: "k1", text: "Tracking" }],
				channel_mix: [{ channel: "linkedin", weight: 100 }],
				kpi: "50",
			},
		});
		expect(res.statusCode).toBe(200);
		const rows = await db.select().from(schema.campaignPlans).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].campaignId).toBe("c1");
	});

	it("POST /api/campaigns/:id/plan/calendar-items creates item and emits event", async () => {
		await app.inject({
			method: "PUT",
			url: "/api/campaigns/c1/plan",
			payload: { goal: "g", goal_type: "lead-gen", audience: "a", key_messages: [], channel_mix: [] },
		});
		const res = await app.inject({
			method: "POST",
			url: "/api/campaigns/c1/plan/calendar-items",
			payload: {
				channel: "linkedin",
				target_date: 1715000000,
				intent: "Top",
			},
		});
		expect(res.statusCode).toBe(201);
		const items = await db.select().from(schema.campaignCalendarItems).all();
		expect(items).toHaveLength(1);
		expect(events.some((e) => e.type === "calendar_item.added")).toBe(true);
	});

	it("POST /api/proposals/:msgId/accept materializes plan proposal", async () => {
		await db.insert(schema.messages).values({
			id: "m1",
			threadId: "thr_1",
			agentSessionId: null,
			sender: "director",
			type: "plan_proposal",
			contentJson: JSON.stringify({
				proposal: {
					campaign_id: "c1",
					goal: "Lead-gen",
					goal_type: "lead-gen",
					audience: "B2B",
					key_messages: [{ id: "k1", text: "Tracking" }],
					channel_mix: [],
					calendar_items: [{ channel: "linkedin", target_date: 1715000000, intent: "Top" }],
					rationale: "ok",
				},
				status: "pending",
			}),
			ts: Date.now(),
		});
		const res = await app.inject({ method: "POST", url: "/api/proposals/m1/accept" });
		expect(res.statusCode).toBe(200);
		expect((await db.select().from(schema.campaignPlans).all())).toHaveLength(1);
		expect((await db.select().from(schema.campaignCalendarItems).all())).toHaveLength(1);
		const msg = (await db.select().from(schema.messages).where(eq(schema.messages.id, "m1")).all())[0];
		expect(JSON.parse(msg.contentJson).status).toBe("accepted");
	});
  it("derive-brief endpoint does not exist (removed)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/campaigns/c1/plan/calendar-items/nonexistent/derive-brief",
    });
    expect(res.statusCode).toBe(404);
  });
});
