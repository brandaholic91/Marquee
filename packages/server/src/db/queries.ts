import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { AgencyDb } from "./index.js";
import {
	agentSessions,
	briefs,
	campaignCalendarItems,
	campaignPlans,
	chatThreads,
	deliverables,
	events,
} from "./schema.js";

type Db = AgencyDb | ReturnType<typeof drizzle>;

export const recentEvents = (db: Db, limit = 100) =>
	db.select().from(events).orderBy(desc(events.ts)).limit(limit).all();

export const eventsAfter = (db: Db, lastId: number) =>
	db.select().from(events).where(gte(events.id, lastId + 1)).orderBy(events.id).all();

export const approvalsQueue = (db: Db, clientSlug?: string) => {
	const q = db.select().from(deliverables).where(eq(deliverables.status, "awaiting_approval"));
	if (clientSlug) {
		return db.select().from(deliverables)
			.where(eq(deliverables.clientSlug, clientSlug))
			.all()
			.filter((d) => d.status === "awaiting_approval");
	}
	return q.all();
};

export const pipelineCounts = (db: Db, clientSlug?: string) => {
	if (clientSlug) {
		return db
			.select({ status: deliverables.status, count: count() })
			.from(deliverables)
			.where(eq(deliverables.clientSlug, clientSlug))
			.groupBy(deliverables.status)
			.all();
	}
	return db
		.select({ status: deliverables.status, count: count() })
		.from(deliverables)
		.groupBy(deliverables.status)
		.all();
};

export const activeAgents = (db: Db) =>
	db.select().from(agentSessions).where(isNull(agentSessions.endedAt)).all();

export type GoalType = "lead-gen" | "awareness" | "nurture" | "activation" | "retention" | "other";
export type CalendarChannel = "linkedin" | "email" | "blog" | "landing" | "ad" | "other";
export type CalendarStatus = "planned" | "brief_created" | "delivered" | "cancelled";
export type CalendarDeliverableType =
	| "social_post"
	| "email"
	| "blog_post"
	| "ad_copy"
	| "content_brief_seo"
	| "seo_report";

export interface CampaignPlanInput {
	campaignId: string;
	clientSlug: string;
	goal: string;
	goalType: GoalType;
	audience: string;
	keyMessages: Array<{ id: string; text: string }>;
	channelMix: Array<{ channel: string; weight: number; note?: string }>;
	timelineStart?: number | null;
	timelineEnd?: number | null;
	kpi?: string;
}

export interface CalendarItemInput {
	planId: string;
	campaignId: string;
	clientSlug: string;
	channel: CalendarChannel;
	deliverableType?: CalendarDeliverableType | null;
	targetDate: number;
	intent: string;
	keyMessageRef?: string | null;
}

