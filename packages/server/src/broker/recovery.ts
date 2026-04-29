import { and, eq, isNull } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, briefs, delegations, deliverables } from "../db/schema.js";
import type { AgentRouter } from "./router.js";

export function recoverState(db: AgencyDb, router: AgentRouter): void {
	// 1. Re-queue dispatched briefs that have NO delegations yet (truly stuck at dispatch)
	const dispatchedBriefs = db
		.select()
		.from(briefs)
		.where(eq(briefs.status, "dispatched"))
		.all();
	for (const brief of dispatchedBriefs) {
		// Skip if already has delegations — pipeline already started
		const hasDelegation = db.select().from(delegations)
			.where(eq(delegations.briefId, brief.id)).get();
		if (hasDelegation) continue;

		// Skip if already has a shipped deliverable via campaign
		if (brief.campaignId) {
			const shipped = db.select().from(deliverables)
				.where(and(eq(deliverables.campaignId, brief.campaignId), eq(deliverables.status, "shipped")))
				.get();
			if (shipped) {
				// Mark brief completed so it won't be re-queued next restart
				db.update(briefs).set({ status: "done" }).where(eq(briefs.id, brief.id)).run();
				continue;
			}
		}

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
