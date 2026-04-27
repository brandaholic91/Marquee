import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs } from "../db/schema.js";
import { Broker } from "./event-bus.js";
import { AgentRouter } from "./router.js";

describe("AgentRouter", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;
	let broker: Broker;
	let router: AgentRouter;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-router-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		mkdirSync(join(dir, "memory"), { recursive: true });
		writeFileSync(join(dir, "memory/client_profile.md"), "---\nclient_name: T\n---\nbody");
		writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: x\n---\nb");
		broker = new Broker(db);
		router = new AgentRouter(db, broker, dir);
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("boots without error and creates warm agent configs", () => {
		expect(() => router.boot()).not.toThrow();
		expect(router.getWarmRoles()).toContain("director");
		expect(router.getWarmRoles()).toContain("content-lead");
		expect(router.getWarmRoles()).toContain("eval-judge");
	});

	it("dispatchBrief queues the brief for processing", () => {
		router.boot();
		const briefId = randomUUID();
		db.insert(briefs).values({
			id: briefId, status: "dispatched", contentMd: "# Test\n\n**Scope:** test",
		}).run();
		expect(() => router.queueBrief(briefId)).not.toThrow();
		expect(router.getBriefQueue()).toContain(briefId);
	});
});
