import { eq, isNull } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, delegations } from "../db/schema.js";

export function recoverState(db: AgencyDb): void {
	const now = Date.now();
	const openSessions = db
		.select()
		.from(agentSessions)
		.where(isNull(agentSessions.endedAt))
		.all();

	for (const session of openSessions) {
		db.update(agentSessions)
			.set({ endedAt: now })
			.where(eq(agentSessions.id, session.id))
			.run();

		if (session.lifecycle === "transient" && session.parentDelegationId) {
			// Fail the in-flight delegation — no broker event, delegation.status=failed is the signal
			db.update(delegations)
				.set({ status: "failed", completedAt: now })
				.where(eq(delegations.id, session.parentDelegationId))
				.run();

			console.warn(`[recovery] delegation ${session.parentDelegationId} failed (agent: ${session.agentSlug})`);
		}
		// Warm sessions: just mark ended; they get respawned on first chat.
	}
	// Note: 'requested' delegations are left alone for now — operator re-runs the brief manually.
}
