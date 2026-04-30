import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { openDb, type AgencyDb } from "./index.js";
import { briefs, campaigns, chatThreads, clients } from "./schema.js";
import { Broker } from "../broker/event-bus.js";
import * as q from "./queries.js";

describe("MVP queries", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-queries-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		// Seed a client row (FK target)
		db.insert(clients).values({ slug: "default", name: "Default", createdAt: Date.now() }).run();
		db.insert(campaigns).values({
			id: "c1",
			clientSlug: "default",
			title: "Campaign One",
			status: "active",
			createdAt: Date.now(),
		}).run();
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("recentEvents returns events ordered by ts desc", () => {
		const broker = new Broker(db);
		broker.emit("test_event_a", { x: 1 });
		broker.emit("test_event_b", { x: 2 });
		const rows = q.recentEvents(db);
		expect(rows.length).toBeGreaterThanOrEqual(2);
		// Most recent first
		expect(rows[0].type).toBe("test_event_b");
	});

	it("eventsAfter returns only events after given id", () => {
		const broker = new Broker(db);
		const e1 = broker.emit("first", {});
		const e2 = broker.emit("second", {});
		const after = q.eventsAfter(db, e1.id);
		expect(after.length).toBe(1);
		expect(after[0].id).toBe(e2.id);
	});

	it("approvalsQueue returns deliverables awaiting_approval (empty db)", () => {
		// Verify the query executes without error on empty db
		const results = q.approvalsQueue(db);
		expect(Array.isArray(results)).toBe(true);
		expect(results).toHaveLength(0);
	});

	it("pipelineCounts returns count per status", () => {
		const results = q.pipelineCounts(db);
		expect(Array.isArray(results)).toBe(true);
	});

	it("activeAgents returns sessions with ended_at IS NULL", () => {
		const results = q.activeAgents(db);
		expect(Array.isArray(results)).toBe(true);
	});

	it("createPlan inserts and returns the plan", () => {
		const planId = q.createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "Lead-gen Q2",
			goalType: "lead-gen",
			audience: "magyar B2B SaaS",
			keyMessages: [{ id: "tracking", text: "Tracking az alap" }],
			channelMix: [{ channel: "linkedin", weight: 60 }, { channel: "email", weight: 40 }],
			timelineStart: 1714521600,
			timelineEnd: 1719792000,
			kpi: "50 audit kitoltes",
		});
		const fetched = q.getPlanByCampaignId(db, "c1");
		expect(fetched).not.toBeNull();
		expect(fetched?.id).toBe(planId);
		expect(fetched?.keyMessages).toEqual([{ id: "tracking", text: "Tracking az alap" }]);
	});

	it("updatePlan partial patch", () => {
		const planId = q.createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "Lead-gen Q2",
			goalType: "lead-gen",
			audience: "magyar B2B SaaS",
			keyMessages: [{ id: "tracking", text: "Tracking az alap" }],
			channelMix: [{ channel: "linkedin", weight: 60 }],
		});
		q.updatePlan(db, planId, { kpi: "100 MQL", goalType: "nurture" });
		const fetched = q.getPlanById(db, planId);
		expect(fetched?.kpi).toBe("100 MQL");
		expect(fetched?.goalType).toBe("nurture");
	});

	it("createCalendarItem and listByPlan", () => {
		const planId = q.createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "Lead-gen Q2",
			goalType: "lead-gen",
			audience: "magyar B2B SaaS",
			keyMessages: [],
			channelMix: [],
		});
		const itemId = q.createCalendarItem(db, {
			planId,
			campaignId: "c1",
			clientSlug: "default",
			channel: "linkedin",
			targetDate: 1715000000,
			intent: "Top-of-funnel poszt",
		});
		const items = q.listCalendarItems(db, planId);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe(itemId);
	});

	it("cancelCalendarItem sets cancelled status", () => {
		const planId = q.createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "Lead-gen Q2",
			goalType: "lead-gen",
			audience: "magyar B2B SaaS",
			keyMessages: [],
			channelMix: [],
		});
		const itemId = q.createCalendarItem(db, {
			planId,
			campaignId: "c1",
			clientSlug: "default",
			channel: "linkedin",
			targetDate: 1715000000,
			intent: "Top-of-funnel poszt",
		});
		q.cancelCalendarItem(db, itemId);
		const [item] = q.listCalendarItems(db, planId);
		expect(item.status).toBe("cancelled");
	});

	it("listThreadsByCampaign filters by campaignId", () => {
		db.insert(chatThreads)
			.values([
				{ id: "t1", clientSlug: "default", campaignId: "c1", title: "Plan" },
				{ id: "t2", clientSlug: "default", campaignId: null, title: "General" },
			])
			.run();
		const filtered = q.listThreadsByCampaign(db, "default", "c1");
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("t1");
	});

	it("brief calendarItemId persists", () => {
		const planId = q.createPlan(db, {
			campaignId: "c1",
			clientSlug: "default",
			goal: "Lead-gen Q2",
			goalType: "lead-gen",
			audience: "magyar B2B SaaS",
			keyMessages: [],
			channelMix: [],
		});
		const itemId = q.createCalendarItem(db, {
			planId,
			campaignId: "c1",
			clientSlug: "default",
			channel: "linkedin",
			targetDate: 1715000000,
			intent: "Top-of-funnel poszt",
		});
		db.insert(briefs)
			.values({
				id: "brf-1",
				clientSlug: "default",
				sourceThreadId: null,
				campaignId: "c1",
				calendarItemId: itemId,
				contentMd: "{}",
				status: "draft",
				createdAt: Date.now(),
				dispatchedAt: null,
				parentDeliverableId: null,
			})
			.run();
		const row = db.select().from(briefs).where(eq(briefs.id, "brf-1")).all()[0];
		expect(row.calendarItemId).toBe(itemId);
	});
});
