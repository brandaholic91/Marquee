import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { clients } from "../db/schema.js";
import { Broker } from "../broker/event-bus.js";
import { buildServer } from "./index.js";

describe("SSE endpoint", () => {
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
		mkdirSync(join(dir, "memory", "clients", "default"), { recursive: true });
		writeFileSync(join(dir, "memory", "clients", "default", "client_profile.md"), "---\nclient_name: T\n---\nbody");
		// Seed client row
		db.insert(clients).values({ slug: "default", name: "Default", createdAt: Date.now() }).run();
		broker = new Broker(db);
		app = await buildServer({ db, broker, dataDir: dir, webRoot: "/tmp", n8nWebhookUrl: null });
	});

	afterEach(async () => {
		await app.close();
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("GET /api/health returns ok", async () => {
		const res = await app.inject({ method: "GET", url: "/api/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	it("GET /api/events is registered (route exists)", async () => {
		// SSE connections stay open; we verify the route is registered by checking
		// a preflight that doesn't keep the connection open. Actual SSE streaming is
		// tested end-to-end in smoke.ts.
		const routes = app.printRoutes();
		expect(routes).toContain("events");
	});
});
