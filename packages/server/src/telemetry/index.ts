import { gte, sum } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AgencyDb } from "../db/index.js";
import { turns } from "../db/schema.js";

export class BudgetExceededError extends Error {
	constructor(used: number, limit: number) {
		super(`Daily budget exceeded: used ${used}¢ of ${limit}¢`);
	}
}

export interface TelemetryOptions {
	dailyBudgetCents: number;
}

export interface TurnRecord {
	sessionId: string;
	model: string;
	promptTokens: number;
	completionTokens: number;
	costUsdCents: number;
	latencyMs: number;
}

export class Telemetry {
	constructor(private db: AgencyDb, readonly opts: TelemetryOptions) {}

	recordTurn(turn: TurnRecord): void {
		this.db.insert(turns).values({
			id: randomUUID(),
			sessionId: turn.sessionId,
			model: turn.model,
			promptTokens: turn.promptTokens,
			completionTokens: turn.completionTokens,
			costUsd: turn.costUsdCents,
			latencyMs: turn.latencyMs,
		}).run();
	}

	getTodayUsage(): { totalCents: number } {
		const dayStart = new Date();
		dayStart.setUTCHours(0, 0, 0, 0);
		const rows = this.db
			.select({ total: sum(turns.costUsd).mapWith(Number) })
			.from(turns)
			.where(gte(turns.startedAt, dayStart))
			.get();
		return { totalCents: rows?.total ?? 0 };
	}

	checkBudget(): void {
		const { totalCents } = this.getTodayUsage();
		if (totalCents > this.opts.dailyBudgetCents) {
			throw new BudgetExceededError(totalCents, this.opts.dailyBudgetCents);
		}
	}
}
