import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { agentSessions, delegations, deliverableRevisions, deliverables } from "../db/schema.js";
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

	it("attaches and detaches without throwing", () => {
		const trigger = new EvalTrigger(db, broker, dir);
		expect(() => {
			trigger.attach();
			trigger.detach();
		}).not.toThrow();
	});

	it("spawns an eval-judge agent session when deliverable_submitted is emitted", () => {
		const trigger = new EvalTrigger(db, broker, dir);
		trigger.attach();

		const dlgId = randomUUID();
		const deliverableId = randomUUID();
		const revisionId = randomUUID();
		const artifactPath = join(dir, "artifact.md");
		writeFileSync(artifactPath, "# Test content\n\nSome deliverable content here.");

		db.insert(delegations).values({
			id: dlgId, fromAgent: "content-lead", toAgent: "copywriter",
			status: "in_progress", payloadJson: {} as never,
		}).run();
		db.insert(deliverables).values({
			id: deliverableId, delegationId: dlgId, type: "blog_post",
			title: "T", status: "awaiting_eval", currentRevisionId: revisionId,
		}).run();
		db.insert(deliverableRevisions).values({
			id: revisionId, deliverableId, artifactPath, createdByAgent: "copywriter",
		}).run();

		broker.emit("deliverable_submitted", { deliverableId, revisionId });

		// The EvalTrigger should have created a new agent session for eval-judge
		const sessions = db.select().from(agentSessions).all();
		expect(sessions.length).toBeGreaterThan(0);
		const evalSession = sessions.find((s) => s.agentSlug === "eval-judge");
		expect(evalSession).toBeDefined();
	});
});
