import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../../db/index.js";
import { delegations, tasks } from "../../db/schema.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import type { AgentRouter } from "../../broker/router.js";

function makeServer(db: AgencyDb, dataDir: string) {
  const broker = new Broker(db);
  const router = { getWarmRoles: () => [], promptWarmAgent: () => {} } as unknown as AgentRouter;
  return buildServer({ db, broker, router, dataDir, webRoot: "/nonexistent" });
}

function insertTask(db: AgencyDb, status = "open" as const) {
  const delegationId = randomUUID();
  db.insert(delegations).values({
    id: delegationId, fromAgent: "director", toAgent: "copywriter",
    status: "requested", payloadJson: { task: "x" } as never,
  }).run();
  const id = randomUUID();
  db.insert(tasks).values({ id, delegationId, title: "My task", status, assignedTo: "copywriter" }).run();
  return id;
}

describe("GET /api/tasks", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tasks-routes-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("returns all tasks", async () => {
    insertTask(db);
    insertTask(db, "in_progress");
    const app = await makeServer(db, dir);
    const res = await app.inject({ method: "GET", url: "/api/tasks" });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body).toHaveLength(2);
  });

  it("filters by status", async () => {
    insertTask(db, "open");
    insertTask(db, "done");
    const app = await makeServer(db, dir);
    const res = await app.inject({ method: "GET", url: "/api/tasks?status=done" });
    expect(res.json()).toHaveLength(1);
  });

  it("filters by assigned_to", async () => {
    insertTask(db);
    const app = await makeServer(db, dir);
    const res = await app.inject({ method: "GET", url: "/api/tasks?assigned_to=copywriter" });
    expect(res.json()).toHaveLength(1);
  });
});

describe("PATCH /api/tasks/:id", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tasks-routes-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("updates task status successfully", async () => {
    const taskId = insertTask(db);
    const app = await makeServer(db, dir);
    const res = await app.inject({
      method: "PATCH", url: `/api/tasks/${taskId}`,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "in_progress", current_version: 1 }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().newVersion).toBe(2);
  });

  it("returns 409 on version conflict", async () => {
    const taskId = insertTask(db);
    const app = await makeServer(db, dir);
    const res = await app.inject({
      method: "PATCH", url: `/api/tasks/${taskId}`,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done", current_version: 99 }),
    });
    expect(res.statusCode).toBe(409);
  });
});
