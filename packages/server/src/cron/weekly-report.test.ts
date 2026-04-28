import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { Broker } from "../broker/event-bus.js";
import { runWeeklyReport } from "./weekly-report.js";
import { delegations } from "../db/schema.js";

describe("runWeeklyReport", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;
  let broker: Broker;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "weekly-report-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    broker = new Broker(db);
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("creates a delegation from cron to insights-lead", async () => {
    await runWeeklyReport(db, dir, broker);
    const dlgs = db.select().from(delegations).all();
    expect(dlgs).toHaveLength(1);
    expect(dlgs[0].fromAgent).toBe("cron");
    expect(dlgs[0].toAgent).toBe("insights-lead");
    expect(dlgs[0].status).toBe("requested");
  });

  it("emits delegation_created event with correct to field", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runWeeklyReport(db, dir, broker);
    const event = emitted.find((e) => e.type === "delegation_created");
    expect(event).toBeDefined();
    expect(event!.payload.to).toBe("insights-lead");
    expect(event!.payload.from).toBe("cron");
  });

  it("includes week date and performance stats in delegation task", async () => {
    await runWeeklyReport(db, dir, broker);
    const dlg = db.select().from(delegations).all()[0];
    const payload = dlg.payloadJson as { task: string };
    expect(payload.task).toContain("Weekly performance report");
    expect(payload.task).toContain("analytics-analyst");
  });
});
