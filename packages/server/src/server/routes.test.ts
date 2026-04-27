import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs, chatThreads } from "../db/schema.js";
import { Broker } from "../broker/event-bus.js";
import { AgentRouter } from "../broker/router.js";
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
		mkdirSync(join(dir, "memory"), { recursive: true });
		writeFileSync(join(dir, "memory/client_profile.md"), "---\nclient_name: T\n---\nbody");
		writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: x\n---\nb");
		const broker = new Broker(db);
		const router = new AgentRouter(db, broker, dir);
		router.boot();
		app = await buildServer({ db, broker, router, dataDir: dir, webRoot: "/tmp" });
	});

	afterEach(async () => {
		await app.close();
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("POST /api/threads creates a chat thread", async () => {
		const res = await app.inject({
			method: "POST", url: "/api/threads",
			payload: { title: "Test Thread" },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.id).toBeDefined();
		const rows = db.select().from(chatThreads).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Test Thread");
	});

	it("GET /api/briefs returns empty array initially", async () => {
		const res = await app.inject({ method: "GET", url: "/api/briefs" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("POST /api/approvals/:id approves a deliverable", async () => {
		// Seed a deliverable awaiting_approval
		const dlgId = randomUUID();
		const { delegations, deliverables } = await import("../db/schema.js");
		db.insert(delegations).values({
			id: dlgId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "complete", payloadJson: {} as never,
		}).run();
		const delId = randomUUID();
		db.insert(deliverables).values({
			id: delId, delegationId: dlgId, type: "blog_post",
			title: "T", status: "awaiting_approval",
		}).run();

		const res = await app.inject({
			method: "POST", url: `/api/approvals/${delId}`,
			payload: { decision: "approved" },
		});
		expect(res.statusCode).toBe(200);
		const updated = db.select().from(deliverables).all()[0];
		expect(updated.status).toBe("shipped");
	});
});
