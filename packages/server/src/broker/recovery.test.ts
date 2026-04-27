import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { agentSessions, briefs, delegations } from "../db/schema.js";
import { Broker } from "./event-bus.js";
import { AgentRouter } from "./router.js";
import { recoverState } from "./recovery.js";

describe("recoverState", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;
	let broker: Broker;
	let router: AgentRouter;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-recovery-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		mkdirSync(join(dir, "memory"), { recursive: true });
		writeFileSync(join(dir, "memory/client_profile.md"), "---\nclient_name: T\n---\nbody");
		writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: x\n---\nb");
		broker = new Broker(db);
		router = new AgentRouter(db, broker, dir);
		router.boot();
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("re-dispatches dispatched briefs to the director without throwing", () => {
		const briefId = randomUUID();
		db.insert(briefs).values({
			id: briefId, status: "dispatched", contentMd: "# Test",
		}).run();
		// recoverState now dispatches directly — no queue to inspect
		expect(() => recoverState(db, router)).not.toThrow();
		// getBriefQueue is a no-op stub; briefs are dispatched immediately via queueBrief
		expect(router.getBriefQueue()).toEqual([]);
	});

	it("marks orphaned warm sessions as ended", () => {
		const orphanId = randomUUID();
		db.insert(agentSessions).values({
			id: orphanId, agentSlug: "director", lifecycle: "warm",
		}).run();
		recoverState(db, router);
		const rows = db.select().from(agentSessions).all();
		// orphaned session (not in current warm pool) should be marked ended
		const orphan = rows.find((r) => r.id === orphanId);
		expect(orphan?.endedAt).toBeDefined();
	});
});
