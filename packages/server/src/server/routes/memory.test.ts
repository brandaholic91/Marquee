import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../../db/index.js";
import { memoryProposals } from "../../db/schema.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import type { AgentRouter } from "../../broker/router.js";

async function makeTestApp() {
	const dir = mkdtempSync(join(tmpdir(), "agency-memory-test-"));
	const memDir = join(dir, "memory");
	mkdirSync(memDir, { recursive: true });
	// initialise git repo so writeMemoryFile can commit
	const git = simpleGit(dir);
	await git.init();
	await git.addConfig("user.name", "test");
	await git.addConfig("user.email", "test@test.com");
	const { db, close } = openDb(join(dir, "test.db"));
	const broker = new Broker(db);
	const router = {} as AgentRouter;
	const app = await buildServer({ db, broker, router, dataDir: dir, webRoot: "/nonexistent" });
	return { dir, memDir, close, app, cleanup: () => { close(); rmSync(dir, { recursive: true, force: true }); } };
}

describe("GET /api/memory/files", () => {
	it("returns empty array when no memory files", async () => {
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({ method: "GET", url: "/api/memory/files" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
		cleanup();
	});

	it("returns file names for existing .md files", async () => {
		const { memDir, app, cleanup } = await makeTestApp();
		writeFileSync(join(memDir, "client_profile.md"), "---\nclient_name: Stackly\n---\nbody");
		const res = await app.inject({ method: "GET", url: "/api/memory/files" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ name: string }[]>();
		expect(body.map((f) => f.name)).toContain("client_profile.md");
		cleanup();
	});
});

describe("GET /api/memory/:filename", () => {
	it("returns parsed frontmatter and body", async () => {
		const { memDir, app, cleanup } = await makeTestApp();
		writeFileSync(join(memDir, "client_profile.md"), "---\nclient_name: Stackly\n---\nBody text here");
		const res = await app.inject({ method: "GET", url: "/api/memory/client_profile.md" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ frontmatter: Record<string, unknown>; body: string }>();
		expect(body.frontmatter.client_name).toBe("Stackly");
		expect(body.body.trim()).toBe("Body text here");
		cleanup();
	});

	it("returns 404 for missing file", async () => {
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({ method: "GET", url: "/api/memory/nonexistent.md" });
		expect(res.statusCode).toBe(404);
		cleanup();
	});
});

describe("PUT /api/memory/:filename", () => {
	it("writes content and returns ok", async () => {
		const { memDir, app, cleanup } = await makeTestApp();
		writeFileSync(join(memDir, "client_profile.md"), "---\nclient_name: Old\n---\nold body");
		const res = await app.inject({
			method: "PUT",
			url: "/api/memory/client_profile.md",
			headers: { "content-type": "application/json" },
			payload: { content: "---\nclient_name: Stackly\n---\nnew body" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ ok: true });
		cleanup();
	});

	it("returns 400 for invalid YAML frontmatter", async () => {
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({
			method: "PUT",
			url: "/api/memory/client_profile.md",
			headers: { "content-type": "application/json" },
			payload: { content: "no frontmatter here" },
		});
		expect(res.statusCode).toBe(400);
		cleanup();
	});
});

describe("MARQUEE_API_TOKEN auth guard", () => {
	it("returns 401 on POST /api/briefs when token set and no Authorization header", async () => {
		process.env.MARQUEE_API_TOKEN = "test-secret";
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({
			method: "POST",
			url: "/api/briefs",
			headers: { "content-type": "application/json" },
			payload: { contentMd: "test brief" },
		});
		expect(res.statusCode).toBe(401);
		delete process.env.MARQUEE_API_TOKEN;
		cleanup();
	});

	it("passes through when correct Bearer token provided", async () => {
		process.env.MARQUEE_API_TOKEN = "test-secret";
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({
			method: "POST",
			url: "/api/briefs",
			headers: {
				"content-type": "application/json",
				"authorization": "Bearer test-secret",
			},
			payload: { contentMd: "test brief" },
		});
		// 200 or other non-401 response means auth passed
		expect(res.statusCode).not.toBe(401);
		delete process.env.MARQUEE_API_TOKEN;
		cleanup();
	});

	it("passes through GET requests without token", async () => {
		process.env.MARQUEE_API_TOKEN = "test-secret";
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({ method: "GET", url: "/api/memory/files" });
		expect(res.statusCode).toBe(200);
		delete process.env.MARQUEE_API_TOKEN;
		cleanup();
	});
});

describe("POST /api/memory (create new file)", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "memory-new-test-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		mkdirSync(join(dir, "memory"), { recursive: true });
	});

	afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

	it("creates a new memory file with starter frontmatter", async () => {
		const app = await buildServer({ db, broker: new Broker(db), router: {} as never, dataDir: dir, webRoot: "/nonexistent" });
		const res = await app.inject({
			method: "POST", url: "/api/memory",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ filename: "new_client.md" }),
		});
		expect(res.statusCode).toBe(201);
		expect(existsSync(join(dir, "memory", "new_client.md"))).toBe(true);
	});

	it("rejects filename with path traversal", async () => {
		const app = await buildServer({ db, broker: new Broker(db), router: {} as never, dataDir: dir, webRoot: "/nonexistent" });
		const res = await app.inject({
			method: "POST", url: "/api/memory",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ filename: "../evil.md" }),
		});
		expect(res.statusCode).toBe(400);
	});

	it("rejects filename containing slash", async () => {
		const app = await buildServer({ db, broker: new Broker(db), router: {} as never, dataDir: dir, webRoot: "/nonexistent" });
		const res = await app.inject({
			method: "POST", url: "/api/memory",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ filename: "sub/path.md" }),
		});
		expect(res.statusCode).toBe(400);
	});
});

