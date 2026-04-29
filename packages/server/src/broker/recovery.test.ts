import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { agentSessions, briefs, clients, delegations } from "../db/schema.js";
import { recoverState } from "./recovery.js";

describe("recoverState", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;
	// Shared client slug for FK satisfaction
	const CLIENT = "test-client";

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-recovery-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		// Insert a client row to satisfy FK constraints
		db.insert(clients).values({ slug: CLIENT, name: "Test Client", createdAt: Date.now() }).run();
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("marks open warm session as ended on recovery", () => {
		const sessionId = randomUUID();
		db.insert(agentSessions).values({
			id: sessionId,
			clientSlug: CLIENT,
			agentSlug: "director",
			lifecycle: "warm",
			startedAt: Date.now(),
		}).run();

		recoverState(db);

		const rows = db.select().from(agentSessions).all();
		const session = rows.find((r) => r.id === sessionId);
		expect(session?.endedAt).toBeDefined();
		expect(typeof session?.endedAt).toBe("number");
	});

	it("fails delegation for abandoned transient session without emitting error event", () => {
		// Set up: brief → delegation → transient session
		const briefId = randomUUID();
		db.insert(briefs).values({
			id: briefId,
			clientSlug: CLIENT,
			contentMd: "# Test brief",
			status: "dispatched",
			createdAt: Date.now(),
		}).run();

		const delegationId = randomUUID();
		db.insert(delegations).values({
			id: delegationId,
			briefId,
			clientSlug: CLIENT,
			fromAgent: "director",
			toAgent: "copywriter",
			payloadJson: "{}",
			status: "in_progress",
			requestedAt: Date.now(),
		}).run();

		const sessionId = randomUUID();
		db.insert(agentSessions).values({
			id: sessionId,
			clientSlug: CLIENT,
			agentSlug: "copywriter",
			lifecycle: "transient",
			parentDelegationId: delegationId,
			startedAt: Date.now(),
		}).run();

		recoverState(db);

		// Session should be marked ended
		const sessionRows = db.select().from(agentSessions).all();
		const session = sessionRows.find((r) => r.id === sessionId);
		expect(session?.endedAt).toBeDefined();
		expect(typeof session?.endedAt).toBe("number");

		// Delegation should be marked failed with completedAt
		const delegationRows = db.select().from(delegations).all();
		const delegation = delegationRows.find((r) => r.id === delegationId);
		expect(delegation?.status).toBe("failed");
		expect(delegation?.completedAt).toBeDefined();
		expect(typeof delegation?.completedAt).toBe("number");
	});
});
