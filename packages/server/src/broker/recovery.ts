import { and, eq, isNull } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, briefs } from "../db/schema.js";
import type { AgentRouter } from "./router.js";

export function recoverState(db: AgencyDb, router: AgentRouter): void {
	// 1. Re-queue dispatched briefs with no completed delegation
	const dispatchedBriefs = db
		.select()
		.from(briefs)
		.where(eq(briefs.status, "dispatched"))
		.all();
	for (const brief of dispatchedBriefs) {
		router.queueBrief(brief.id);
	}

	// 2. Mark orphaned warm sessions (not in current warm pool) as ended
	const warmRoles = new Set(router.getWarmRoles());
	const openSessions = db
		.select()
		.from(agentSessions)
		.where(and(eq(agentSessions.lifecycle, "warm"), isNull(agentSessions.endedAt)))
		.all();
	for (const session of openSessions) {
		if (!warmRoles.has(session.agentSlug)) {
			db.update(agentSessions)
				.set({ endedAt: new Date() })
				.where(eq(agentSessions.id, session.id))
				.run();
		}
	}
}
