import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { Broker } from "../broker/event-bus.js";
import { AgentRouter } from "../broker/router.js";
import { buildServer } from "./index.js";

describe("SSE + snapshot", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;
	let app: Awaited<ReturnType<typeof buildServer>>;
	let broker: Broker;

	beforeEach(async () => {
		dir = mkdtempSync(join(tmpdir(), "agency-sse-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		mkdirSync(join(dir, "memory"), { recursive: true });
		writeFileSync(join(dir, "memory/client_profile.md"), "---\nclient_name: T\n---\nbody");
		writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: x\n---\nb");
		broker = new Broker(db);
		const router = new AgentRouter(db, broker, dir);
		router.boot();
		app = await buildServer({ db, broker, router, dataDir: dir, webRoot: "/tmp" });
		// SSE is registered inside buildServer, no need to register separately
	});

	afterEach(async () => {
		await app.close();
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("GET /api/state/snapshot returns pipeline and active agents", async () => {
		const res = await app.inject({ method: "GET", url: "/api/state/snapshot" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty("approvals");
		expect(body).toHaveProperty("pipeline");
		expect(body).toHaveProperty("activeAgents");
		expect(body).toHaveProperty("threads");
	});
});
