import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { Telemetry } from "./index.js";

describe("Telemetry (stub)", () => {
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

	it("accumulates cost and returns totalCents", () => {
		const tel = new Telemetry(db, { dailyBudgetCents: 1000 });
		tel.recordTurn({
			sessionId: "sess-1",
			model: "kimi-k2.6",
			promptTokens: 1000,
			completionTokens: 500,
			costUsdCents: 25,
			latencyMs: 1200,
		});
		const budget = tel.getTodayUsage();
		expect(budget.totalCents).toBe(25);
	});

	it("throws BudgetExceededError when over daily limit", () => {
		const tel = new Telemetry(db, { dailyBudgetCents: 10 });
		tel.recordTurn({
			sessionId: "sess-1",
			model: "kimi-k2.6",
			promptTokens: 100,
			completionTokens: 50,
			costUsdCents: 15,
			latencyMs: 100,
		});
		expect(() => tel.checkBudget()).toThrow(/budget/i);
	});
});
