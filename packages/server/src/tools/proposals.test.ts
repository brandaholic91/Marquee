import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs, memoryProposals } from "../db/schema.js";
import { proposeBrief, proposeMemoryUpdate } from "./proposals.js";

describe("proposal tools", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-prop-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("propose_brief creates draft brief and emits brief_proposed", async () => {
		const emit = vi.fn();
		const threadId = randomUUID();
		const result = await proposeBrief.execute(
			{ threadId, title: "Test Brief", scope: "blog post", deliverables: ["blog_post"] },
			{ db, agentSlug: "director", agentSessionId: randomUUID(), emit },
		);
		expect(result.briefId).toBeDefined();
		const rows = db.select().from(briefs).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe("draft");
		expect(emit).toHaveBeenCalledWith("brief_proposed", expect.objectContaining({ briefId: result.briefId }));
	});

	it("propose_memory_update creates pending proposal and emits memory_proposed", async () => {
		const emit = vi.fn();
		const patch = "--- a/client.md\n+++ b/client.md\n@@ -1 +1 @@\n-old\n+new\n";
		const result = await proposeMemoryUpdate.execute(
			{ file: "client_profile", patch },
			{ db, agentSlug: "copywriter", agentSessionId: randomUUID(), emit },
		);
		expect(result.proposalId).toBeDefined();
		const rows = db.select().from(memoryProposals).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe("pending");
		expect(emit).toHaveBeenCalledWith("memory_proposed", expect.any(Object));
	});

	it("propose_memory_update rejects empty patch", async () => {
		await expect(
			proposeMemoryUpdate.execute(
				{ file: "client_profile", patch: "short" },
				{ db, agentSlug: "copywriter", agentSessionId: randomUUID(), emit: vi.fn() },
			),
		).rejects.toThrow();
	});
});
