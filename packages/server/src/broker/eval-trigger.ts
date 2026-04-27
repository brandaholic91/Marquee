import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, deliverables, deliverableRevisions } from "../db/schema.js";
import { makeAgent, type MakeAgentOpts } from "../agents/factory.js";
import type { Broker, PersistedEvent } from "./event-bus.js";

export class EvalTrigger {
	private unsub?: () => void;

	constructor(
		private db: AgencyDb,
		private broker: Broker,
		private dataDir: string,
	) {}

	attach(): void {
		this.unsub = this.broker.subscribe((evt: PersistedEvent) => {
			if (evt.type !== "deliverable_submitted") return;
			const deliverableId = evt.payload.deliverableId as string | undefined;
			if (!deliverableId) return;

			const deliverable = this.db
				.select()
				.from(deliverables)
				.where(eq(deliverables.id, deliverableId))
				.get();
			if (!deliverable) return;

			// Read content from the current revision artifact
			let contentMd = "(no content)";
			if (deliverable.currentRevisionId) {
				const rev = this.db
					.select()
					.from(deliverableRevisions)
					.where(eq(deliverableRevisions.id, deliverable.currentRevisionId))
					.get();
				if (rev) {
					try {
						contentMd = readFileSync(rev.artifactPath, "utf8");
					} catch {
						contentMd = "(could not read artifact)";
					}
				}
			}

			const sessionId = randomUUID();
			const agent = makeAgent({
				role: "eval-judge",
				dataDir: this.dataDir,
				db: this.db,
				sessionId,
				emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: "eval-judge", sessionId }),
			} satisfies MakeAgentOpts);
			this.db.insert(agentSessions).values({
				id: sessionId, agentSlug: "eval-judge", lifecycle: "transient",
			}).run();

			const userMessage = [
				"## Deliverable for Evaluation",
				`Deliverable ID: ${deliverableId}`,
				`Type: ${deliverable.type ?? "unknown"}`,
				`Revision ID: ${deliverable.currentRevisionId ?? "none"}`,
				"",
				contentMd,
			].join("\n");

			agent.prompt(userMessage).catch(console.error);
		});
	}

	detach(): void {
		this.unsub?.();
	}
}
