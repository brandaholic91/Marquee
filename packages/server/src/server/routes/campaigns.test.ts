import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type AgencyDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import { campaigns, delegations, deliverables, tasks } from "../../db/schema.js";
import type { AgentRouter } from "../../broker/router.js";

let dir: string;
let db: AgencyDb;
let close: () => void;
let broker: Broker;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "campaigns-test-"));
	mkdirSync(join(dir, "memory"), { recursive: true });
	({ db, close } = openDb(join(dir, "test.db")));
	broker = new Broker(db);
});
afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

async function makeApp() {
	return buildServer({ db, broker, router: {} as AgentRouter, dataDir: dir, webRoot: "/nonexistent" });
}

function seedCampaign(title = "Test Campaign") {
	const id = randomUUID();
	db.insert(campaigns).values({ id, title, status: "active" }).run();
	return id;
}

describe("GET /api/campaigns", () => {
	it("returns empty array when no campaigns", async () => {
		const app = await makeApp();
		const res = await app.inject({ method: "GET", url: "/api/campaigns" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("returns campaigns with deliverableCount and taskCount", async () => {
		const campaignId = seedCampaign("My Campaign");
		const dlgId = randomUUID();
		db.insert(delegations).values({ id: dlgId, fromAgent: "director", toAgent: "copywriter", status: "complete", payloadJson: {}, campaignId }).run();
		db.insert(deliverables).values({ id: randomUUID(), delegationId: dlgId, type: "blog_post", title: "Post", status: "shipped", campaignId }).run();
		db.insert(deliverables).values({ id: randomUUID(), delegationId: dlgId, type: "blog_post", title: "Post 2", status: "awaiting_approval", campaignId }).run();
		db.insert(tasks).values({ id: randomUUID(), delegationId: dlgId, title: "Task 1", status: "open", assignedTo: "copywriter", campaignId }).run();

		const app = await makeApp();
		const res = await app.inject({ method: "GET", url: "/api/campaigns" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string; title: string; deliverableCount: number; taskCount: number; pendingApprovals: number }[]>();
		expect(body).toHaveLength(1);
		expect(body[0].title).toBe("My Campaign");
		expect(body[0].deliverableCount).toBe(2);
		expect(body[0].taskCount).toBe(1);
		expect(body[0].pendingApprovals).toBe(1);
	});
});

describe("GET /api/campaigns/:id", () => {
	it("returns 404 for unknown campaign", async () => {
		const app = await makeApp();
		const res = await app.inject({ method: "GET", url: "/api/campaigns/nonexistent" });
		expect(res.statusCode).toBe(404);
	});

	it("returns campaign with deliverables and tasks arrays", async () => {
		const campaignId = seedCampaign();
		const dlgId = randomUUID();
		db.insert(delegations).values({ id: dlgId, fromAgent: "director", toAgent: "copywriter", status: "complete", payloadJson: {}, campaignId }).run();
		db.insert(deliverables).values({ id: randomUUID(), delegationId: dlgId, type: "blog_post", title: "Post", status: "shipped", campaignId }).run();
		db.insert(tasks).values({ id: randomUUID(), delegationId: dlgId, title: "Task", status: "done", assignedTo: "copywriter", campaignId }).run();

		const app = await makeApp();
		const res = await app.inject({ method: "GET", url: `/api/campaigns/${campaignId}` });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string; deliverables: unknown[]; tasks: unknown[] }>();
		expect(body.id).toBe(campaignId);
		expect(body.deliverables).toHaveLength(1);
		expect(body.tasks).toHaveLength(1);
	});
});

describe("PATCH /api/campaigns/:id", () => {
	it("updates title and status", async () => {
		const campaignId = seedCampaign("Old Title");
		const app = await makeApp();
		const res = await app.inject({
			method: "PATCH", url: `/api/campaigns/${campaignId}`,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "New Title", status: "completed" }),
		});
		expect(res.statusCode).toBe(200);
		const updated = db.select().from(campaigns).all().find(c => c.id === campaignId)!;
		expect(updated.title).toBe("New Title");
		expect(updated.status).toBe("completed");
	});

	it("returns 404 for unknown campaign", async () => {
		const app = await makeApp();
		const res = await app.inject({
			method: "PATCH", url: "/api/campaigns/nonexistent",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "x" }),
		});
		expect(res.statusCode).toBe(404);
	});
});
