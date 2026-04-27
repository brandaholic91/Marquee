import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { agentSessions } from "../db/schema.js";
import { Telemetry } from "./index.js";

describe("Telemetry", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-telemetry-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("records a turn and persists it", () => {
		const sessionId = randomUUID();
		db.insert(agentSessions).values({
			id: sessionId, agentSlug: "copywriter", lifecycle: "transient",
		}).run();
		const tel = new Telemetry(db, { dailyBudgetCents: 1000 });
		tel.recordTurn({
			sessionId, model: "kimi-k2.6",
			promptTokens: 1000, completionTokens: 500, costUsdCents: 25, latencyMs: 1200,
		});
		const budget = tel.getTodayUsage();
		expect(budget.totalCents).toBe(25);
	});

	it("throws BudgetExceededError when over daily limit", () => {
		const sessionId = randomUUID();
		db.insert(agentSessions).values({
			id: sessionId, agentSlug: "copywriter", lifecycle: "transient",
		}).run();
		const tel = new Telemetry(db, { dailyBudgetCents: 10 });
		tel.recordTurn({
			sessionId, model: "kimi-k2.6",
			promptTokens: 100, completionTokens: 50, costUsdCents: 15, latencyMs: 100,
		});
		expect(() => tel.checkBudget()).toThrow(/budget/i);
	});
});
