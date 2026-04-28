import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema.js";

describe("schema", () => {
	it("exports all expected tables", () => {
		expect(Object.keys(schema)).toContain("chatThreads");
		expect(Object.keys(schema)).toContain("messages");
		expect(Object.keys(schema)).toContain("deliverables");
		expect(Object.keys(schema)).toContain("turns");
	});

	it("exports tasks and taskPendingUpdates tables", () => {
		expect(Object.keys(schema)).toContain("tasks");
		expect(Object.keys(schema)).toContain("taskPendingUpdates");
	});

	it("has no duplicate column names in any table", () => {
		for (const [name, table] of Object.entries(schema)) {
			const cols = getTableConfig(table as Parameters<typeof getTableConfig>[0]).columns.map((c) => c.name);
			const unique = new Set(cols);
			expect(unique.size, `Table "${name}" has duplicate columns: ${cols.join(", ")}`).toBe(cols.length);
		}
	});

	it("creates a drizzle db instance without errors", () => {
		const dir = mkdtempSync(join(tmpdir(), "agency-test-"));
		const sqlite = new Database(join(dir, "test.db"));
		expect(() => drizzle(sqlite, { schema })).not.toThrow();
	});
});
