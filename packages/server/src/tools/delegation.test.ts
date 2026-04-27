import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { delegations } from "../db/schema.js";
import { delegateToLead } from "./delegation.js";

describe("delegate_to_lead", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-tools-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("creates a delegation record with status=requested", async () => {
		const emit = vi.fn();
		const result = await delegateToLead.execute(
			{ lead: "content-lead", task: "write a blog post", briefId: undefined },
			{ db, agentSlug: "director", agentSessionId: randomUUID(), emit },
		);
		expect(result.delegationId).toBeDefined();
		const rows = db.select().from(delegations).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].fromAgent).toBe("director");
		expect(rows[0].toAgent).toBe("content-lead");
		expect(rows[0].status).toBe("requested");
		expect(emit).toHaveBeenCalledWith("delegation_created", expect.any(Object));
	});

	it("rejects an unknown lead slug", async () => {
		await expect(
			delegateToLead.execute(
				{ lead: "unknown-lead", task: "x" } as never,
				{ db, agentSlug: "director", agentSessionId: randomUUID(), emit: vi.fn() },
			),
		).rejects.toThrow(/lead/i);
	});
});
