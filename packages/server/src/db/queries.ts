import { count, desc, eq, gte, isNull, sum } from "drizzle-orm";
import type { AgencyDb } from "./index.js";
import { agentSessions, deliverables, events, turns, evals } from "./schema.js";

export const approvalsQueue = (db: AgencyDb) =>
	db.select().from(deliverables).where(eq(deliverables.status, "awaiting_approval")).all();

export const pipelineCounts = (db: AgencyDb) =>
	db
		.select({ status: deliverables.status, count: count() })
		.from(deliverables)
		.groupBy(deliverables.status)
		.all();

export const recentEvents = (db: AgencyDb, limit = 100) =>
	db.select().from(events).orderBy(desc(events.ts)).limit(limit).all();

export const eventsAfter = (db: AgencyDb, lastId: number) =>
	db.select().from(events).where(gte(events.id, lastId + 1)).orderBy(events.id).all();

export const activeAgents = (db: AgencyDb) =>
	db.select().from(agentSessions).where(isNull(agentSessions.endedAt)).all();

export const topSpenderToday = (db: AgencyDb) => {
	const dayStart = new Date();
	dayStart.setUTCHours(0, 0, 0, 0);
	const rows = db
		.select({
			agentSlug: agentSessions.agentSlug,
			total: sum(turns.costUsd).mapWith(Number),
		})
		.from(turns)
		.innerJoin(agentSessions, eq(agentSessions.id, turns.sessionId))
		.where(gte(turns.startedAt, dayStart))
		.groupBy(agentSessions.agentSlug)
		.orderBy(desc(sum(turns.costUsd)))
		.limit(1)
		.all();
	return rows[0] ?? null;
};

export const usageToday = (db: AgencyDb) => {
	const dayStart = new Date();
	dayStart.setUTCHours(0, 0, 0, 0);
	return db
		.select({
			agentSlug: agentSessions.agentSlug,
			promptTokens: sum(turns.promptTokens).mapWith(Number),
			completionTokens: sum(turns.completionTokens).mapWith(Number),
			costUsdCents: sum(turns.costUsd).mapWith(Number),
		})
		.from(turns)
		.innerJoin(agentSessions, eq(agentSessions.id, turns.sessionId))
		.where(gte(turns.startedAt, dayStart))
		.groupBy(agentSessions.agentSlug)
		.orderBy(desc(sum(turns.promptTokens)))
		.all();
};

export const qualityLast30Days = (db: AgencyDb) => {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 30);
	cutoff.setUTCHours(0, 0, 0, 0);
	return db
		.select({ scoresJson: evals.scoresJson, createdAt: evals.createdAt })
		.from(evals)
		.where(gte(evals.createdAt, cutoff))
		.orderBy(evals.createdAt)
		.all();
};
