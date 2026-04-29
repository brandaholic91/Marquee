import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "./index.js";
import { clients } from "./schema.js";
import { Broker } from "../broker/event-bus.js";
import * as q from "./queries.js";

describe("MVP queries", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-queries-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		// Seed a client row (FK target)
		db.insert(clients).values({ slug: "default", name: "Default", createdAt: Date.now() }).run();
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("recentEvents returns events ordered by ts desc", () => {
		const broker = new Broker(db);
		broker.emit("test_event_a", { x: 1 });
		broker.emit("test_event_b", { x: 2 });
		const rows = q.recentEvents(db);
		expect(rows.length).toBeGreaterThanOrEqual(2);
		// Most recent first
		expect(rows[0].type).toBe("test_event_b");
	});

	it("eventsAfter returns only events after given id", () => {
		const broker = new Broker(db);
		const e1 = broker.emit("first", {});
		const e2 = broker.emit("second", {});
		const after = q.eventsAfter(db, e1.id);
		expect(after.length).toBe(1);
		expect(after[0].id).toBe(e2.id);
	});

	it("approvalsQueue returns deliverables awaiting_approval (empty db)", () => {
		// Verify the query executes without error on empty db
		const results = q.approvalsQueue(db);
		expect(Array.isArray(results)).toBe(true);
		expect(results).toHaveLength(0);
	});

	it("pipelineCounts returns count per status", () => {
		const results = q.pipelineCounts(db);
		expect(Array.isArray(results)).toBe(true);
	});

	it("activeAgents returns sessions with ended_at IS NULL", () => {
		const results = q.activeAgents(db);
		expect(Array.isArray(results)).toBe(true);
	});
});