describe("POST /api/memory-proposals/:id/approve", () => {
	it("returns 404 when proposal not found", async () => {
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({
			method: "POST",
			url: "/api/memory-proposals/nonexistent/approve",
			headers: { "content-type": "application/json" },
			payload: { decision: "approved" },
		});
		expect(res.statusCode).toBe(404);
		cleanup();
	});

	it("applies a valid unified diff and marks proposal approved", async () => {
		const { dir, memDir, app, cleanup } = await makeTestApp();
		writeFileSync(join(memDir, "client_profile.md"), "---\nclient_name: Old\n---\nbody");
		const git = simpleGit(dir);
		await git.add(join(memDir, "client_profile.md"));
		await git.commit("initial", [join(memDir, "client_profile.md")]);
		const patch = [
			`--- a/memory/client_profile.md`,
			`+++ b/memory/client_profile.md`,
			`@@ -1,3 +1,3 @@`,
			` ---`,
			`-client_name: Old`,
			`+client_name: New`,
			` ---`,
		].join("\n") + "\n";
		const { db, close: closeDb } = openDb(join(dir, "test.db"));
		db.insert(memoryProposals).values({
			id: "prop-1", file: "client_profile.md", patch, status: "pending",
		}).run();
		const res = await app.inject({
			method: "POST",
			url: "/api/memory-proposals/prop-1/approve",
			headers: { "content-type": "application/json" },
			payload: { decision: "approved" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ ok: true });
		const updated = db.select().from(memoryProposals).all();
		expect(updated[0]?.status).toBe("approved");
		closeDb();
		cleanup();
	});

	it("returns 409 when patch does not apply cleanly", async () => {
		const { dir, memDir, app, cleanup } = await makeTestApp();
		writeFileSync(join(memDir, "client_profile.md"), "---\nclient_name: Something\n---\n");
		const git = simpleGit(dir);
		await git.add(join(memDir, "client_profile.md"));
		await git.commit("initial", [join(memDir, "client_profile.md")]);
		const { db, close: closeDb } = openDb(join(dir, "test.db"));
		db.insert(memoryProposals).values({
			id: "prop-bad", file: "client_profile.md",
			patch: "not a valid diff at all\n", status: "pending",
		}).run();
		const res = await app.inject({
			method: "POST",
			url: "/api/memory-proposals/prop-bad/approve",
			headers: { "content-type": "application/json" },
			payload: { decision: "approved" },
		});
		expect(res.statusCode).toBe(409);
		const row = db.select().from(memoryProposals).all();
		expect(row[0]?.status).toBe("pending");
		closeDb();
		cleanup();
	});

	it("marks proposal rejected without touching git", async () => {
		const { dir, app, cleanup } = await makeTestApp();
		const { db } = openDb(join(dir, "test.db"));
		db.insert(memoryProposals).values({
			id: "prop-rej", file: "client_profile.md", patch: "any", status: "pending",
		}).run();
		const res = await app.inject({
			method: "POST",
			url: "/api/memory-proposals/prop-rej/approve",
			headers: { "content-type": "application/json" },
			payload: { decision: "rejected" },
		});
		expect(res.statusCode).toBe(200);
		const row = db.select().from(memoryProposals).all();
		expect(row[0]?.status).toBe("rejected");
		cleanup();
	});
});
