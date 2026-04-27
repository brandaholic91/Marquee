import { randomUUID } from "node:crypto";
import type { AgencyDb } from "../db/index.js";
import { makeAgent, type MakeAgentOpts } from "../agents/factory.js";
import type { Broker, PersistedEvent } from "./event-bus.js";

type AgentConfig = ReturnType<typeof makeAgent>;

export class EvalTrigger {
	private handlers: Array<(config: AgentConfig) => void> = [];
	private unsub?: () => void;

	constructor(
		private db: AgencyDb,
		private broker: Broker,
		private dataDir: string,
	) {}

	attach(): void {
		this.unsub = this.broker.subscribe((evt: PersistedEvent) => {
			if (evt.type === "deliverable_submitted") {
				const sessionId = randomUUID();
				const config = makeAgent({
					role: "eval-judge",
					dataDir: this.dataDir,
					db: this.db,
					sessionId,
					emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: "eval-judge", sessionId }),
				} satisfies MakeAgentOpts);
				for (const h of this.handlers) h(config);
			}
		});
	}

	detach(): void {
		this.unsub?.();
	}

	onEvalScheduled(fn: (config: AgentConfig) => void): void {
		this.handlers.push(fn);
	}
}
