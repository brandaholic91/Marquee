import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
