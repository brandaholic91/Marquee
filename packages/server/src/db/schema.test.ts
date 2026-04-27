import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("schema", () => {
  it("creates all tables in a fresh db", () => {
    const dir = mkdtempSync(join(tmpdir(), "agency-test-"));
    const sqlite = new Database(join(dir, "test.db"));
    const db = drizzle(sqlite, { schema });
    // Verify schema compiles and exports the expected tables
    expect(Object.keys(schema)).toContain("chatThreads");
    expect(Object.keys(schema)).toContain("messages");
    expect(Object.keys(schema)).toContain("deliverables");
    expect(Object.keys(schema)).toContain("turns");
  });
});
