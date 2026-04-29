import { eq, isNull } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, delegations } from "../db/schema.js";
import type { Broker } from "./event-bus.js";

export function recoverState(db: AgencyDb, broker: Broker): void {
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
			// Fail the in-flight delegation
			db.update(delegations)
				.set({ status: "failed", completedAt: now })
				.where(eq(delegations.id, session.parentDelegationId))
				.run();

			broker.emit("error", {
				source: "recovery",
				delegation_id: session.parentDelegationId,
				agent_slug: session.agentSlug,
				message: "transient session abandoned across restart",
			});
		}
		// Warm sessions: just mark ended; they get respawned on first chat.
	}
	// Note: 'requested' delegations are left alone for now — operator re-runs the brief manually.
}
