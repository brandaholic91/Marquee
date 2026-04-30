import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs, campaignCalendarItems, campaignPlans, campaigns, clients, delegations, deliverables } from "../db/schema.js";
import { applyCalendarEvent } from "./calendar-state-machine.js";

describe("calendar state machine", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "calendar-sm-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		db.insert(clients).values({ slug: "default", name: "Default", createdAt: Date.now() }).run();
		db.insert(campaigns).values({ id: "c1", clientSlug: "default", title: "Campaign", status: "active", createdAt: Date.now() }).run();
		db.insert(campaignPlans).values({
			id: "p1",
			campaignId: "c1",
			clientSlug: "default",
			goal: "goal",
			goalType: "lead-gen",
			audience: "aud",
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
			targetDate: 1715000000,
			intent: "intent",
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
			status: "draft",
			createdAt: Date.now(),
			dispatchedAt: null,
			parentDeliverableId: null,
		}).run();
		db.insert(delegations).values({
			id: "d1",
			briefId: "b1",
			clientSlug: "default",
			campaignId: "c1",
			fromAgent: "director",
			toAgent: "social-manager",
			payloadJson: "{}",
			status: "in_progress",
			requestedAt: Date.now(),
			completedAt: null,
		}).run();
		db.insert(deliverables).values({
			id: "dv1",
			delegationId: "d1",
			clientSlug: "default",
			campaignId: "c1",
			type: "social_post",
			title: null,
			status: "awaiting_approval",
			currentRevisionId: null,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}).run();
	});

	it("brief_dispatched transitions item to brief_created", () => {
		const t = applyCalendarEvent(db, "brief_dispatched", { brief_id: "b1" });
		expect(t?.newStatus).toBe("brief_created");
	});

	it("deliverable_approved transitions item to delivered", () => {
		applyCalendarEvent(db, "brief_dispatched", { brief_id: "b1" });
		const t = applyCalendarEvent(db, "deliverable_approved", { deliverable_id: "dv1" });
		expect(t?.newStatus).toBe("delivered");
	});

	it("cancel request transitions to cancelled unless delivered", () => {
		const t = applyCalendarEvent(db, "calendar_item.cancel_requested", { item_id: "i1" });
		expect(t?.newStatus).toBe("cancelled");
		applyCalendarEvent(db, "brief_dispatched", { brief_id: "b1" });
		applyCalendarEvent(db, "deliverable_approved", { deliverable_id: "dv1" });
		const blocked = applyCalendarEvent(db, "calendar_item.cancel_requested", { item_id: "i1" });
		expect(blocked).toBeNull();
	});

	it("brief_discarded transitions back to planned", () => {
		applyCalendarEvent(db, "brief_dispatched", { brief_id: "b1" });
		const t = applyCalendarEvent(db, "brief_discarded", { brief_id: "b1" });
		expect(t?.newStatus).toBe("planned");
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});
});
