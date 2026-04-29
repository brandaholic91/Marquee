// Telemetry is a v0.3 feature (budget tracking). In v1 the turns table has no
// costUsd column. This module is kept as a stub so existing test scaffolding
// compiles; the real implementation will be restored when costUsd is added back.

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
	private total = 0;

	constructor(_db: unknown, readonly opts: TelemetryOptions) {}

	recordTurn(turn: TurnRecord): void {
		this.total += turn.costUsdCents;
	}

	getTodayUsage(): { totalCents: number } {
		return { totalCents: this.total };
	}

	checkBudget(): void {
		if (this.total > this.opts.dailyBudgetCents) {
			throw new BudgetExceededError(this.total, this.opts.dailyBudgetCents);
		}
	}
}
