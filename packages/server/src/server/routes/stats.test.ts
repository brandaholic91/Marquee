import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, it, expect, afterEach } from "vitest";
import { openDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import { agentSessions, turns, evals, deliverableRevisions, deliverables, delegations, briefs } from "../../db/schema.js";
import type { AgentRouter } from "../../broker/router.js";

async function makeStatsApp() {
	const dir = mkdtempSync(join(tmpdir(), "stats-test-"));
	mkdirSync(join(dir, "memory"), { recursive: true });
	const { db, close } = openDb(join(dir, "test.db"));
	const broker = new Broker(db);
	const app = await buildServer({ db, broker, router: {} as AgentRouter, dataDir: dir, webRoot: "/nonexistent" });
	const cleanup = () => {
		close();
		rmSync(dir, { recursive: true, force: true });
	};
	return { db, app, cleanup };
}

describe("GET /api/stats/usage", () => {
	it("returns zero totals when no turns exist", async () => {
		const { app, cleanup } = await makeStatsApp();
		const res = await app.inject({ method: "GET", url: "/api/stats/usage" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ today: { tokens: number; costUsdCents: number; byAgent: unknown[] }; budgetCents: number; budgetUsedPct: number }>();
		expect(body.today.tokens).toBe(0);
		expect(body.today.costUsdCents).toBe(0);
		expect(body.today.byAgent).toEqual([]);
		expect(body.budgetCents).toBe(0);
		cleanup();
	});

	it("aggregates tokens and cost by agent for today", async () => {
		const { db, app, cleanup } = await makeStatsApp();
		const sessionId = randomUUID();
		db.insert(agentSessions).values({ id: sessionId, agentSlug: "copywriter", lifecycle: "transient" }).run();
		db.insert(turns).values({
			id: randomUUID(),
			sessionId,
			model: "kimi-k2.6",
			promptTokens: 1000,
			completionTokens: 500,
			costUsd: 25,
			latencyMs: 1200,
		}).run();
		const res = await app.inject({ method: "GET", url: "/api/stats/usage" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ today: { tokens: number; byAgent: { agentSlug: string; tokens: number }[] } }>();
		expect(body.today.tokens).toBe(1500);
		expect(body.today.byAgent[0]?.agentSlug).toBe("copywriter");
		expect(body.today.byAgent[0]?.tokens).toBe(1500);
		cleanup();
	});
});

describe("GET /api/stats/quality", () => {
	it("returns empty when no evals exist", async () => {
		const { app, cleanup } = await makeStatsApp();
		const res = await app.inject({ method: "GET", url: "/api/stats/quality" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ days: unknown[]; avg: { brand_voice: number } }>();
		expect(body.days).toEqual([]);
		expect(body.avg.brand_voice).toBe(0);
		cleanup();
	});

	it("aggregates eval scores by date", async () => {
		const { db, app, cleanup } = await makeStatsApp();
		const briefId = randomUUID();
		db.insert(briefs).values({ id: briefId, status: "done", contentMd: "test" }).run();
		const delegationId = randomUUID();
		db.insert(delegations).values({ id: delegationId, briefId, fromAgent: "director", toAgent: "copywriter", status: "complete", payloadJson: {} }).run();
		const deliverableId = randomUUID();
		db.insert(deliverables).values({ id: deliverableId, delegationId, type: "blog_post", title: "Test", status: "shipped" }).run();
		const revId = randomUUID();
		db.insert(deliverableRevisions).values({ id: revId, deliverableId, artifactPath: "/tmp/x.md", createdByAgent: "copywriter" }).run();
		db.insert(evals).values({
			id: randomUUID(),
			revisionId: revId,
			scoresJson: { brand_voice: 4, factual_accuracy: 3, usp_usage: 5 } as never,
			summaryMd: "good",
		}).run();
		const res = await app.inject({ method: "GET", url: "/api/stats/quality" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ days: { brand_voice: number }[]; avg: { brand_voice: number } }>();
		expect(body.days.length).toBe(1);
		expect(body.avg.brand_voice).toBe(4);
		cleanup();
	});
});
