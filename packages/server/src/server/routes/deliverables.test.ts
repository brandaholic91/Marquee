import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { openDb, type AgencyDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import { campaigns, delegations, deliverables, deliverableRevisions, evals } from "../../db/schema.js";
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

describe("POST /api/deliverables/:id/repurpose", () => {
	let deps: ReturnType<typeof makeTestDep>;

	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("creates a delegation to content-lead and returns delegationId", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db, "shipped");
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "POST",
			url: `/api/deliverables/${delId}/repurpose`,
			headers: { "content-type": "application/json" },
			payload: { channels: ["linkedin_post", "twitter_thread"] },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json<{ delegationId: string }>();
		expect(body.delegationId).toBeTruthy();
		const row = deps.db.select().from(delegations).where(eq(delegations.id, body.delegationId)).get();
		expect(row?.fromAgent).toBe("human");
		expect(row?.toAgent).toBe("content-lead");
		expect(row?.status).toBe("requested");
	});

	it("returns 400 when deliverable is not shipped", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db, "awaiting_approval");
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "POST",
			url: `/api/deliverables/${delId}/repurpose`,
			headers: { "content-type": "application/json" },
			payload: { channels: ["linkedin_post"] },
		});
		expect(res.statusCode).toBe(400);
	});

	it("returns 400 when channels array is empty", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db, "shipped");
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "POST",
			url: `/api/deliverables/${delId}/repurpose`,
			headers: { "content-type": "application/json" },
			payload: { channels: [] },
		});
		expect(res.statusCode).toBe(400);
	});

	it("returns 400 when channels array exceeds 5 items", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db, "shipped");
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "POST",
			url: `/api/deliverables/${delId}/repurpose`,
			headers: { "content-type": "application/json" },
			payload: { channels: ["a", "b", "c", "d", "e", "f"] },
		});
		expect(res.statusCode).toBe(400);
	});

	it("returns 404 for unknown deliverable", async () => {
		const { db, broker, router, dir } = deps;
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "POST",
			url: `/api/deliverables/${randomUUID()}/repurpose`,
			headers: { "content-type": "application/json" },
			payload: { channels: ["twitter_thread"] },
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("POST /api/deliverables/:id/repurpose — campaignId propagation", () => {
	let deps: ReturnType<typeof makeTestDep>;
	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("sets campaignId on the new delegation from source deliverable", async () => {
		const { db, broker, router, dir } = deps;
		const campaignId = randomUUID();
		db.insert(campaigns).values({ id: campaignId, title: "Test Campaign", status: "active" }).run();
		const { delId } = seedDeliverable(db, "shipped");
		db.update(deliverables).set({ campaignId }).where(eq(deliverables.id, delId)).run();

		const app = await makeApp(db, broker, router, dir);
		await app.inject({
			method: "POST", url: `/api/deliverables/${delId}/repurpose`,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ channels: ["linkedin"] }),
		});

		const newDelegation = db.select().from(delegations).all()
			.find(d => d.toAgent === "content-lead" && d.fromAgent === "human")!;
		expect(newDelegation.campaignId).toBe(campaignId);
	});
});

describe("GET /api/deliverables?campaignId", () => {
	let deps: ReturnType<typeof makeTestDep>;
	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("filters deliverables by campaignId", async () => {
		const { db, broker, router, dir } = deps;
		const campaignId = randomUUID();
		db.insert(campaigns).values({ id: campaignId, title: "C", status: "active" }).run();
		const { delId: id1 } = seedDeliverable(db);
		db.update(deliverables).set({ campaignId }).where(eq(deliverables.id, id1)).run();
		seedDeliverable(db);

		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables?campaignId=${campaignId}` });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string }[]>();
		expect(body).toHaveLength(1);
		expect(body[0].id).toBe(id1);
	});
});
