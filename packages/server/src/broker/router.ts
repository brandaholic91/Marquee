import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Agent } from "@mariozechner/pi-agent-core";
import type { AgencyDb } from "../db/index.js";
import { briefs, agentSessions, chatThreads, delegations, messages, tasks, taskPendingUpdates } from "../db/schema.js";
import { makeAgent, type MakeAgentOpts } from "../agents/factory.js";
import { Broker, type PersistedEvent } from "./event-bus.js";
import type { AuthManager } from "../providers/auth.js";
import type { Telemetry } from "../telemetry/index.js";

const WARM_ROLES = ["director", "content-lead", "eval-judge", "distribution-lead", "insights-lead"] as const;

export class AgentRouter {
	private warmAgents = new Map<string, Agent>();
	private warmSessionIds = new Map<string, string>();
	private chatAgents = new Map<string, Agent>(); // one director per chat thread
	private unsub?: () => void;
	private booted = false;
	private turnStartTimes = new Map<string, number>(); // sessionId → start ms
	private budgetWarnDate: string | null = null; // "YYYY-MM-DD" — resets each day
	private orchestrator?: { onBriefDispatched: (briefId: string) => boolean };

	setOrchestrator(orchestrator: { onBriefDispatched: (briefId: string) => boolean }): void {
		this.orchestrator = orchestrator;
	}

	constructor(
		private db: AgencyDb,
		private broker: Broker,
		private dataDir: string,
		private authManager?: AuthManager,
		private telemetry?: Telemetry,
	) {}

