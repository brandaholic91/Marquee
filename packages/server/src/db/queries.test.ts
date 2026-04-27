import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "./index.js";
import { agentSessions, deliverables, delegations, turns } from "./schema.js";
import * as q from "./queries.js";

describe("dashboard queries", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-test-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("approvalsQueue returns deliverables awaiting_approval", () => {
		const dlgId = randomUUID();
		db.insert(delegations).values({
			id: dlgId, fromAgent: "director", toAgent: "content-lead",
			status: "complete", payloadJson: {} as never,
		}).run();
		db.insert(deliverables).values({
			id: randomUUID(), delegationId: dlgId, type: "blog_post",
			title: "Test", status: "awaiting_approval",
		}).run();
		expect(q.approvalsQueue(db)).toHaveLength(1);
	});

	it("topSpenderToday returns agent with highest cost in current day", () => {
		const sId = randomUUID();
		db.insert(agentSessions).values({
			id: sId, agentSlug: "copywriter", lifecycle: "transient",
		}).run();
		db.insert(turns).values({
			id: randomUUID(), sessionId: sId, model: "kimi-k2.6",
			promptTokens: 1000, completionTokens: 500, costUsd: 25, latencyMs: 1200,
		}).run();
		expect(q.topSpenderToday(db)?.agentSlug).toBe("copywriter");
	});

	it("activeAgents returns sessions with ended_at IS NULL", () => {
		db.insert(agentSessions).values({
			id: randomUUID(), agentSlug: "director", lifecycle: "warm",
		}).run();
		expect(q.activeAgents(db)).toHaveLength(1);
	});
});
