import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "./index.js";
import { clients, chatThreads } from "./schema.js";

describe("openDb", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-test-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		// Seed client row (FK target)
		db.insert(clients).values({ slug: "default", name: "Default", createdAt: Date.now() }).run();
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("inserts and reads a chat thread", () => {
		const id = randomUUID();
		db.insert(chatThreads).values({ id, clientSlug: "default", title: "test" }).run();
		const rows = db.select().from(chatThreads).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("test");
	});
});
