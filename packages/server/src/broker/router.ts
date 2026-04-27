import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Agent } from "@mariozechner/pi-agent-core";
import type { AgencyDb } from "../db/index.js";
import { briefs, agentSessions, delegations, messages } from "../db/schema.js";
import { makeAgent, type MakeAgentOpts } from "../agents/factory.js";
import { Broker, type PersistedEvent } from "./event-bus.js";

const WARM_ROLES = ["director", "content-lead", "eval-judge"] as const;

export class AgentRouter {
	private warmAgents = new Map<string, Agent>();
	private warmSessionIds = new Map<string, string>();
	private chatAgents = new Map<string, Agent>(); // one director per chat thread
	private unsub?: () => void;
	private booted = false;

	constructor(
		private db: AgencyDb,
		private broker: Broker,
		private dataDir: string,
	) {}

	boot(): void {
		for (const role of WARM_ROLES) {
			const sessionId = randomUUID();
			const agent = makeAgent({
				role, dataDir: this.dataDir, db: this.db, sessionId,
				emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
			} satisfies MakeAgentOpts);
			this.warmAgents.set(role, agent);
			this.warmSessionIds.set(role, sessionId);
			this.db.insert(agentSessions).values({
				id: sessionId, agentSlug: role, lifecycle: "warm",
			}).run();
		}
		// Subscribe to delegation events
		this.unsub = this.broker.subscribe((evt: PersistedEvent) => this.onEvent(evt));
		this.booted = true;
	}

	private onEvent(evt: PersistedEvent): void {
		if (evt.type === "human_message") {
			const { threadId, text } = evt.payload as { threadId: string; text: string };
			this.handleChatMessage(threadId, text as string);
			return;
		}

		if (evt.type === "brief_proposed") {
			const { briefId } = evt.payload as { briefId: string };
			const director = this.warmAgents.get("director");
			if (!director) return;
			void (async () => {
				await director.waitForIdle();
				director.prompt(
					`Brief ${briefId} has been proposed and is ready. Now delegate it to the content-lead to begin production.`,
				).catch(console.error);
			})();
			return;
		}

		if (evt.type !== "delegation_created") return;
		const { delegationId, to } = evt.payload as { delegationId: string; to: string; from: string };

		// Fetch delegation from DB
		const delegation = this.db
			.select()
			.from(delegations)
			.where(eq(delegations.id, delegationId))
			.get();
		if (!delegation) return;

		const payload = (delegation.payloadJson ?? {}) as { task?: string; context?: string };
		const parts = [
			`## Delegation from ${delegation.fromAgent}`,
			payload.task ?? "",
			payload.context ? `Context: ${payload.context}` : "",
		].filter(Boolean);

		if (to === "content-lead") {
			parts.push("Review this task and delegate it to the appropriate specialist (copywriter) using delegate_to_specialist.");
		} else if (!this.warmAgents.has(to)) {
			// Specialist: write the content and submit it
			parts.push("Write the requested content, then call submit_deliverable with type, title, and contentMd (at least 50 characters).");
		}

		const userMessage = parts.join("\n\n");

		if (this.warmAgents.has(to)) {
			const agent = this.warmAgents.get(to)!;
			agent.prompt(userMessage).catch(console.error);
		} else {
			this.spawnAndPrompt(to, delegationId, userMessage);
		}
	}

	private handleChatMessage(threadId: string, text: string): void {
		let agent = this.chatAgents.get(threadId);
		if (!agent) {
			const sessionId = randomUUID();
			// Chat agents use no tools — pure conversational director
			agent = makeAgent({
				role: "director", dataDir: this.dataDir, db: this.db, sessionId, threadId,
				emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: "director", sessionId }),
			} satisfies MakeAgentOpts);
			// Strip tools so the model responds with text, not tool calls
			agent.state.tools = [];
			this.db.insert(agentSessions).values({
				id: sessionId, agentSlug: "director", lifecycle: "transient",
			}).run();
			const a = agent;
			a.subscribe(async (evt) => {
				type AnyEvt = { type: string; message?: { role: string; content: Array<{ type: string; text?: string }> } };
				const e = evt as AnyEvt;
				// Capture text from any assistant message (message_end or turn_end)
				if (e.type !== "message_end" && e.type !== "turn_end") return;
				const msg = e.message;
				if (!msg || msg.role !== "assistant") return;
				const responseText = msg.content
					.filter((c) => c.type === "text")
					.map((c) => c.text ?? "")
					.join("")
					.trim();
				if (!responseText) return;
				console.log(`[chat:${threadId.slice(0, 8)}] director responded: ${responseText.slice(0, 60)}`);
				this.db.insert(messages).values({
					id: randomUUID(), threadId,
					sender: "director", type: "chat",
					contentJson: { text: responseText } as never,
				}).run();
				this.broker.emit("agent_message", { threadId, agentSlug: "director", text: responseText });
			});
			this.chatAgents.set(threadId, a);
		}
		void (async () => {
			await agent!.waitForIdle();
			agent!.prompt(text).catch((e) => console.error("[chat] agent.prompt error:", e));
		})();
	}

	private spawnAndPrompt(role: string, delegationId: string, userMessage: string): void {
		const sessionId = randomUUID();
		const agent = makeAgent({
			role, dataDir: this.dataDir, db: this.db, sessionId, delegationId,
			emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
		} satisfies MakeAgentOpts);
		this.db.insert(agentSessions).values({
			id: sessionId, agentSlug: role, lifecycle: "transient", parentDelegationId: delegationId,
		}).run();
		agent.subscribe((evt) => {
			if (evt.type === "agent_end") {
				const last = agent.state.messages.at(-1);
				if (last?.role === "assistant" && last.errorMessage) {
					console.error(`[${role}] agent error:`, last.errorMessage);
				}
			}
		});
		agent.prompt(userMessage).catch(console.error);
	}

	shutdown(): void {
		this.unsub?.();
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
		const brief = this.db.select().from(briefs).where(eq(briefs.id, briefId)).get();
		if (!brief) {
			console.error("queueBrief: brief not found", briefId);
			return;
		}
		const director = this.warmAgents.get("director");
		if (!director) {
			console.error("queueBrief: director agent not initialized");
			return;
		}
		const userMessage = [
			"## New Brief",
			`Brief ID: ${briefId}`,
			"",
			brief.contentMd ?? "",
		].join("\n");
		director.prompt(userMessage).catch(console.error);
	}

	getBriefQueue(): string[] {
		return []; // no longer needed — briefs dispatched immediately
	}

	spawnTransientAgent(role: string, delegationId: string): Agent {
		const sessionId = randomUUID();
		const agent = makeAgent({
			role, dataDir: this.dataDir, db: this.db, sessionId, delegationId,
			emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
		} satisfies MakeAgentOpts);
		this.db.insert(agentSessions).values({
			id: sessionId, agentSlug: role, lifecycle: "transient", parentDelegationId: delegationId,
		}).run();
		return agent;
	}
}
