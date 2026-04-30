import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliverablesRoutes } from "./deliverables.js";
import * as schema from "../../db/schema.js";

vi.mock("@mariozechner/pi-agent-core", () => ({
	Agent: class FakeAgent {
		constructor(public opts: any) {}
		async prompt() {
			/* no-op for tests */
		}
	},
}));

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
let baseDir: string;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

async function seedDeliverable() {
	const now = Date.now();
	await db.insert(schema.briefs).values({
		id: "br_1",
		clientSlug: "default",
		sourceThreadId: null,
		contentMd: JSON.stringify({
			title: "t",
			body: "b",
			deliverable_type: "social_post",
			target_specialist: "social-manager",
			platform: "instagram",
		}),
		status: "dispatched",
		createdAt: now,
		dispatchedAt: now,
	});
	await db.insert(schema.delegations).values({
		id: "del_1",
		briefId: "br_1",
		clientSlug: "default",
		fromAgent: "director",
		toAgent: "social-manager",
		payloadJson: "{}",
		status: "complete",
		requestedAt: now,
		completedAt: now,
	});
	// Insert deliverable first (without currentRevisionId) to satisfy the FK from deliverable_revisions → deliverables
	await db.insert(schema.deliverables).values({
		id: "d_1",
		delegationId: "del_1",
		clientSlug: "default",
		type: "social_post",
		status: "awaiting_approval",
		currentRevisionId: null,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(schema.deliverableRevisions).values({
		id: "rev_1",
		deliverableId: "d_1",
		revisionNo: 1,
		artifactPath: "/tmp/test/rev_001.md",
		createdByAgent: "social-manager",
		feedbackNote: null,
		ts: now,
	});
	// Now set currentRevisionId back (revision row now exists)
	await db.update(schema.deliverables).set({ currentRevisionId: "rev_1" });
}

beforeEach(async () => {
	events.length = 0;
	baseDir = mkdtempSync(join(tmpdir(), "marquee-deliv-"));
	const sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	await migrate(db, { migrationsFolder: "drizzle" });
	await db.insert(schema.clients).values({ slug: "default", name: "D", createdAt: Date.now() });
	app = Fastify();
	await app.register(deliverablesRoutes, { db, broker, dataDir: baseDir, n8nWebhookUrl: null });
});

describe("deliverables routes", () => {
	it("GET /api/deliverables — lists by client (default)", async () => {
		await seedDeliverable();
		const res = await app.inject({ method: "GET", url: "/api/deliverables" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveLength(1);
		expect(body[0].id).toBe("d_1");
	});

	it("GET /api/deliverables?status=awaiting_approval — filters", async () => {
		await seedDeliverable();
		const res = await app.inject({ method: "GET", url: "/api/deliverables?status=awaiting_approval" });
		expect(res.json()).toHaveLength(1);
		const res2 = await app.inject({ method: "GET", url: "/api/deliverables?status=shipped" });
		expect(res2.json()).toHaveLength(0);
	});

	it("GET /api/deliverables/:id — returns deliverable + revisions", async () => {
		await seedDeliverable();
		const res = await app.inject({ method: "GET", url: "/api/deliverables/d_1" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.deliverable.id).toBe("d_1");
		expect(body.revisions).toHaveLength(1);
	});

	it("GET /api/deliverables/:id — 404 for missing", async () => {
		const res = await app.inject({ method: "GET", url: "/api/deliverables/nonexistent" });
		expect(res.statusCode).toBe(404);
	});

	it("POST /:id/approve — sets shipped + inserts approval + emits event", async () => {
		await seedDeliverable();
		const res = await app.inject({ method: "POST", url: "/api/deliverables/d_1/approve" });
		expect(res.statusCode).toBe(200);
		const ds = await db.select().from(schema.deliverables).all();
		expect(ds[0].status).toBe("shipped");
		const ap = await db.select().from(schema.approvals).all();
		expect(ap).toHaveLength(1);
		expect(ap[0].decision).toBe("approved");
		expect(events.some((e) => e.type === "deliverable_approved")).toBe(true);
	});

	it("POST /:id/approve — 400 if not awaiting_approval", async () => {
		await seedDeliverable();
		await db.update(schema.deliverables).set({ status: "shipped" }).run();
		const res = await app.inject({ method: "POST", url: "/api/deliverables/d_1/approve" });
		expect(res.statusCode).toBe(400);
	});

	it("POST /:id/return — sets drafting + creates new delegation + emits events", async () => {
		await seedDeliverable();
		const res = await app.inject({
			method: "POST",
			url: "/api/deliverables/d_1/return",
			payload: { note: "túl rövid" },
		});
		expect(res.statusCode).toBe(200);
		const ds = await db.select().from(schema.deliverables).all();
		expect(ds[0].status).toBe("drafting");
		const dels = await db.select().from(schema.delegations).all();
		expect(dels).toHaveLength(2);
		const newDel = dels.find((d) => d.id !== "del_1");
		expect(newDel?.status).toBe("in_progress");
		expect(ds[0].delegationId).toBe(newDel?.id);
		const ap = await db.select().from(schema.approvals).all();
		expect(ap[0].decision).toBe("requested_changes");
		expect(ap[0].note).toBe("túl rövid");
		expect(events.some((e) => e.type === "deliverable_returned")).toBe(true);
		expect(events.some((e) => e.type === "delegation_started")).toBe(true);
	});

	it("POST /:id/discard — sets archived + inserts discarded approval + emits event", async () => {
		await seedDeliverable();
		const res = await app.inject({
			method: "POST",
			url: "/api/deliverables/d_1/discard",
			payload: { note: "irreleváns" },
		});
		expect(res.statusCode).toBe(200);
		const ds = await db.select().from(schema.deliverables).all();
		expect(ds[0].status).toBe("archived");
		const ap = await db.select().from(schema.approvals).all();
		expect(ap[0].decision).toBe("discarded");
		expect(ap[0].note).toBe("irreleváns");
		expect(events.some((e) => e.type === "deliverable_discarded")).toBe(true);
	});

	it("POST /:id/review — 200 + ok:true", async () => {
		await seedDeliverable();
		const res = await app.inject({ method: "POST", url: "/api/deliverables/d_1/review" });
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
		expect(events.some((e) => e.type === "review_started")).toBe(true);
	});

	it("POST /:id/review — 404 for missing deliverable", async () => {
		const res = await app.inject({ method: "POST", url: "/api/deliverables/nonexistent/review" });
		expect(res.statusCode).toBe(404);
	});

	it("GET /:id/reviews — returns empty array when no reviews", async () => {
		await seedDeliverable();
		const res = await app.inject({ method: "GET", url: "/api/deliverables/d_1/reviews" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});
});

describe("POST /api/deliverables/:id/handoff", () => {
	async function seedSeoDeliverable() {
		const now = Date.now();
		const artifactDir = join(baseDir, "artifacts", "clients", "default", "seo_del");
		await mkdir(artifactDir, { recursive: true });
		const artifactPath = join(artifactDir, "rev_001.md");
		await writeFile(
			artifactPath,
			"# SEO Brief\nprimary_keyword: saas onboarding\n\n## H-struktúra\n- H2: Mi az aktiváció?\n- H2: Mit mérj?",
		);

		await db.insert(schema.briefs).values({
			id: "br_seo",
			clientSlug: "default",
			sourceThreadId: null,
			contentMd: JSON.stringify({
				title: "SEO brief",
				body: "",
				deliverable_type: "content_brief_seo",
				target_specialist: "seo-specialist",
			}),
			status: "dispatched",
			createdAt: now,
			dispatchedAt: now,
		});
		await db.insert(schema.delegations).values({
			id: "del_seo",
			briefId: "br_seo",
			clientSlug: "default",
			fromAgent: "director",
			toAgent: "seo-specialist",
			payloadJson: "{}",
			status: "complete",
			requestedAt: now,
			completedAt: now,
		});
		await db.insert(schema.deliverables).values({
			id: "seo_del",
			delegationId: "del_seo",
			clientSlug: "default",
			type: "content_brief_seo",
			status: "awaiting_approval",
			currentRevisionId: null,
			createdAt: now,
			updatedAt: now,
		});
		await db.insert(schema.deliverableRevisions).values({
			id: "seo_rev",
			deliverableId: "seo_del",
			revisionNo: 1,
			artifactPath,
			createdByAgent: "seo-specialist",
			feedbackNote: null,
			ts: now,
		});
		await db
			.update(schema.deliverables)
			.set({ currentRevisionId: "seo_rev" })
			.where(eq(schema.deliverables.id, "seo_del"));
	}

	it("returns 400 when deliverable type is not content_brief_seo", async () => {
		await seedDeliverable();
		const res = await app.inject({
			method: "POST",
			url: "/api/deliverables/d_1/handoff",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ target_role: "copywriter" }),
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error).toBe("not_content_brief_seo");
	});

	it("creates a draft brief with parent_deliverable_id and returns brief_id", async () => {
		await seedSeoDeliverable();
		const res = await app.inject({
			method: "POST",
			url: "/api/deliverables/seo_del/handoff",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ target_role: "copywriter", brief_overrides: { title: "SEO cikk: saas onboarding" } }),
		});
		expect(res.statusCode).toBe(200);
		const { brief_id } = res.json();
		expect(brief_id).toBeTruthy();

		const brief = (await db.select().from(schema.briefs).where(eq(schema.briefs.id, brief_id)).all())[0];
		expect(brief.status).toBe("draft");
		expect(brief.parentDeliverableId).toBe("seo_del");
		const payload = JSON.parse(brief.contentMd);
		expect(payload.target_specialist).toBe("copywriter");
		expect(payload.skill).toBe("seo_article_writer");
		expect(payload.body).toContain("SEO Brief");
	});
});
