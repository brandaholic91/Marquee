import { beforeEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../../db/schema.js";
import { campaignsRoutes } from "./campaigns.js";
import { createPlan, createCalendarItem, setCalendarItemStatus } from "../../db/queries.js";

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
	const sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	await migrate(db, { migrationsFolder: "drizzle" });
	await db.insert(schema.clients).values({ slug: "default", name: "D", createdAt: Date.now() });
	await db.insert(schema.campaigns).values({ id: "c1", clientSlug: "default", title: "Campaign", status: "active", createdAt: Date.now() });
	app = Fastify();
	await app.register(campaignsRoutes, { db });
});

describe("campaigns routes", () => {
	it("GET /api/campaigns returns plan_summary", async () => {
		const planId = createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "g",
			goalType: "lead-gen",
			audience: "a",
			keyMessages: [],
			channelMix: [],
		});
		const item = createCalendarItem(db, {
			planId,
			campaignId: "c1",
			clientSlug: "default",
			channel: "linkedin",
			targetDate: 1715000000,
			intent: "intent",
		});
		setCalendarItemStatus(db, item, "delivered");

		const res = await app.inject({ method: "GET", url: "/api/campaigns" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body[0].plan_summary?.has_plan).toBe(true);
		expect(body[0].plan_summary?.calendar_progress?.delivered).toBe(1);
	});

  it("POST /api/campaigns creates a campaign", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { title: "Új kampány" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTruthy();
    expect(body.title).toBe("Új kampány");
    expect(body.status).toBe("active");

    const list = await app.inject({ method: "GET", url: "/api/campaigns" });
    const campaigns = list.json() as Array<{ title: string }>;
    expect(campaigns.some((c) => c.title === "Új kampány")).toBe(true);
  });

  it("POST /api/campaigns returns 409 for duplicate title", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { title: "Campaign" }, // already seeded in beforeEach
    });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error).toBe("campaign_exists");
  });

});