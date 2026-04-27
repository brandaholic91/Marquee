import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../../db/index.js";
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
