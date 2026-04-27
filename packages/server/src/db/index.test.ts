import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "./index";
import { chatThreads } from "./schema";

describe("openDb", () => {
	let dir: string;
	let db: AgencyDb;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-test-"));
		db = openDb(join(dir, "test.db"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("inserts and reads a chat thread", () => {
		const id = randomUUID();
		db.insert(chatThreads).values({ id, type: "intake", title: "test" }).run();
		const rows = db.select().from(chatThreads).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("test");
	});
});
