import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions } from "../db/schema.js";
import { makeAgent, type MakeAgentOpts } from "../agents/factory.js";
import { Broker } from "./event-bus.js";

const WARM_ROLES = ["director", "content-lead", "eval-judge"] as const;

export class AgentRouter {
	private warmAgents = new Map<string, ReturnType<typeof makeAgent>>();
	private warmSessionIds = new Map<string, string>();
	private briefQueue: string[] = [];
	private booted = false;

	constructor(
		private db: AgencyDb,
		private broker: Broker,
		private dataDir: string,
	) {}

	boot(): void {
		for (const role of WARM_ROLES) {
			const sessionId = randomUUID();
			const config = makeAgent({
				role, dataDir: this.dataDir, db: this.db, sessionId,
				emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
			} satisfies MakeAgentOpts);
			this.warmAgents.set(role, config);
			this.warmSessionIds.set(role, sessionId);
			this.db.insert(agentSessions).values({
				id: sessionId, agentSlug: role, lifecycle: "warm",
			}).run();
		}
		this.booted = true;
	}

	shutdown(): void {
		for (const [, sessionId] of this.warmSessionIds) {
			this.db.update(agentSessions)
				.set({ endedAt: new Date() })
				.where(eq(agentSessions.id, sessionId))
				.run();
		}
		this.warmAgents.clear();
		this.warmSessionIds.clear();
		this.booted = false;
	}

	getWarmRoles(): string[] {
		return [...this.warmAgents.keys()];
	}

	queueBrief(briefId: string): void {
		this.briefQueue.push(briefId);
	}

	getBriefQueue(): string[] {
		return [...this.briefQueue];
	}

	spawnTransientAgent(role: string, delegationId: string): ReturnType<typeof makeAgent> {
		const sessionId = randomUUID();
		const config = makeAgent({
			role, dataDir: this.dataDir, db: this.db, sessionId, delegationId,
			emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
		} satisfies MakeAgentOpts);
		this.db.insert(agentSessions).values({
			id: sessionId, agentSlug: role, lifecycle: "transient", parentDelegationId: delegationId,
		}).run();
		return config;
	}
}
