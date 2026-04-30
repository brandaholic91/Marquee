import { eq } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { briefs, campaignCalendarItems, delegations, deliverables } from "../db/schema.js";

export interface CalendarStatusTransition {
	itemId: string;
	planId: string;
	prevStatus: "planned" | "brief_created" | "delivered" | "cancelled";
	newStatus: "planned" | "brief_created" | "delivered" | "cancelled";
	briefId?: string;
}

function setStatus(
	db: AgencyDb,
	itemId: string,
	next: "planned" | "brief_created" | "delivered" | "cancelled",
	briefId?: string,
): CalendarStatusTransition | null {
	const row = db.select().from(campaignCalendarItems).where(eq(campaignCalendarItems.id, itemId)).limit(1).all()[0];
	if (!row) return null;
	if (row.status === "delivered" && next !== "delivered") return null;
	if (row.status === next) return null;
	db.update(campaignCalendarItems)
		.set({ status: next, updatedAt: Date.now() })
		.where(eq(campaignCalendarItems.id, itemId))
		.run();
	return {
		itemId,
		planId: row.planId,
		prevStatus: row.status,
		newStatus: next,
		briefId,
	};
}

export function applyCalendarEvent(
	db: AgencyDb,
	type: string,
	payload: Record<string, unknown>,
): CalendarStatusTransition | null {
	if (type === "brief_dispatched") {
		const briefId = String(payload.brief_id ?? "");
		if (!briefId) return null;
		const brief = db.select().from(briefs).where(eq(briefs.id, briefId)).limit(1).all()[0];
		if (!brief?.calendarItemId) return null;
		return setStatus(db, brief.calendarItemId, "brief_created", briefId);
	}

	if (type === "deliverable_approved") {
		const deliverableId = String(payload.deliverable_id ?? "");
		if (!deliverableId) return null;
		const deliverable = db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1).all()[0];
		if (!deliverable) return null;
		const delegation = db.select().from(delegations).where(eq(delegations.id, deliverable.delegationId)).limit(1).all()[0];
		if (!delegation) return null;
		const brief = db.select().from(briefs).where(eq(briefs.id, delegation.briefId)).limit(1).all()[0];
		if (!brief?.calendarItemId) return null;
		return setStatus(db, brief.calendarItemId, "delivered", brief.id);
	}

	if (type === "calendar_item.cancel_requested") {
		const itemId = String(payload.item_id ?? "");
		if (!itemId) return null;
		return setStatus(db, itemId, "cancelled");
	}

	if (type === "brief_discarded") {
		const briefId = String(payload.brief_id ?? "");
		if (!briefId) return null;
		const brief = db.select().from(briefs).where(eq(briefs.id, briefId)).limit(1).all()[0];
		if (!brief?.calendarItemId) return null;
		return setStatus(db, brief.calendarItemId, "planned", briefId);
	}

	return null;
}
