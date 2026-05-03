import type { Broker } from "../broker/event-bus.js";
import type { PersistedEvent } from "../broker/event-bus.js";
import type { AgencyDb } from "../db/index.js";

/**
 * Registers ingest broker event handlers.
 * Listens to 'deliverable_status_changed' events with status='shipped' and eval_score,
 * then spawns the ingest agent to learn from the deliverable.
 */
export function registerIngestHandlers(broker: Broker, db: AgencyDb, dataDir: string): () => void {
	const unsubscribe = broker.subscribe((evt: PersistedEvent) => {
		// Listen for deliverable status changes
		if (evt.type !== "deliverable_status_changed") return;

		const payload = evt.payload;
		const status = payload.status as string | undefined;
		const evalScore = payload.eval_score as number | undefined;

		// Only process shipped deliverables with eval scores
		if (status !== "shipped") return;
		if (evalScore === undefined || evalScore === null) return;

		const deliverableId = payload.deliverable_id as string | undefined;
		const clientSlug = payload.client_slug as string | undefined;
		const evalSummary = payload.eval_summary as string | undefined;
		const deliverableType = payload.deliverable_type as string | undefined;
		const briefTitle = payload.brief_title as string | undefined;

		// Validate required fields
		if (!deliverableId || !clientSlug || !deliverableType) {
			console.error("[ingest] Invalid deliverable_status_changed event payload:", payload);
			return;
		}

		// Fire-and-forget: spawn ingest agent without awaiting
		// Dynamic import to avoid circular dependencies and allow lazy loading
		(async () => {
			try {
				const { spawnIngestAgent } = await import("./agent.js");
				await spawnIngestAgent({
					db,
					broker,
					dataDir,
					clientSlug,
					deliverableId,
					evalScore,
					evalSummary: evalSummary || "",
					deliverableType: deliverableType as "email" | "blog_post" | "social_post" | "ad_copy",
					briefTitle,
				});
			} catch (err) {
				console.error("[ingest] Error spawning ingest agent:", err);
				const errorMsg = err instanceof Error ? err.message : String(err);
				broker.emit("ingest_agent_error", {
					client_slug: clientSlug,
					deliverable_id: deliverableId,
					error: errorMsg,
				});
			}
		})();
	});

	return unsubscribe;
}
