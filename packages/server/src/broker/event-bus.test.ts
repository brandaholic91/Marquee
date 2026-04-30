import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs, campaignCalendarItems, campaignPlans, campaigns, clients, events } from "../db/schema.js";
import { Broker } from "./event-bus.js";

describe("Broker", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-broker-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("persists emitted events and notifies subscribers", () => {
		const b = new Broker(db);
		const received: unknown[] = [];
		b.subscribe((e) => received.push(e));
		b.emit("delegation_started", { delegationId: "abc" }, { agentSlug: "director" });
		const rows = db.select().from(events).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].type).toBe("delegation_started");
		expect(rows[0].agentSlug).toBe("director");
		expect(received).toHaveLength(1);
		expect((received[0] as { type: string }).type).toBe("delegation_started");
	});

	it("stores ts as a number (Date.now-based integer)", () => {
		const b = new Broker(db);
		const before = Date.now();
		b.emit("brief_proposed", { briefId: "b-1" });
		const after = Date.now();
		const rows = db.select().from(events).all();
		expect(rows).toHaveLength(1);
		const ts = rows[0].ts;
		expect(typeof ts).toBe("number");
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});

	it("propagates clientSlug into the events row", () => {
		// Insert a client first to satisfy the FK constraint
		db.insert(clients).values({ slug: "default", name: "Default Client", createdAt: Date.now() }).run();
		const b = new Broker(db);
		b.emit("chat_message", { text: "hello" }, { clientSlug: "default" });
		const rows = db.select().from(events).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].clientSlug).toBe("default");
	});

	it("emits calendar_item.status_changed on brief_dispatched", () => {
		db.insert(clients).values({ slug: "default", name: "Default Client", createdAt: Date.now() }).onConflictDoNothing().run();
		db.insert(campaigns).values({ id: "c1", clientSlug: "default", title: "C", status: "active", createdAt: Date.now() }).run();
		db.insert(campaignPlans).values({
			id: "p1",
			campaignId: "c1",
			clientSlug: "default",
			goal: "g",
			goalType: "lead-gen",
			audience: "a",
			keyMessages: [],
			channelMix: [],
			timelineStart: null,
			timelineEnd: null,
			kpi: "",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}).run();
		db.insert(campaignCalendarItems).values({
			id: "i1",
			planId: "p1",
			campaignId: "c1",
			clientSlug: "default",
			channel: "linkedin",
			deliverableType: "social_post",
			targetDate: Date.now(),
			intent: "i",
			keyMessageRef: null,
			status: "planned",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}).run();
		db.insert(briefs).values({
			id: "b1",
			clientSlug: "default",
			sourceThreadId: null,
			campaignId: "c1",
			calendarItemId: "i1",
			contentMd: "{}",
			status: "dispatched",
			createdAt: Date.now(),
			dispatchedAt: Date.now(),
			parentDeliverableId: null,
		}).run();

		const b = new Broker(db);
		b.emit("brief_dispatched", { brief_id: "b1" }, { clientSlug: "default" });
		const rows = db.select().from(events).all();
		expect(rows.some((r) => r.type === "calendar_item.status_changed")).toBe(true);
	});
});
