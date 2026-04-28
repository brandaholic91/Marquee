import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, it, expect, afterEach } from "vitest";
import { openDb } from "../db/index.js";
import { Broker } from "./event-bus.js";
import { AgentRouter } from "./router.js";
import { Telemetry } from "../telemetry/index.js";
import { agentSessions, delegations, briefs } from "../db/schema.js";

describe("AgentRouter budget guard", () => {
	let dir: string;
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	function setup(budgetCents: number) {
		dir = mkdtempSync(join(tmpdir(), "router-budget-test-"));
		const { db, close } = openDb(join(dir, "test.db"));
		const broker = new Broker(db);
		const telemetry = new Telemetry(db, { dailyBudgetCents: budgetCents });
		const router = new AgentRouter(db, broker, dir, undefined, telemetry);
		return { db, broker, close, router, telemetry };
	}

	it("emits budget_exceeded when hard limit hit for non-director specialist", async () => {
		const { db, broker, close, router, telemetry } = setup(10);

		// Exceed the budget by recording a fake turn
		const sessionId = randomUUID();
		db.insert(agentSessions).values({ id: sessionId, agentSlug: "copywriter", lifecycle: "transient" }).run();
		telemetry.recordTurn({ sessionId, model: "test", promptTokens: 100, completionTokens: 50, costUsdCents: 15, latencyMs: 100 });

		const events: string[] = [];
		broker.subscribe((e) => { events.push(e.type); });

		// Create minimal DB records for spawnAndPrompt
		const briefId = randomUUID();
		db.insert(briefs).values({ id: briefId, status: "dispatched", contentMd: "test" }).run();
		const delegationId = randomUUID();
		db.insert(delegations).values({
			id: delegationId, briefId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "requested", payloadJson: { task: "write something" },
		}).run();

		router.boot();
		await new Promise((r) => setTimeout(r, 50));

		// Trigger via delegation_created event
		broker.emit("delegation_created", { delegationId, to: "copywriter", from: "content-lead" });
		await new Promise((r) => setTimeout(r, 100));

		expect(events).toContain("budget_exceeded");
		close();
	});

	it("does not emit budget_exceeded for director even when over limit", async () => {
		const { db, broker, close, router, telemetry } = setup(10);

		// Director is a warm agent — it bypasses the guard
		// We verify no budget_exceeded event is emitted when director is prompted
		const sessionId = randomUUID();
		db.insert(agentSessions).values({ id: sessionId, agentSlug: "director", lifecycle: "warm" }).run();
		telemetry.recordTurn({ sessionId, model: "test", promptTokens: 100, completionTokens: 50, costUsdCents: 15, latencyMs: 100 });

		const events: string[] = [];
		broker.subscribe((e) => { if (e.type === "budget_exceeded") events.push(e.type); });

		router.boot();
		await new Promise((r) => setTimeout(r, 50));

		// promptWarmAgent("director") should NOT trigger budget check
		router.promptWarmAgent("director", "hello");
		await new Promise((r) => setTimeout(r, 100));

		expect(events).not.toContain("budget_exceeded");
		close();
	});

	it("does not block when dailyBudgetCents is 0 (guard disabled)", async () => {
		const { db, broker, close, router, telemetry } = setup(0); // disabled

		const sessionId = randomUUID();
		db.insert(agentSessions).values({ id: sessionId, agentSlug: "copywriter", lifecycle: "transient" }).run();
		telemetry.recordTurn({ sessionId, model: "test", promptTokens: 100, completionTokens: 50, costUsdCents: 99999, latencyMs: 100 });

		const events: string[] = [];
		broker.subscribe((e) => { if (e.type === "budget_exceeded") events.push(e.type); });

		const briefId = randomUUID();
		db.insert(briefs).values({ id: briefId, status: "dispatched", contentMd: "test" }).run();
		const delegationId = randomUUID();
		db.insert(delegations).values({
			id: delegationId, briefId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "requested", payloadJson: { task: "write" },
		}).run();

		router.boot();
		await new Promise((r) => setTimeout(r, 50));
		broker.emit("delegation_created", { delegationId, to: "copywriter", from: "content-lead" });
		await new Promise((r) => setTimeout(r, 100));

		expect(events).not.toContain("budget_exceeded");
		close();
	});
});
