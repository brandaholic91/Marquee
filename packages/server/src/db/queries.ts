import { count, desc, eq, gte, isNull } from "drizzle-orm";
import type { AgencyDb } from "./index.js";
import { agentSessions, deliverables, events } from "./schema.js";

export const recentEvents = (db: AgencyDb, limit = 100) =>
	db.select().from(events).orderBy(desc(events.ts)).limit(limit).all();

export const eventsAfter = (db: AgencyDb, lastId: number) =>
	db.select().from(events).where(gte(events.id, lastId + 1)).orderBy(events.id).all();

export const approvalsQueue = (db: AgencyDb, clientSlug?: string) => {
	const q = db.select().from(deliverables).where(eq(deliverables.status, "awaiting_approval"));
	if (clientSlug) {
		return db.select().from(deliverables)
			.where(eq(deliverables.clientSlug, clientSlug))
			.all()
			.filter((d) => d.status === "awaiting_approval");
	}
	return q.all();
};

export const pipelineCounts = (db: AgencyDb, clientSlug?: string) => {
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

export const activeAgents = (db: AgencyDb) =>
	db.select().from(agentSessions).where(isNull(agentSessions.endedAt)).all();
