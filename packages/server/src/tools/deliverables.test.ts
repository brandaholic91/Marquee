import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { openDb, type AgencyDb } from "../db/index.js";
import { delegations, deliverables } from "../db/schema.js";
import { makeSubmitDeliverable, readDeliverable } from "./deliverables.js";

describe("deliverable tools", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-del-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	const mkDelegationCtx = (delegationId: string) => ({
		db, agentSlug: "copywriter", agentSessionId: randomUUID(), delegationId, emit: vi.fn(),
	});

	it("creates deliverable + revision and writes artifact to disk", async () => {
		const dlgId = randomUUID();
		db.insert(delegations).values({
			id: dlgId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "in_progress", payloadJson: {} as never,
		}).run();

		const submit = makeSubmitDeliverable(dir);
		const result = await submit.execute(
			{ type: "blog_post", title: "Test Post", contentMd: "A".repeat(60) },
			mkDelegationCtx(dlgId),
		);
		expect(result.deliverableId).toBeDefined();
		expect(result.revisionId).toBeDefined();

		const rows = db.select().from(deliverables).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe("awaiting_eval");
		expect(existsSync(join(dir, "artifacts", result.deliverableId, "rev_001.md"))).toBe(true);
	});

	it("rejects submit_deliverable when no delegationId", async () => {
		const submit = makeSubmitDeliverable(dir);
		await expect(
			submit.execute(
				{ type: "blog_post", title: "x", contentMd: "A".repeat(60) },
				{ db, agentSlug: "copywriter", agentSessionId: randomUUID(), emit: vi.fn() },
			),
		).rejects.toThrow(/delegation/i);
	});

	it("read_deliverable returns submitted content", async () => {
		const dlgId = randomUUID();
		db.insert(delegations).values({
			id: dlgId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "in_progress", payloadJson: {} as never,
		}).run();

		const submit = makeSubmitDeliverable(dir);
		const { deliverableId } = await submit.execute(
			{ type: "blog_post", title: "Read Test", contentMd: "B".repeat(60) },
			mkDelegationCtx(dlgId),
		);

		const result = await readDeliverable.execute(
			{ deliverableId },
			{ db, agentSlug: "eval-judge", agentSessionId: randomUUID(), emit: vi.fn() },
		);
		expect(result.contentMd).toBe("B".repeat(60));
		expect(result.title).toBe("Read Test");
	});
});

describe("source_deliverable_id", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-deliverable-tool-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		const dlgId = randomUUID();
		db.insert(delegations).values({
			id: dlgId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "requested", payloadJson: {} as never,
		}).run();
		(db as any)._testDlgId = dlgId;
	});

	afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

	it("stores source_deliverable_id when provided", async () => {
		const tool = makeSubmitDeliverable(dir);
		const dlgId = (db as any)._testDlgId as string;

		// Create the "source" deliverable first
		const sourceDlgId = randomUUID();
		const sourceDelId = randomUUID();
		db.insert(delegations).values({
			id: sourceDlgId, fromAgent: "director", toAgent: "content-lead",
			status: "complete", payloadJson: {} as never,
		}).run();
		db.insert(deliverables).values({
			id: sourceDelId, delegationId: sourceDlgId, type: "blog_post",
			title: "Original", status: "shipped",
		}).run();

		const emit = vi.fn();
		const result = await tool.execute(
			{
				type: "linkedin_post",
				title: "LinkedIn version",
				contentMd: "A".repeat(60),
				source_deliverable_id: sourceDelId,
			},
			{ db, agentSlug: "repurposer", agentSessionId: "s1", delegationId: dlgId, emit },
		);

		const row = db.select().from(deliverables).where(eq(deliverables.id, result.deliverableId)).get();
		expect(row?.sourceDeliverableId).toBe(sourceDelId);
	});

	it("leaves sourceDeliverableId null when not provided", async () => {
		const tool = makeSubmitDeliverable(dir);
		const dlgId = (db as any)._testDlgId as string;
		const emit = vi.fn();
		const result = await tool.execute(
			{ type: "blog_post", title: "Post", contentMd: "A".repeat(60) },
			{ db, agentSlug: "copywriter", agentSessionId: "s1", delegationId: dlgId, emit },
		);
		const row = db.select().from(deliverables).where(eq(deliverables.id, result.deliverableId)).get();
		expect(row?.sourceDeliverableId).toBeNull();
	});
});

describe("submit_deliverable — new deliverable types", () => {
	let dir: string;
	let close: () => void;
	let db: AgencyDb;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-del-test-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		// seed a delegation so delegationId is valid
		db.insert(delegations).values({
			id: "dlg-1", fromAgent: "distribution-lead", toAgent: "social-manager",
			status: "in_progress", payloadJson: {} as never,
		}).run();
	});

	afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

	it("accepts linkedin_post type", async () => {
		const tool = makeSubmitDeliverable(dir);
		const result = await tool.execute(
			{ type: "linkedin_post", title: "PLG metrics post", contentMd: "A".repeat(50) },
			{ db, agentSlug: "social-manager", agentSessionId: randomUUID(), delegationId: "dlg-1", emit: vi.fn() },
		);
		expect(result.deliverableId).toBeDefined();
	});

	it("accepts landing_page type", async () => {
		const tool = makeSubmitDeliverable(dir);
		const result = await tool.execute(
			{ type: "landing_page", title: "Stackly PLG Landing", contentMd: "B".repeat(50) },
			{ db, agentSlug: "copywriter", agentSessionId: randomUUID(), delegationId: "dlg-1", emit: vi.fn() },
		);
		expect(result.deliverableId).toBeDefined();
	});

	it("accepts seo_report type", async () => {
		const tool = makeSubmitDeliverable(dir);
		const result = await tool.execute(
			{ type: "seo_report", title: "PLG keyword research", contentMd: "C".repeat(50) },
			{ db, agentSlug: "seo-analyst", agentSessionId: randomUUID(), delegationId: "dlg-1", emit: vi.fn() },
		);
		expect(result.deliverableId).toBeDefined();
	});
});
