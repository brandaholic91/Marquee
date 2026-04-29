import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { campaigns, delegations, tasks, taskPendingUpdates } from "../db/schema.js";
import { Broker } from "../broker/event-bus.js";
import { ConflictError, TaskManager, updateTaskInDb } from "./manager.js";
import type { AgentRouter } from "../broker/router.js";

function makeRouter(warmRoles = ["director", "content-lead", "distribution-lead", "insights-lead", "eval-judge"]) {
  return {
    getWarmRoles: vi.fn(() => warmRoles),
    promptWarmAgent: vi.fn(),
  } as unknown as AgentRouter;
}

function insertDelegation(db: AgencyDb, toAgent: string) {
  const id = randomUUID();
  db.insert(delegations).values({
    id, fromAgent: "director", toAgent, status: "requested",
    payloadJson: { task: "Write a blog post about AI" } as never,
  }).run();
  return id;
}

describe("updateTaskInDb", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tasks-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("updates title and increments version", () => {
    const delegationId = insertDelegation(db, "copywriter");
    const taskId = randomUUID();
    db.insert(tasks).values({ id: taskId, delegationId, title: "Old title", status: "open", assignedTo: "copywriter" }).run();

    const result = updateTaskInDb(db, taskId, { title: "New title" }, 1);
    expect(result.title).toBe("New title");
    expect(result.version).toBe(2);
  });

  it("throws ConflictError on version mismatch", () => {
    const delegationId = insertDelegation(db, "copywriter");
    const taskId = randomUUID();
    db.insert(tasks).values({ id: taskId, delegationId, title: "T", status: "open", assignedTo: "copywriter" }).run();

    expect(() => updateTaskInDb(db, taskId, { title: "X" }, 99)).toThrow(ConflictError);
  });
});

describe("TaskManager", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;
  let broker: Broker;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tasks-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    broker = new Broker(db);
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("auto-creates a task on delegation_created event", () => {
    const router = makeRouter();
    const manager = new TaskManager(db, broker, router);
    manager.boot();

    const delegationId = insertDelegation(db, "copywriter");
    broker.emit("delegation_created", { delegationId, from: "director", to: "copywriter" });

    const rows = db.select().from(tasks).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].assignedTo).toBe("copywriter");
    expect(rows[0].title).toBe("Write a blog post about AI");
    expect(rows[0].status).toBe("in_progress");
  });

  it("truncates task title to 300 chars", () => {
    const router = makeRouter();
    const manager = new TaskManager(db, broker, router);
    manager.boot();

    const delegationId = randomUUID();
    db.insert(delegations).values({
      id: delegationId, fromAgent: "director", toAgent: "copywriter", status: "requested",
      payloadJson: { task: "A".repeat(100) } as never,
    }).run();
    broker.emit("delegation_created", { delegationId, from: "director", to: "copywriter" });

    const row = db.select().from(tasks).all()[0];
    expect(row.title.length).toBe(300);
  });

  it("notifies warm agent immediately on task_updated", () => {
    const router = makeRouter(["content-lead"]);
    const manager = new TaskManager(db, broker, router);
    manager.boot();

    const delegationId = insertDelegation(db, "content-lead");
    const taskId = randomUUID();
    db.insert(tasks).values({ id: taskId, delegationId, title: "T", status: "open", assignedTo: "content-lead" }).run();

    broker.emit("task_updated", { taskId, patch: { status: "in_progress" }, updatedBy: "human" });

    expect(router.promptWarmAgent).toHaveBeenCalledWith(
      "content-lead",
      expect.stringContaining("Task updated"),
    );
  });

  it("saves pending update + notifies lead for transient specialist", () => {
    const router = makeRouter(["content-lead", "distribution-lead", "insights-lead", "director", "eval-judge"]);
    const manager = new TaskManager(db, broker, router);
    manager.boot();

    const delegationId = insertDelegation(db, "copywriter");
    const taskId = randomUUID();
    db.insert(tasks).values({ id: taskId, delegationId, title: "T", status: "open", assignedTo: "copywriter" }).run();

    broker.emit("task_updated", { taskId, patch: { status: "blocked" }, updatedBy: "human" });

    // Lead is notified immediately
    expect(router.promptWarmAgent).toHaveBeenCalledWith(
      "content-lead",
      expect.stringContaining("specialist is currently working on it"),
    );
    // Pending update saved for specialist
    const pending = db.select().from(taskPendingUpdates).all();
    expect(pending).toHaveLength(1);
    expect(pending[0].deliveredAt).toBeNull();
  });

  it("copies campaignId from delegation to task", () => {
    const router = makeRouter();
    const manager = new TaskManager(db, broker, router);
    manager.boot();

    const campaignId = randomUUID();
    db.insert(campaigns).values({ id: campaignId, title: "Test", status: "active" }).run();
    const delegationId = randomUUID();
    db.insert(delegations).values({
      id: delegationId, fromAgent: "director", toAgent: "copywriter",
      status: "requested", payloadJson: { task: "Write post" }, campaignId,
    }).run();

    broker.emit("delegation_created", { delegationId, from: "director", to: "copywriter" });

    const task = db.select().from(tasks).all().find(t => t.delegationId === delegationId)!;
    expect(task.campaignId).toBe(campaignId);
  });
});
