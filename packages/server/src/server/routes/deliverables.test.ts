import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { openDb, type AgencyDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import { delegations, deliverables, deliverableRevisions, evals } from "../../db/schema.js";
import type { AgentRouter } from "../../broker/router.js";

function makeTestDep() {
	const dir = mkdtempSync(join(tmpdir(), "agency-route-test-"));
	const { db, close } = openDb(join(dir, "test.db"));
	const broker = new Broker(db);
	const router = {} as AgentRouter;
	return { dir, db, close, broker, router };
}

async function makeApp(db: AgencyDb, broker: Broker, router: AgentRouter, dir: string) {
	return buildServer({ db, broker, router, dataDir: dir, webRoot: "/nonexistent" });
}

function seedDeliverable(db: AgencyDb, status: "drafting" | "awaiting_eval" | "awaiting_approval" | "shipped" | "archived" = "awaiting_approval") {
	const dlgId = randomUUID();
	const delId = randomUUID();
	const revId = randomUUID();
	db.insert(delegations).values({
		id: dlgId, fromAgent: "director", toAgent: "content-lead",
		status: "complete", payloadJson: {} as never,
	}).run();
	db.insert(deliverables).values({
		id: delId, delegationId: dlgId, type: "blog_post",
		title: "Test Post", status, currentRevisionId: revId,
	}).run();
	db.insert(deliverableRevisions).values({
		id: revId, deliverableId: delId,
		artifactPath: "/dev/null", createdByAgent: "copywriter",
	}).run();
	return { dlgId, delId, revId };
}

describe("GET /api/deliverables/:id/revisions", () => {
	let deps: ReturnType<typeof makeTestDep>;

	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("returns revision list for a known deliverable", async () => {
		const { db, broker, router, dir } = deps;
		const { delId, revId } = seedDeliverable(db);
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/${delId}/revisions` });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string }[]>();
		expect(body).toHaveLength(1);
		expect(body[0].id).toBe(revId);
	});

	it("returns empty array for deliverable with no revisions", async () => {
		const { db, broker, router, dir } = deps;
		const dlgId = randomUUID(); const delId = randomUUID();
		db.insert(delegations).values({ id: dlgId, fromAgent: "director", toAgent: "content-lead", status: "complete", payloadJson: {} as never }).run();
		db.insert(deliverables).values({ id: delId, delegationId: dlgId, type: "blog_post", title: "T", status: "drafting" }).run();
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/${delId}/revisions` });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});
});

describe("GET /api/deliverables/:id/eval", () => {
	let deps: ReturnType<typeof makeTestDep>;

	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("returns null when no eval exists", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db);
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/${delId}/eval` });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toBeNull();
	});

	it("returns the latest eval record", async () => {
		const { db, broker, router, dir } = deps;
		const { delId, revId } = seedDeliverable(db);
		const evalId = randomUUID();
		db.insert(evals).values({
			id: evalId, revisionId: revId,
			scoresJson: { brand_voice: 4, factual_accuracy: 5, usp_usage: 3 } as never,
			summaryMd: "Good post",
		}).run();
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/${delId}/eval` });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string; summaryMd: string }>();
		expect(body.id).toBe(evalId);
		expect(body.summaryMd).toBe("Good post");
	});
});

describe("PATCH /api/deliverables/:id/status", () => {
	let deps: ReturnType<typeof makeTestDep>;

	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("transitions awaiting_approval → shipped", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db, "awaiting_approval");
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "PATCH",
			url: `/api/deliverables/${delId}/status`,
			headers: { "content-type": "application/json" },
			payload: { status: "shipped" },
		});
		expect(res.statusCode).toBe(200);
		const updated = db.select().from(deliverables).where(eq(deliverables.id, delId)).get();
		expect(updated?.status).toBe("shipped");
	});

	it("rejects an invalid transition (shipped → drafting)", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db, "shipped");
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "PATCH",
			url: `/api/deliverables/${delId}/status`,
			headers: { "content-type": "application/json" },
			payload: { status: "drafting" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("returns 404 for unknown deliverable", async () => {
		const { db, broker, router, dir } = deps;
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "PATCH",
			url: `/api/deliverables/${randomUUID()}/status`,
			headers: { "content-type": "application/json" },
			payload: { status: "shipped" },
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("GET /api/deliverables/revisions/:revisionId/content", () => {
	let deps: ReturnType<typeof makeTestDep>;

	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("returns revision file content", async () => {
		const { db, broker, router, dir } = deps;
		const artifactsDir = join(dir, "artifacts");
		mkdirSync(artifactsDir, { recursive: true });
		const artifactPath = join(artifactsDir, "rev_001.md");
		writeFileSync(artifactPath, "# Hello world", "utf8");

		const dlgId = randomUUID();
		const deliverableId = randomUUID();
		db.insert(delegations).values({
			id: dlgId, fromAgent: "director", toAgent: "content-lead",
			status: "complete", payloadJson: {} as never,
		}).run();
		db.insert(deliverables).values({
			id: deliverableId, delegationId: dlgId, type: "blog_post",
			title: "Test", status: "drafting",
		}).run();
		const revId = randomUUID();
		db.insert(deliverableRevisions).values({
			id: revId, deliverableId, artifactPath, createdByAgent: "copywriter",
		}).run();

		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/revisions/${revId}/content` });
		expect(res.statusCode).toBe(200);
		expect(res.json().content).toContain("Hello world");
	});

	it("returns 404 for unknown revision", async () => {
		const { db, broker, router, dir } = deps;
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: "/api/deliverables/revisions/nonexistent/content" });
		expect(res.statusCode).toBe(404);
	});
});
