import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { clients, chatThreads } from "../db/schema.js";
import { Broker } from "../broker/event-bus.js";
import { buildServer } from "./index.js";

describe("REST routes", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;
	let app: Awaited<ReturnType<typeof buildServer>>;

	beforeEach(async () => {
		dir = mkdtempSync(join(tmpdir(), "agency-server-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		mkdirSync(join(dir, "memory", "clients", "default"), { recursive: true });
		writeFileSync(
			join(dir, "memory", "clients", "default", "client_profile.md"),
			"---\nclient_name: T\n---\nbody",
		);
		// Seed client row
		db.insert(clients).values({ slug: "default", name: "Default", createdAt: Date.now() }).run();
		const broker = new Broker(db);
		app = await buildServer({ db, broker, dataDir: dir, webRoot: "/tmp", n8nWebhookUrl: null });
	});

	afterEach(async () => {
		await app.close();
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("POST /api/threads creates a chat thread", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/threads",
			payload: { title: "Test Thread" },
		});
		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.thread_id).toBeDefined();
		const rows = db.select().from(chatThreads).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Test Thread");
	});

	it("GET /api/briefs returns empty array initially", async () => {
		const res = await app.inject({ method: "GET", url: "/api/briefs" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("GET /api/threads returns auto-created thread on first call", async () => {
		const res = await app.inject({ method: "GET", url: "/api/threads" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body.length).toBeGreaterThanOrEqual(1);
	});
});