	boot(): void {
		for (const role of WARM_ROLES) {
			const sessionId = randomUUID();
			const agent = makeAgent({
				role, dataDir: this.dataDir, db: this.db, sessionId,
				authManager: this.authManager,
				emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
			} satisfies MakeAgentOpts);
			this.warmAgents.set(role, agent);
			this.warmSessionIds.set(role, sessionId);
			this.db.insert(agentSessions).values({
				id: sessionId, agentSlug: role, lifecycle: "warm",
			}).run();
			const sid = sessionId;
			agent.subscribe((evt) => {
				type AnyEvt = { type: string; message?: unknown };
				const e = evt as AnyEvt;
				if (e.type === "turn_start") {
					this.turnStartTimes.set(sid, Date.now());
				} else if (e.type === "turn_end") {
					this.recordTurn(sid, e);
				}
			});
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
			parts.push("Review this task and delegate it to the appropriate specialist (copywriter, repurposer) using delegate_to_specialist.");
		} else if (to === "distribution-lead") {
			parts.push("Review this task and delegate it to the appropriate specialist (social-manager, paid-specialist) using delegate_to_specialist.");
		} else if (to === "insights-lead") {
			parts.push("Review this task and delegate it to the appropriate specialist (seo-analyst, analytics-analyst) using delegate_to_specialist.");
		} else if (!this.warmAgents.has(to)) {
			// Specialist: write the content and submit it
			parts.push("Write the requested content, then call submit_deliverable with type, title, and contentMd (at least 50 characters).");
		}

		const userMessage = parts.join("\n\n");

		if (this.warmAgents.has(to)) {
			// Rebuild warm agent with correct delegationId so delegateToSpecialist gets parentDelegationId
			const sessionId = randomUUID();
			const agent = makeAgent({
				role: to, dataDir: this.dataDir, db: this.db, sessionId, delegationId,
				authManager: this.authManager,
				emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: to, sessionId }),
			} satisfies MakeAgentOpts);
			this.db.insert(agentSessions).values({ id: sessionId, agentSlug: to, lifecycle: "transient", parentDelegationId: delegationId }).run();
			this.db.update(delegations).set({ status: "in_progress" })
				.where(eq(delegations.id, delegationId)).run();
			agent.prompt(userMessage).catch((e) => console.error(`[${to}] prompt error:`, e));
		} else {
			this.spawnAndPrompt(to, delegationId, userMessage);
		}
	}

	private handleChatMessage(threadId: string, text: string): void {
		let agent = this.chatAgents.get(threadId);
		if (!agent) {
			const sessionId = randomUUID();
			const thread = this.db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).get();
			agent = makeAgent({
				role: "director", dataDir: this.dataDir, db: this.db, sessionId, threadId,
				authManager: this.authManager,
				emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: "director", sessionId }),
			} satisfies MakeAgentOpts);
			if (thread?.type === "onboarding") {
				// Onboarding: keep only complete_onboarding so the director saves profiles directly
				agent.state.tools = agent.state.tools.filter((t) => t.name === "complete_onboarding");
			}
			// Regular chat: director keeps full toolset — can process briefs, read memory, delegate
			this.db.insert(agentSessions).values({
				id: sessionId, agentSlug: "director", lifecycle: "transient",
			}).run();
			const a = agent;
			a.subscribe(async (evt) => {
				type AnyEvt = { type: string; message?: { role: string; content: Array<{ type: string; text?: string }> } };
				const e = evt as AnyEvt;
				if (e.type === "turn_start") {
					this.broker.emit("agent_typing", { threadId, agentSlug: "director" });
					this.turnStartTimes.set(sessionId, Date.now());
					return;
				}
				if (e.type !== "turn_end") return;
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
				this.recordTurn(sessionId, e);
			});
			this.chatAgents.set(threadId, a);
		}
		void (async () => {
			await agent!.waitForIdle();
			agent!.prompt(text).catch((e) => console.error("[chat] agent.prompt error:", e));
		})();
	}

	spawnAndPrompt(role: string, delegationId: string, userMessage: string): void {
		// Hard budget guard: block non-director specialists when daily limit is exceeded
		if (this.telemetry && this.telemetry.opts.dailyBudgetCents > 0) {
			try {
				this.telemetry.checkBudget();
			} catch {
				this.broker.emit("budget_exceeded", { role, delegationId });
				return;
			}
		}

		// Fetch any undelivered task updates for this delegation
		const task = this.db.select().from(tasks).where(eq(tasks.delegationId, delegationId)).get();
		let fullMessage = userMessage;
		if (task) {
			const pending = this.db.select().from(taskPendingUpdates)
				.where(and(eq(taskPendingUpdates.taskId, task.id), isNull(taskPendingUpdates.deliveredAt)))
				.all();
			if (pending.length > 0) {
				const updates = pending.map((p) => p.message).join("\n");
				fullMessage = `${userMessage}\n\n---\nTask updates while you were working:\n${updates}\nPlease revise your output to reflect these changes before submitting.`;
				for (const p of pending) {
					this.db.update(taskPendingUpdates)
						.set({ deliveredAt: new Date() })
						.where(eq(taskPendingUpdates.id, p.id))
						.run();
				}
			}
		}

		const sessionId = randomUUID();
		const agent = makeAgent({
			role, dataDir: this.dataDir, db: this.db, sessionId, delegationId,
			authManager: this.authManager,
			emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
		} satisfies MakeAgentOpts);
		this.db.insert(agentSessions).values({
			id: sessionId, agentSlug: role, lifecycle: "transient", parentDelegationId: delegationId,
		}).run();
		agent.subscribe((evt) => {
			type AnyEvt = { type: string; message?: unknown };
			const e = evt as AnyEvt;
			if (e.type === "turn_start") {
				this.turnStartTimes.set(sessionId, Date.now());
				return;
			}
			if (e.type === "turn_end") {
				this.recordTurn(sessionId, e);
				return;
			}
			if (evt.type === "agent_end") {
				// Mark session as ended so it no longer appears as active
				this.db.update(agentSessions).set({ endedAt: new Date() })
					.where(eq(agentSessions.id, sessionId)).run();
				const last = agent.state.messages.at(-1);
				if (last?.role === "assistant" && last.errorMessage) {
					console.error(`[${role}] agent error:`, last.errorMessage);
				}
			}
		});
		agent.prompt(fullMessage).catch(console.error);
	}

	private recordTurn(sessionId: string, evt: { message?: unknown }): void {
		if (!this.telemetry) return;
		const msg = evt.message as {
			role?: string;
			model?: string;
			usage?: { input: number; output: number; cost: { total: number } };
		} | undefined;
		if (!msg || msg.role !== "assistant" || !msg.usage) return;
		const startedAt = this.turnStartTimes.get(sessionId) ?? Date.now();
		this.turnStartTimes.delete(sessionId);
		this.telemetry.recordTurn({
			sessionId,
			model: msg.model ?? "unknown",
			promptTokens: msg.usage.input,
			completionTokens: msg.usage.output,
			costUsdCents: Math.round(msg.usage.cost.total * 100),
			latencyMs: Date.now() - startedAt,
		});
		// Soft limit: warn once per calendar day at 80%
		const limit = this.telemetry.opts.dailyBudgetCents;
		if (limit > 0) {
			const today = new Date().toISOString().slice(0, 10);
			if (this.budgetWarnDate !== today) {
				const { totalCents } = this.telemetry.getTodayUsage();
				const pct = totalCents / limit;
				if (pct >= 0.8) {
					this.budgetWarnDate = today;
					this.broker.emit("budget_warning", { usedCents: totalCents, limitCents: limit, pct: Math.round(pct * 100) });
				}
			}
		}
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

	promptWarmAgent(role: string, message: string): void {
		const agent = this.warmAgents.get(role);
		if (!agent) return;
		void (async () => {
			await agent.waitForIdle();
			agent.prompt(message).catch(console.error);
		})();
	}

	restartWarmAgent(role: string): void {
		const oldSessionId = this.warmSessionIds.get(role);
		if (oldSessionId) {
			this.db.update(agentSessions)
				.set({ endedAt: new Date() })
				.where(eq(agentSessions.id, oldSessionId))
				.run();
		}
		const sessionId = randomUUID();
		const agent = makeAgent({
			role, dataDir: this.dataDir, db: this.db, sessionId,
			authManager: this.authManager,
			emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
		} satisfies MakeAgentOpts);
		this.warmAgents.set(role, agent);
		this.warmSessionIds.set(role, sessionId);
		this.db.insert(agentSessions).values({
			id: sessionId, agentSlug: role, lifecycle: "warm",
		}).run();
		const sid = sessionId;
		agent.subscribe((evt) => {
			type AnyEvt = { type: string; message?: unknown };
			const e = evt as AnyEvt;
			if (e.type === "turn_start") {
				this.turnStartTimes.set(sid, Date.now());
			} else if (e.type === "turn_end") {
				this.recordTurn(sid, e);
			}
		});
	}

	queueBrief(briefId: string): void {
		const brief = this.db.select().from(briefs).where(eq(briefs.id, briefId)).get();
		if (!brief) {
			console.error("queueBrief: brief not found", briefId);
			return;
		}

		// Orchestrator-first: ha van regisztrált workflow, az kezeli
		if (this.orchestrator?.onBriefDispatched(briefId)) {
			return;
		}

		// Fallback: régi director prompt logika
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
			authManager: this.authManager,
			emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
		} satisfies MakeAgentOpts);
		this.db.insert(agentSessions).values({
			id: sessionId, agentSlug: role, lifecycle: "transient", parentDelegationId: delegationId,
		}).run();
		return agent;
	}
}