export function createPlan(db: Db, input: CampaignPlanInput): string {
	const now = Date.now();
	const id = crypto.randomUUID();
	db.insert(campaignPlans)
		.values({
			id,
			campaignId: input.campaignId,
			clientSlug: input.clientSlug,
			goal: input.goal,
			goalType: input.goalType,
			audience: input.audience,
			keyMessages: input.keyMessages,
			channelMix: input.channelMix,
			timelineStart: input.timelineStart ?? null,
			timelineEnd: input.timelineEnd ?? null,
			kpi: input.kpi ?? "",
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing()
		.run();

	const existing = db.select().from(campaignPlans).where(eq(campaignPlans.campaignId, input.campaignId)).limit(1).all()[0];
	if (!existing) throw new Error("failed to create plan");
	return existing.id;
}

export function getPlanByCampaignId(db: Db, campaignId: string) {
	return db.select().from(campaignPlans).where(eq(campaignPlans.campaignId, campaignId)).limit(1).all()[0] ?? null;
}

export function getPlanById(db: Db, planId: string) {
	return db.select().from(campaignPlans).where(eq(campaignPlans.id, planId)).limit(1).all()[0] ?? null;
}

export function updatePlan(
	db: Db,
	planId: string,
	patch: Partial<Omit<CampaignPlanInput, "campaignId" | "clientSlug">>,
) {
	const next: Partial<typeof campaignPlans.$inferInsert> = { updatedAt: Date.now() };
	if (patch.goal !== undefined) next.goal = patch.goal;
	if (patch.goalType !== undefined) next.goalType = patch.goalType;
	if (patch.audience !== undefined) next.audience = patch.audience;
	if (patch.keyMessages !== undefined) next.keyMessages = patch.keyMessages;
	if (patch.channelMix !== undefined) next.channelMix = patch.channelMix;
	if (patch.timelineStart !== undefined) next.timelineStart = patch.timelineStart;
	if (patch.timelineEnd !== undefined) next.timelineEnd = patch.timelineEnd;
	if (patch.kpi !== undefined) next.kpi = patch.kpi;
	db.update(campaignPlans).set(next).where(eq(campaignPlans.id, planId)).run();
}

export function listCalendarItems(
	db: Db,
	planId: string,
	filter?: { status?: CalendarStatus; fromDate?: number; toDate?: number },
) {
	const clauses = [eq(campaignCalendarItems.planId, planId)];
	if (filter?.status) clauses.push(eq(campaignCalendarItems.status, filter.status));
	if (filter?.fromDate !== undefined) clauses.push(gte(campaignCalendarItems.targetDate, filter.fromDate));
	if (filter?.toDate !== undefined) clauses.push(lte(campaignCalendarItems.targetDate, filter.toDate));
	return db
		.select()
		.from(campaignCalendarItems)
		.where(and(...clauses))
		.orderBy(campaignCalendarItems.targetDate)
		.all();
}

export function createCalendarItem(db: Db, input: CalendarItemInput): string {
	const now = Date.now();
	const id = crypto.randomUUID();
	db.insert(campaignCalendarItems)
		.values({
			id,
			planId: input.planId,
			campaignId: input.campaignId,
			clientSlug: input.clientSlug,
			channel: input.channel,
			deliverableType: input.deliverableType ?? null,
			targetDate: input.targetDate,
			intent: input.intent,
			keyMessageRef: input.keyMessageRef ?? null,
			status: "planned",
			createdAt: now,
			updatedAt: now,
		})
		.run();
	return id;
}

export function updateCalendarItem(
	db: Db,
	itemId: string,
	patch: Partial<Omit<CalendarItemInput, "planId" | "campaignId" | "clientSlug">>,
) {
	const next: Partial<typeof campaignCalendarItems.$inferInsert> = { updatedAt: Date.now() };
	if (patch.channel !== undefined) next.channel = patch.channel;
	if (patch.deliverableType !== undefined) next.deliverableType = patch.deliverableType;
	if (patch.targetDate !== undefined) next.targetDate = patch.targetDate;
	if (patch.intent !== undefined) next.intent = patch.intent;
	if (patch.keyMessageRef !== undefined) next.keyMessageRef = patch.keyMessageRef;
	db.update(campaignCalendarItems).set(next).where(eq(campaignCalendarItems.id, itemId)).run();
}

export function setCalendarItemStatus(db: Db, itemId: string, status: CalendarStatus) {
	db.update(campaignCalendarItems)
		.set({ status, updatedAt: Date.now() })
		.where(eq(campaignCalendarItems.id, itemId))
		.run();
}

export function cancelCalendarItem(db: Db, itemId: string) {
	setCalendarItemStatus(db, itemId, "cancelled");
}

export function deleteCalendarItem(db: Db, itemId: string) {
	const item = db.select().from(campaignCalendarItems).where(eq(campaignCalendarItems.id, itemId)).limit(1).all()[0];
	if (!item) return;
	if (item.status !== "planned") throw new Error("Use cancel instead");
	const linked = db
		.select({ id: briefs.id })
		.from(briefs)
		.where(eq(briefs.calendarItemId, itemId))
		.limit(1)
		.all()[0];
	if (linked) throw new Error("Use cancel instead");
	db.delete(campaignCalendarItems).where(eq(campaignCalendarItems.id, itemId)).run();
}

export function listThreadsByCampaign(db: Db, clientSlug: string, campaignId?: string) {
	if (campaignId) {
		return db
			.select()
			.from(chatThreads)
			.where(and(eq(chatThreads.clientSlug, clientSlug), eq(chatThreads.campaignId, campaignId)))
			.orderBy(desc(chatThreads.id))
			.all();
	}
	return db.select().from(chatThreads).where(eq(chatThreads.clientSlug, clientSlug)).orderBy(desc(chatThreads.id)).all();
}
