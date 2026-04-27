import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { delegations, deliverableRevisions, deliverables, evals, messages } from "../db/schema.js";
import { requestInput, submitEvalReport } from "./misc.js";

describe("misc tools", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-misc-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("request_input inserts a chat message and emits input_requested", async () => {
		const emit = vi.fn();
		const threadId = randomUUID();
		const result = await requestInput.execute(
			{ threadId, question: "What is the target keyword?" },
			{ db, agentSlug: "director", agentSessionId: randomUUID(), emit },
		);
		expect(result.pending).toBe(true);
		const rows = db.select().from(messages).all();
		expect(rows).toHaveLength(1);
		expect(emit).toHaveBeenCalledWith("input_requested", expect.any(Object));
	});

	it("submit_eval_report creates eval row and transitions deliverable to awaiting_approval", async () => {
		// Seed: delegation → deliverable → revision
		const dlgId = randomUUID();
		const deliverableId = randomUUID();
		const revisionId = randomUUID();
		db.insert(delegations).values({
			id: dlgId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "complete", payloadJson: {} as never,
		}).run();
		db.insert(deliverables).values({
			id: deliverableId, delegationId: dlgId, type: "blog_post",
			title: "T", status: "awaiting_eval", currentRevisionId: revisionId,
		}).run();
		db.insert(deliverableRevisions).values({
			id: revisionId, deliverableId, artifactPath: "/tmp/fake.md", createdByAgent: "copywriter",
		}).run();

		const emit = vi.fn();
		const result = await submitEvalReport.execute(
			{
				deliverableRevisionId: revisionId,
				scores: { brand_voice: 4, factual_accuracy: 3, usp_usage: 5 },
				summary: "Good post, brand voice mostly on point.",
			},
			{ db, agentSlug: "eval-judge", agentSessionId: randomUUID(), emit },
		);
		expect(result.evalId).toBeDefined();
		const evalRows = db.select().from(evals).all();
		expect(evalRows).toHaveLength(1);
		const delRow = db.select().from(deliverables).all()[0];
		expect(delRow.status).toBe("awaiting_approval");
		expect(emit).toHaveBeenCalledWith("eval_submitted", expect.any(Object));
	});
});
