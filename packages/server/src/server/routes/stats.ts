import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { usageToday, qualityLast30Days } from "../../db/queries.js";

interface ScoresJson {
	brand_voice: number;
	factual_accuracy: number;
	usp_usage: number;
}

export function registerStatsRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/stats/usage", async () => {
		const rows = usageToday(opts.db);
		const totalTokens = rows.reduce((s, r) => s + (r.promptTokens ?? 0) + (r.completionTokens ?? 0), 0);
		const totalCents = rows.reduce((s, r) => s + (r.costUsdCents ?? 0), 0);
		const budgetCents = Number(process.env.MARQUEE_DAILY_BUDGET_CENTS ?? 0);
		return {
			today: {
				tokens: totalTokens,
				costUsdCents: totalCents,
				byAgent: rows.map((r) => ({
					agentSlug: r.agentSlug,
					tokens: (r.promptTokens ?? 0) + (r.completionTokens ?? 0),
					costUsdCents: r.costUsdCents ?? 0,
				})),
			},
			budgetCents,
			budgetUsedPct: budgetCents > 0 ? Math.min(100, Math.round((totalCents / budgetCents) * 100)) : 0,
		};
	});

	app.get("/api/stats/quality", async () => {
		const rows = qualityLast30Days(opts.db);
		if (rows.length === 0) {
			return { days: [], avg: { brand_voice: 0, factual_accuracy: 0, usp_usage: 0 } };
		}

		const byDate = new Map<string, ScoresJson[]>();
		for (const row of rows) {
			const date = row.createdAt
				? new Date(row.createdAt).toISOString().slice(0, 10)
				: new Date().toISOString().slice(0, 10);
			const scores = row.scoresJson as ScoresJson;
			if (!byDate.has(date)) byDate.set(date, []);
			byDate.get(date)!.push(scores);
		}

		const days = [...byDate.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, scores]) => {
				const avg = (key: keyof ScoresJson) =>
					Math.round((scores.reduce((s, sc) => s + sc[key], 0) / scores.length) * 10) / 10;
				return {
					date,
					brand_voice: avg("brand_voice"),
					factual_accuracy: avg("factual_accuracy"),
					usp_usage: avg("usp_usage"),
					count: scores.length,
				};
			});

		const allScores = rows.map((r) => r.scoresJson as ScoresJson);
		const globalAvg = (key: keyof ScoresJson) =>
			Math.round((allScores.reduce((s, sc) => s + sc[key], 0) / allScores.length) * 10) / 10;

		return {
			days,
			avg: {
				brand_voice: globalAvg("brand_voice"),
				factual_accuracy: globalAvg("factual_accuracy"),
				usp_usage: globalAvg("usp_usage"),
			},
		};
	});
}
