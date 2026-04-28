import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { buildDailySummaryMd, runDailySummary } from "./daily-summary.js";

describe("buildDailySummaryMd", () => {
  it("includes date header", () => {
    const md = buildDailySummaryMd({ today: "2026-04-28", sessions: [], delegations: [], deliverables: [], evals: [] });
    expect(md).toContain("# Daily Summary — 2026-04-28");
  });

  it("lists session counts", () => {
    const md = buildDailySummaryMd({
      today: "2026-04-28",
      sessions: [{ agentSlug: "director", count: 2, turns: 8 }],
      delegations: [],
      deliverables: [],
      evals: [],
    });
    expect(md).toContain("director");
    expect(md).toContain("2");
  });
});

describe("runDailySummary", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("writes a daily note file to memory/daily_notes/YYYY-MM-DD.md", async () => {
    await runDailySummary(db, dir);
    const today = new Date().toISOString().slice(0, 10);
    expect(existsSync(join(dir, "memory", "daily_notes", `${today}.md`))).toBe(true);
  });
});
