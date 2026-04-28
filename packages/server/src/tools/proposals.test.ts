import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs, campaigns, memoryProposals } from "../db/schema.js";
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

	it("propose_brief creates a campaign with the brief title", async () => {
		const emit = vi.fn();
		const result = await proposeBrief.execute(
			{ threadId: randomUUID(), title: "Q2 Launch", scope: "blog", deliverables: ["blog_post"] },
			{ db, agentSlug: "director", agentSessionId: randomUUID(), emit },
		);
		const brief = db.select().from(briefs).where(eq(briefs.id, result.briefId)).get()!;
		expect(brief.campaignId).toBeDefined();
		const campaign = db.select().from(campaigns).where(eq(campaigns.id, brief.campaignId!)).get();
		expect(campaign?.title).toBe("Q2 Launch");
		expect(campaign?.status).toBe("active");
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

	it("propose_brief uses existing campaign when campaignId provided", async () => {
		const emit = vi.fn();
		const campaignId = randomUUID();
		db.insert(campaigns).values({ id: campaignId, title: "Existing", status: "active" }).run();

		const result = await proposeBrief.execute(
			{ threadId: randomUUID(), title: "New Brief", scope: "blog", deliverables: ["blog_post"], campaignId },
			{ db, agentSlug: "director", agentSessionId: randomUUID(), emit },
		);

		const brief = db.select().from(briefs).where(eq(briefs.id, result.briefId)).get()!;
		expect(brief.campaignId).toBe(campaignId);
		// no new campaign created — still only 1 campaign in DB
		expect(db.select().from(campaigns).all()).toHaveLength(1);
	});

	it("propose_brief throws when campaignId does not exist", async () => {
		const emit = vi.fn();
		await expect(
			proposeBrief.execute(
				{ threadId: randomUUID(), title: "Brief", scope: "blog", deliverables: ["blog_post"], campaignId: "nonexistent" },
				{ db, agentSlug: "director", agentSessionId: randomUUID(), emit },
			),
		).rejects.toThrow("Campaign nonexistent not found");
	});
});
