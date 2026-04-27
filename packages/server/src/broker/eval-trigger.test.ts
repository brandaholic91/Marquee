import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { delegations, deliverableRevisions, deliverables } from "../db/schema.js";
import { Broker } from "./event-bus.js";
import { EvalTrigger } from "./eval-trigger.js";

describe("EvalTrigger", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;
	let broker: Broker;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-eval-trigger-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		mkdirSync(join(dir, "memory"), { recursive: true });
		writeFileSync(join(dir, "memory/client_profile.md"), "---\nclient_name: T\n---\nbody");
		writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: x\n---\nb");
		broker = new Broker(db);
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("schedules an eval-judge config when deliverable_submitted is emitted", () => {
		const trigger = new EvalTrigger(db, broker, dir);
		trigger.attach();
		const scheduled: unknown[] = [];
		trigger.onEvalScheduled((config) => scheduled.push(config));

		const dlgId = randomUUID();
		const deliverableId = randomUUID();
		const revisionId = randomUUID();
		db.insert(delegations).values({
			id: dlgId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "in_progress", payloadJson: {} as never,
		}).run();
		db.insert(deliverables).values({
			id: deliverableId, delegationId: dlgId, type: "blog_post",
			title: "T", status: "awaiting_eval", currentRevisionId: revisionId,
		}).run();
		db.insert(deliverableRevisions).values({
			id: revisionId, deliverableId, artifactPath: "/tmp/x.md", createdByAgent: "copywriter",
		}).run();

		broker.emit("deliverable_submitted", { deliverableId, revisionId });
		expect(scheduled).toHaveLength(1);
	});
});
