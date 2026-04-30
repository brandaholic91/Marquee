# Marquee v0.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task management with status-based kanban, nightly daily summary cron, agent configuration UI, and two smaller Memory/Deliverable UI gaps to Marquee.

**Architecture:** A new `TaskManager` service subscribes to broker events — it auto-creates a `tasks` row on every `delegation_created` event and handles A/B agent notifications on `task_updated`. The update_task tool and REST API both call a shared `updateTaskInDb()` helper that enforces optimistic locking. The five features are independently additive and share one DB migration.

**Tech Stack:** Node.js 22, TypeScript, SQLite/Drizzle ORM, Fastify 5, React 19, Zustand, dnd-kit (already installed), gray-matter (already installed), node-cron (add to server), diff + @types/diff (add to web).

---

## File Map

**New server files**
- `packages/server/src/tasks/manager.ts` — `updateTaskInDb`, `ConflictError`, `TaskManager` class
- `packages/server/src/tasks/manager.test.ts`
- `packages/server/src/tools/tasks.ts` — `update_task` AgentToolDef
- `packages/server/src/tools/tasks.test.ts`
- `packages/server/src/server/routes/tasks.ts` — `GET /api/tasks`, `PATCH /api/tasks/:id`
- `packages/server/src/server/routes/tasks.test.ts`
- `packages/server/src/agents/config.ts` — `loadAgentConfig`, `buildBehaviorBlock`
- `packages/server/src/agents/config.test.ts`
- `packages/server/src/server/routes/agents.ts` — `GET/PUT /api/agents/:role/config`
- `packages/server/src/cron/daily-summary.ts` — `runDailySummary`, `buildDailySummaryMd`
- `packages/server/src/cron/daily-summary.test.ts`

**New web files**
- `packages/web/src/views/tasks.tsx` — Tasks kanban view
- `packages/web/src/views/agents.tsx` — Agent config view

**Modified files**
- `packages/server/src/db/schema.ts` — add `tasks`, `taskPendingUpdates` tables
- `packages/server/src/db/schema.test.ts` — verify new table exports
- `packages/server/src/broker/router.ts` — add `promptWarmAgent`, `restartWarmAgent`, pending updates in `spawnAndPrompt`
- `packages/server/src/broker/router.test.ts` — tests for new methods
- `packages/server/src/tools/registry.ts` — add `updateTask` to 4 roles
- `packages/server/src/agents/factory.ts` — append behavior block to `buildSystemPrompt`
- `packages/server/src/agents/transform-context.ts` — daily notes in `RELEVANT_MEMORY_FOR_ROLE`, resolve daily note paths
- `packages/server/src/server/index.ts` — register tasks + agents routes
- `packages/server/src/server/routes/deliverables.ts` — add revision content endpoint
- `packages/server/src/server/routes/memory.ts` — add `POST /api/memory` (create new file)
- `packages/server/src/index.ts` — `TaskManager` instantiation, `node-cron` schedule
- `packages/server/package.json` — add `node-cron`, `@types/node-cron`
- `packages/web/package.json` — add `diff`, `@types/diff`
- `packages/web/src/App.tsx` — add tasks + agents view branches
- `packages/web/src/store/useAgencyStore.ts` — add tasks state, expand view type union
- `packages/web/src/components/layout/Sidebar.tsx` — add tasks + agents nav items
- `packages/web/src/lib/api.ts` — add tasks + agents API helpers

---

### Task 1: DB Schema — tasks + taskPendingUpdates

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/db/schema.test.ts`

- [ ] **Step 1: Add failing test for new table exports**

Open `packages/server/src/db/schema.test.ts`. Add inside the existing `describe("schema")` block:

```typescript
it("exports tasks and taskPendingUpdates tables", () => {
  expect(Object.keys(schema)).toContain("tasks");
  expect(Object.keys(schema)).toContain("taskPendingUpdates");
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/server && npx vitest run src/db/schema.test.ts
```

Expected: FAIL — `tasks` is not in schema exports.

- [ ] **Step 3: Add tables to schema.ts**

In `packages/server/src/db/schema.ts`, after the `memoryProposals` table, add:

```typescript
export const tasks = sqliteTable(
  "tasks",
  {
    id:            text("id").primaryKey(),
    delegationId:  text("delegation_id").notNull().references(() => delegations.id),
    title:         text("title").notNull(),
    descriptionMd: text("description_md").notNull().default(""),
    status:        text("status", { enum: ["open", "in_progress", "done", "blocked"] }).notNull(),
    assignedTo:    text("assigned_to").notNull(),
    version:       integer("version").notNull().default(1),
    createdAt:     ts("created_at"),
    updatedAt:     ts("updated_at"),
  },
  (t) => ({
    assignedStatusIdx: index("tasks_assigned_status_idx").on(t.assignedTo, t.status),
  }),
);

export const taskPendingUpdates = sqliteTable("task_pending_updates", {
  id:          text("id").primaryKey(),
  taskId:      text("task_id").notNull().references(() => tasks.id),
  message:     text("message").notNull(),
  deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  createdAt:   ts("created_at"),
});
```

- [ ] **Step 4: Generate migration**

```bash
cd packages/server && npx drizzle-kit generate
```

Expected: a new SQL file created in `drizzle/` (e.g. `0001_add_tasks.sql`). The migration is applied automatically the next time `openDb()` is called (including in tests).

- [ ] **Step 5: Run tests**

```bash
cd packages/server && npx vitest run src/db/schema.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/db/schema.test.ts packages/server/drizzle/
git commit -m "feat(db): add tasks and taskPendingUpdates tables"
```

---

### Task 2: TaskManager service

**Files:**
- Create: `packages/server/src/tasks/manager.ts`
- Create: `packages/server/src/tasks/manager.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/tasks/manager.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { delegations, tasks, taskPendingUpdates } from "../db/schema.js";
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
    expect(rows[0].status).toBe("open");
  });

  it("truncates task title to 80 chars", () => {
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
    expect(row.title.length).toBe(80);
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
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/tasks/manager.test.ts
```

Expected: FAIL — `Cannot find module ./manager.js`.

- [ ] **Step 3: Implement manager.ts**

Create `packages/server/src/tasks/manager.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { delegations, tasks, taskPendingUpdates } from "../db/schema.js";
import type { Broker, PersistedEvent } from "../broker/event-bus.js";
import type { AgentRouter } from "../broker/router.js";

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export type Task = typeof tasks.$inferSelect;

export function updateTaskInDb(
  db: AgencyDb,
  taskId: string,
  patch: { title?: string; descriptionMd?: string; status?: "open" | "in_progress" | "done" | "blocked" },
  currentVersion: number,
): Task {
  const setPatch: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  // Drizzle doesn't support sql`` in .set() type-safely, cast as never
  const result = db
    .update(tasks)
    .set({ ...setPatch, version: sql`version + 1` } as never)
    .where(and(eq(tasks.id, taskId), eq(tasks.version, currentVersion)))
    .returning()
    .get();
  if (!result) throw new ConflictError(`Version mismatch for task ${taskId}`);
  return result;
}

const SPECIALIST_TO_LEAD: Record<string, string> = {
  copywriter:        "content-lead",
  "social-manager":  "distribution-lead",
  "seo-analyst":     "insights-lead",
};

export class TaskManager {
  constructor(
    private db: AgencyDb,
    private broker: Broker,
    private router: AgentRouter,
  ) {}

  boot(): void {
    this.broker.subscribe((evt: PersistedEvent) => {
      if (evt.type === "delegation_created") this.onDelegationCreated(evt);
      if (evt.type === "task_updated") this.onTaskUpdated(evt);
    });
  }

  private onDelegationCreated(evt: PersistedEvent): void {
    const { delegationId } = evt.payload as { delegationId: string };
    const delegation = this.db.select().from(delegations)
      .where(eq(delegations.id, delegationId)).get();
    if (!delegation) return;
    const payload = delegation.payloadJson as { task?: string };
    const title = (payload.task ?? "Untitled task").slice(0, 80);
    this.db.insert(tasks).values({
      id: randomUUID(), delegationId, title,
      status: "open", assignedTo: delegation.toAgent,
    }).run();
    this.broker.emit("task_created", { delegationId, assignedTo: delegation.toAgent });
  }

  private onTaskUpdated(evt: PersistedEvent): void {
    const { taskId, updatedBy } = evt.payload as { taskId: string; updatedBy: string };
    const task = this.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task) return;
    this.notifyAgents(task, updatedBy);
  }

  private notifyAgents(task: Task, updatedBy: string): void {
    const msg = `Task updated (by ${updatedBy}): "${task.title}" is now ${task.status}`;
    const warmRoles = this.router.getWarmRoles();

    if (warmRoles.includes(task.assignedTo)) {
      this.router.promptWarmAgent(task.assignedTo, msg);
    } else {
      const lead = SPECIALIST_TO_LEAD[task.assignedTo];
      if (lead) {
        this.router.promptWarmAgent(lead, `${msg} — specialist is currently working on it.`);
      }
      this.db.insert(taskPendingUpdates).values({
        id: randomUUID(), taskId: task.id, message: msg,
      }).run();
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/tasks/manager.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/tasks/
git commit -m "feat(tasks): add TaskManager service with auto-creation and A/B notifications"
```

---

### Task 3: AgentRouter extensions

**Files:**
- Modify: `packages/server/src/broker/router.ts`
- Modify: `packages/server/src/broker/router.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/server/src/broker/router.test.ts`, inside the existing `describe("AgentRouter")` block:

```typescript
it("promptWarmAgent does not throw when role exists", () => {
  router.boot();
  expect(() => router.promptWarmAgent("director", "hello")).not.toThrow();
});

it("promptWarmAgent does not throw when role does not exist", () => {
  router.boot();
  expect(() => router.promptWarmAgent("nonexistent-role", "hello")).not.toThrow();
});

it("restartWarmAgent replaces the warm agent session", () => {
  router.boot();
  const roles1 = router.getWarmRoles();
  router.restartWarmAgent("director");
  const roles2 = router.getWarmRoles();
  expect(roles1).toContain("director");
  expect(roles2).toContain("director");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/broker/router.test.ts
```

Expected: FAIL — `promptWarmAgent is not a function`.

- [ ] **Step 3: Add promptWarmAgent and restartWarmAgent to router.ts**

In `packages/server/src/broker/router.ts`, add these two public methods after `queueBrief()`:

```typescript
promptWarmAgent(role: string, message: string): void {
  const agent = this.warmAgents.get(role);
  if (!agent) return;
  void (async () => {
    await agent.waitForIdle();
    agent.prompt(message).catch(console.error);
  })();
}

restartWarmAgent(role: string): void {
  const oldSessionId = this.warmSessionIds.get(role);
  if (oldSessionId) {
    this.db.update(agentSessions)
      .set({ endedAt: new Date() })
      .where(eq(agentSessions.id, oldSessionId))
      .run();
  }
  const sessionId = randomUUID();
  const agent = makeAgent({
    role, dataDir: this.dataDir, db: this.db, sessionId,
    emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
  } satisfies MakeAgentOpts);
  this.warmAgents.set(role, agent);
  this.warmSessionIds.set(role, sessionId);
  this.db.insert(agentSessions).values({
    id: sessionId, agentSlug: role, lifecycle: "warm",
  }).run();
}
```

- [ ] **Step 4: Add pending updates delivery to spawnAndPrompt**

Add imports at the top of `router.ts`:

```typescript
import { and, eq, isNull } from "drizzle-orm";
import { tasks, taskPendingUpdates } from "../db/schema.js";
```

Replace the existing `private spawnAndPrompt(...)` method body — add the pending update lookup before `agent.prompt()`:

```typescript
private spawnAndPrompt(role: string, delegationId: string, userMessage: string): void {
  // Fetch any undelivered task updates for this delegation
  const task = this.db.select().from(tasks).where(eq(tasks.delegationId, delegationId)).get();
  let fullMessage = userMessage;
  if (task) {
    const pending = this.db.select().from(taskPendingUpdates)
      .where(and(eq(taskPendingUpdates.taskId, task.id), isNull(taskPendingUpdates.deliveredAt)))
      .all();
    if (pending.length > 0) {
      const updates = pending.map((p) => p.message).join("\n");
      fullMessage = `${userMessage}\n\n---\nTask updates while you were working:\n${updates}\nPlease revise your output to reflect these changes before submitting.`;
      for (const p of pending) {
        this.db.update(taskPendingUpdates)
          .set({ deliveredAt: new Date() })
          .where(eq(taskPendingUpdates.id, p.id))
          .run();
      }
    }
  }

  const sessionId = randomUUID();
  const agent = makeAgent({
    role, dataDir: this.dataDir, db: this.db, sessionId, delegationId,
    emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
  } satisfies MakeAgentOpts);
  this.db.insert(agentSessions).values({
    id: sessionId, agentSlug: role, lifecycle: "transient", parentDelegationId: delegationId,
  }).run();
  agent.subscribe((evt) => {
    if (evt.type === "agent_end") {
      const last = agent.state.messages.at(-1);
      if (last?.role === "assistant" && last.errorMessage) {
        console.error(`[${role}] agent error:`, last.errorMessage);
      }
    }
  });
  agent.prompt(fullMessage).catch(console.error);
}
```

- [ ] **Step 5: Run tests**

```bash
cd packages/server && npx vitest run src/broker/router.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/broker/router.ts packages/server/src/broker/router.test.ts
git commit -m "feat(broker): add promptWarmAgent, restartWarmAgent, pending task update delivery"
```

---

### Task 4: update_task tool + registry

**Files:**
- Create: `packages/server/src/tools/tasks.ts`
- Create: `packages/server/src/tools/tasks.test.ts`
- Modify: `packages/server/src/tools/registry.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/tools/tasks.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { delegations, tasks } from "../db/schema.js";
import { updateTask } from "./tasks.js";
import { ConflictError } from "../tasks/manager.js";
import type { ToolContext } from "./types.js";

function makeCtx(db: AgencyDb): ToolContext {
  return {
    db,
    agentSlug: "director",
    agentSessionId: randomUUID(),
    emit: vi.fn(),
  };
}

describe("update_task tool", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tools-tasks-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  function insertTask(status = "open" as const) {
    const delegationId = randomUUID();
    db.insert(delegations).values({
      id: delegationId, fromAgent: "director", toAgent: "copywriter",
      status: "requested", payloadJson: { task: "x" } as never,
    }).run();
    const taskId = randomUUID();
    db.insert(tasks).values({ id: taskId, delegationId, title: "My task", status, assignedTo: "copywriter" }).run();
    return taskId;
  }

  it("returns ok with new version on success", async () => {
    const taskId = insertTask();
    const result = await updateTask.execute(
      { task_id: taskId, current_version: 1, status: "in_progress" },
      makeCtx(db),
    );
    expect(result.ok).toBe(true);
    expect(result.newVersion).toBe(2);
  });

  it("emits task_updated event", async () => {
    const taskId = insertTask();
    const emit = vi.fn();
    await updateTask.execute(
      { task_id: taskId, current_version: 1, title: "New title" },
      { ...makeCtx(db), emit },
    );
    expect(emit).toHaveBeenCalledWith("task_updated", expect.objectContaining({ taskId, updatedBy: "director" }));
  });

  it("throws ConflictError on stale version", async () => {
    const taskId = insertTask();
    await expect(
      updateTask.execute({ task_id: taskId, current_version: 99 }, makeCtx(db)),
    ).rejects.toThrow(ConflictError);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/tools/tasks.test.ts
```

Expected: FAIL — `Cannot find module ./tasks.js`.

- [ ] **Step 3: Create tools/tasks.ts**

```typescript
import { z } from "zod";
import { updateTaskInDb, ConflictError } from "../tasks/manager.js";
import type { AgentToolDef, ToolContext } from "./types.js";

export { ConflictError };

const updateTaskInput = z.object({
  task_id:         z.string(),
  current_version: z.number().int(),
  title:           z.string().optional(),
  description_md:  z.string().optional(),
  status:          z.enum(["open", "in_progress", "done", "blocked"]).optional(),
});

export const updateTask: AgentToolDef<
  z.infer<typeof updateTaskInput>,
  { ok: true; taskId: string; newVersion: number }
> = {
  name: "update_task",
  description: "Update a task's title, description, or status. Supply current_version to prevent conflicts.",
  schema: {
    type: "object",
    properties: {
      task_id:         { type: "string" },
      current_version: { type: "integer" },
      title:           { type: "string" },
      description_md:  { type: "string" },
      status:          { type: "string", enum: ["open", "in_progress", "done", "blocked"] },
    },
    required: ["task_id", "current_version"],
  },
  input: updateTaskInput,
  async execute(input, ctx: ToolContext) {
    const patch: { title?: string; descriptionMd?: string; status?: "open" | "in_progress" | "done" | "blocked" } = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description_md !== undefined) patch.descriptionMd = input.description_md;
    if (input.status !== undefined) patch.status = input.status;

    const updated = updateTaskInDb(ctx.db, input.task_id, patch, input.current_version);
    ctx.emit("task_updated", { taskId: updated.id, patch, updatedBy: ctx.agentSlug });
    return { ok: true, taskId: updated.id, newVersion: updated.version };
  },
};
```

- [ ] **Step 4: Update registry.ts to include updateTask for 4 roles**

In `packages/server/src/tools/registry.ts`, add import:

```typescript
import { updateTask } from "./tasks.js";
```

Add `updateTask` to the `director`, `content-lead`, `distribution-lead`, and `insights-lead` cases:

```typescript
case "director":
  return [delegateToLead, proposeBrief, proposeMemoryUpdate, readMemory, webFetch, requestInput, updateTask] as never;
case "content-lead":
  return [delegateToSpecialist, submitToDirector, readMemory, requestInput, updateTask] as never;
case "distribution-lead":
  return [delegateToSpecialist, submitToDirector, readMemory, requestInput, updateTask] as never;
case "insights-lead":
  return [delegateToSpecialist, submitToDirector, readMemory, requestInput, updateTask] as never;
```

- [ ] **Step 5: Run tests**

```bash
cd packages/server && npx vitest run src/tools/tasks.test.ts src/tools/registry.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/tools/tasks.ts packages/server/src/tools/tasks.test.ts packages/server/src/tools/registry.ts
git commit -m "feat(tools): add update_task tool with optimistic locking"
```

---

### Task 5: Tasks REST API + wiring

**Files:**
- Create: `packages/server/src/server/routes/tasks.ts`
- Create: `packages/server/src/server/routes/tasks.test.ts`
- Modify: `packages/server/src/server/index.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/server/routes/tasks.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/server/routes/tasks.test.ts
```

Expected: FAIL — route file not found / taskManager not wired.

- [ ] **Step 3: Create routes/tasks.ts**

```typescript
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { tasks } from "../../db/schema.js";
import { updateTaskInDb, ConflictError } from "../../tasks/manager.js";

export function registerTaskRoutes(app: FastifyInstance, opts: ServerOpts) {
  app.get<{ Querystring: { assigned_to?: string; status?: string } }>("/api/tasks", async (req) => {
    let result = opts.db.select().from(tasks).all();
    if (req.query.assigned_to) result = result.filter((t) => t.assignedTo === req.query.assigned_to);
    if (req.query.status) result = result.filter((t) => t.status === req.query.status);
    return result;
  });

  app.patch<{
    Params: { id: string };
    Body: { title?: string; description_md?: string; status?: string; current_version: number };
  }>("/api/tasks/:id", async (req, reply) => {
    const { current_version, title, description_md, status } = req.body;
    const patch: { title?: string; descriptionMd?: string; status?: "open" | "in_progress" | "done" | "blocked" } = {};
    if (title !== undefined) patch.title = title;
    if (description_md !== undefined) patch.descriptionMd = description_md;
    if (status !== undefined) patch.status = status as never;
    try {
      const updated = updateTaskInDb(opts.db, req.params.id, patch, current_version);
      opts.broker.emit("task_updated", { taskId: updated.id, patch, updatedBy: "human" });
      return { ok: true, taskId: updated.id, newVersion: updated.version };
    } catch (e) {
      if (e instanceof ConflictError) return reply.code(409).send({ error: e.message });
      throw e;
    }
  });
}
```

- [ ] **Step 4: Register routes in server/index.ts**

In `packages/server/src/server/index.ts`, add import and registration:

```typescript
import { registerTaskRoutes } from "./routes/tasks.js";
// in buildServer():
registerTaskRoutes(app, opts);
```

- [ ] **Step 5: Instantiate TaskManager in src/index.ts**

In `packages/server/src/index.ts`, add import and instantiation before `router.boot()`:

```typescript
import { TaskManager } from "./tasks/manager.js";

// inside main(), after broker and router are created, BEFORE router.boot():
const taskManager = new TaskManager(db, broker, router);
taskManager.boot();
router.boot();
```

- [ ] **Step 6: Run all server tests**

```bash
cd packages/server && npm test
```

Expected: PASS — all existing tests plus new tasks route tests green.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/server/routes/tasks.ts packages/server/src/server/routes/tasks.test.ts packages/server/src/server/index.ts packages/server/src/index.ts
git commit -m "feat(api): add tasks REST routes and wire TaskManager into server startup"
```

---

### Task 6: Agent config backend

**Files:**
- Create: `packages/server/src/agents/config.ts`
- Create: `packages/server/src/agents/config.test.ts`
- Create: `packages/server/src/server/routes/agents.ts`
- Modify: `packages/server/src/agents/factory.ts`
- Modify: `packages/server/src/server/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/agents/config.test.ts`:

```typescript
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAgentConfig, buildBehaviorBlock } from "./config.js";

describe("loadAgentConfig", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "config-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns null when config file does not exist", () => {
    expect(loadAgentConfig(dir, "director")).toBeNull();
  });

  it("parses frontmatter from config.md", () => {
    mkdirSync(join(dir, "agents", "director"), { recursive: true });
    writeFileSync(join(dir, "agents", "director", "config.md"),
      "---\nlanguage: hu\ntone: authoritative\n---\n");
    const config = loadAgentConfig(dir, "director");
    expect(config?.language).toBe("hu");
    expect(config?.tone).toBe("authoritative");
  });
});

describe("buildBehaviorBlock", () => {
  it("returns empty string for empty config", () => {
    expect(buildBehaviorBlock({})).toBe("");
  });

  it("includes all structured fields", () => {
    const block = buildBehaviorBlock({ style: "terse", tone: "authoritative", language: "hu" });
    expect(block).toContain("Style: terse");
    expect(block).toContain("Tone: authoritative");
    expect(block).toContain("Language: hu");
  });

  it("appends system_prompt_override after structured fields", () => {
    const block = buildBehaviorBlock({ language: "hu", system_prompt_override: "Always be concise." });
    expect(block).toContain("Language: hu");
    expect(block).toContain("Always be concise.");
  });

  it("returns just override text when no structured fields", () => {
    const block = buildBehaviorBlock({ system_prompt_override: "Custom instruction." });
    expect(block).toContain("Custom instruction.");
    expect(block).not.toContain("## Behavior");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/agents/config.test.ts
```

Expected: FAIL — `Cannot find module ./config.js`.

- [ ] **Step 3: Create agents/config.ts**

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export interface AgentConfig {
  style?: "terse" | "verbose" | "balanced";
  tone?: "authoritative" | "friendly" | "neutral";
  response_length?: "concise" | "detailed";
  language?: string;
  system_prompt_override?: string;
}

export function loadAgentConfig(dataDir: string, role: string): AgentConfig | null {
  const path = join(dataDir, "agents", role, "config.md");
  if (!existsSync(path)) return null;
  const parsed = matter(readFileSync(path, "utf8"));
  return parsed.data as AgentConfig;
}

export function buildBehaviorBlock(config: AgentConfig): string {
  const lines = [
    config.style && `Style: ${config.style}`,
    config.tone && `Tone: ${config.tone}`,
    config.response_length && `Response length: ${config.response_length}`,
    config.language && `Language: ${config.language}`,
  ].filter(Boolean) as string[];

  const structured = lines.length > 0 ? `## Behavior\n${lines.join(" | ")}\n` : "";
  const override = config.system_prompt_override
    ? `\n${config.system_prompt_override.trim()}\n`
    : "";
  return structured + override;
}
```

- [ ] **Step 4: Run config tests**

```bash
cd packages/server && npx vitest run src/agents/config.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Append behavior block in factory.ts**

In `packages/server/src/agents/factory.ts`, add import:

```typescript
import { loadAgentConfig, buildBehaviorBlock } from "./config.js";
```

In `buildSystemPrompt`, append behavior block at the end:

```typescript
const buildSystemPrompt = (role: string, dataDir: string): string => {
  const skills = loadSkillsForRole(dataDir, role);
  const ctx: Record<string, unknown> = {};
  for (const file of ["client_profile", "brand_guidelines"]) {
    const path = join(dataDir, "memory", `${file}.md`);
    if (existsSync(path)) {
      ctx[file] = readMemoryFile(dataDir, file).frontmatter;
    }
  }
  const skillBlocks = skills
    .map((s) => `## Skill: ${s.frontmatter.name ?? "(unnamed)"}\n\n${s.render(ctx)}`)
    .join("\n\n");

  const config = loadAgentConfig(dataDir, role);
  const behaviorBlock = config ? buildBehaviorBlock(config) : "";

  return [
    `You are the ${role} agent of the AI marketing agency.`,
    `Use only the tools provided. Do not attempt actions outside your toolset.`,
    `Read memory before making client-specific decisions.`,
    skillBlocks,
    behaviorBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
};
```

- [ ] **Step 6: Create routes/agents.ts**

```typescript
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { loadAgentConfig, buildBehaviorBlock } from "../../agents/config.js";

const VALID_ROLES = new Set([
  "director", "content-lead", "distribution-lead", "insights-lead",
  "copywriter", "social-manager", "seo-analyst", "eval-judge",
]);

export function registerAgentRoutes(app: FastifyInstance, opts: ServerOpts) {
  app.get<{ Params: { role: string } }>("/api/agents/:role/config", async (req, reply) => {
    if (!VALID_ROLES.has(req.params.role)) return reply.code(404).send({ error: "unknown role" });
    const config = loadAgentConfig(opts.dataDir, req.params.role);
    if (!config) return null;
    return { config, behaviorBlock: buildBehaviorBlock(config) };
  });

  app.put<{ Params: { role: string }; Body: Record<string, unknown> }>(
    "/api/agents/:role/config",
    async (req, reply) => {
      if (!VALID_ROLES.has(req.params.role)) return reply.code(404).send({ error: "unknown role" });
      const dir = join(opts.dataDir, "agents", req.params.role);
      mkdirSync(dir, { recursive: true });
      const content = matter.stringify("", req.body);
      writeFileSync(join(dir, "config.md"), content, "utf8");
      const warmRoles = opts.router.getWarmRoles();
      if (warmRoles.includes(req.params.role)) {
        opts.router.restartWarmAgent(req.params.role);
      }
      return { ok: true };
    },
  );
}
```

- [ ] **Step 7: Register agent routes in server/index.ts**

```typescript
import { registerAgentRoutes } from "./routes/agents.js";
// in buildServer():
registerAgentRoutes(app, opts);
```

- [ ] **Step 8: Run all server tests**

```bash
cd packages/server && npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/agents/config.ts packages/server/src/agents/config.test.ts packages/server/src/agents/factory.ts packages/server/src/server/routes/agents.ts packages/server/src/server/index.ts
git commit -m "feat(agents): add config file support with behavior block and agent config API routes"
```

---

### Task 7: Daily cron

**Files:**
- Create: `packages/server/src/cron/daily-summary.ts`
- Create: `packages/server/src/cron/daily-summary.test.ts`
- Modify: `packages/server/src/agents/transform-context.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/package.json`

- [ ] **Step 1: Install node-cron**

```bash
cd packages/server && npm install node-cron && npm install -D @types/node-cron
```

- [ ] **Step 2: Write failing tests**

Create `packages/server/src/cron/daily-summary.test.ts`:

```typescript
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { agentSessions, delegations, deliverables, turns } from "../db/schema.js";
import { randomUUID } from "node:crypto";
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
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/cron/daily-summary.test.ts
```

Expected: FAIL — `Cannot find module ./daily-summary.js`.

- [ ] **Step 4: Create cron/daily-summary.ts**

```typescript
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, delegations, deliverables, evals, turns } from "../db/schema.js";

interface SessionStat { agentSlug: string; count: number; turns: number }
interface SummaryInput {
  today: string;
  sessions: SessionStat[];
  delegations: Array<{ fromAgent: string; toAgent: string; status: string; task: string }>;
  deliverables: Array<{ title: string; status: string; evalScore?: number }>;
  evals: Array<{ brand_voice?: number; factual_accuracy?: number; usp_usage?: number }>;
}

export function buildDailySummaryMd(input: SummaryInput): string {
  const lines: string[] = [`# Daily Summary — ${input.today}`, ""];

  lines.push(`## Sessions (${input.sessions.length})`);
  if (input.sessions.length === 0) {
    lines.push("- none");
  } else {
    for (const s of input.sessions) {
      lines.push(`- ${s.agentSlug}: ${s.count} session(s), ${s.turns} turns`);
    }
  }
  lines.push("");

  lines.push(`## Delegations (${input.delegations.length})`);
  if (input.delegations.length === 0) {
    lines.push("- none");
  } else {
    for (const d of input.delegations) {
      lines.push(`- ${d.fromAgent} → ${d.toAgent}: ${d.task.slice(0, 60)} (${d.status})`);
    }
  }
  lines.push("");

  lines.push(`## Deliverables (${input.deliverables.length})`);
  if (input.deliverables.length === 0) {
    lines.push("- none");
  } else {
    for (const d of input.deliverables) {
      const score = d.evalScore != null ? ` (eval: ${d.evalScore}/10)` : "";
      lines.push(`- "${d.title}" — ${d.status}${score}`);
    }
  }
  lines.push("");

  if (input.evals.length > 0) {
    lines.push("## Eval scores (latest)");
    const last = input.evals[input.evals.length - 1];
    lines.push(`- brand_voice: ${last.brand_voice ?? "n/a"}, factual_accuracy: ${last.factual_accuracy ?? "n/a"}, usp_usage: ${last.usp_usage ?? "n/a"}`);
    lines.push("");
  }

  return lines.join("\n");
}

export async function runDailySummary(db: AgencyDb, dataDir: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Sessions: group by agentSlug for today
  const rawSessions = db.select().from(agentSessions).all()
    .filter((s) => s.startedAt && s.startedAt.toISOString().slice(0, 10) === today);

  const sessionMap = new Map<string, { count: number; turns: number }>();
  for (const s of rawSessions) {
    const entry = sessionMap.get(s.agentSlug) ?? { count: 0, turns: 0 };
    entry.count += 1;
    const sessionTurns = db.select().from(turns).all()
      .filter((t) => t.sessionId === s.id);
    entry.turns += sessionTurns.length;
    sessionMap.set(s.agentSlug, entry);
  }
  const sessions: SessionStat[] = [...sessionMap.entries()]
    .map(([agentSlug, v]) => ({ agentSlug, ...v }));

  // Delegations today
  const rawDelegations = db.select().from(delegations).all()
    .filter((d) => d.requestedAt && d.requestedAt.toISOString().slice(0, 10) === today);
  const delegationStats = rawDelegations.map((d) => ({
    fromAgent: d.fromAgent, toAgent: d.toAgent, status: d.status,
    task: ((d.payloadJson as { task?: string }).task ?? "").slice(0, 60),
  }));

  // Deliverables updated today
  const rawDeliverables = db.select().from(deliverables).all()
    .filter((d) => d.updatedAt && d.updatedAt.toISOString().slice(0, 10) === today);
  const deliverableStats = rawDeliverables.map((d) => ({ title: d.title, status: d.status }));

  // Evals created today
  const rawEvals = db.select().from(evals).all()
    .filter((e) => e.createdAt && e.createdAt.toISOString().slice(0, 10) === today);
  const evalStats = rawEvals.map((e) => e.scoresJson as { brand_voice?: number; factual_accuracy?: number; usp_usage?: number });

  const md = buildDailySummaryMd({
    today, sessions, delegations: delegationStats, deliverables: deliverableStats, evals: evalStats,
  });

  const dir = join(dataDir, "memory", "daily_notes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${today}.md`), md, "utf8");
}
```

- [ ] **Step 5: Update transform-context.ts for daily notes**

In `packages/server/src/agents/transform-context.ts`, update `RELEVANT_MEMORY_FOR_ROLE` and `memoryBlock`:

```typescript
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readMemoryFile } from "../memory/read.js";
import type { AgencyMessage, StandardMessage } from "./messages.js";
import { convertToLlm } from "./convert-to-llm.js";

export interface TransformContextOptions {
  dataDir: string;
  role: string;
  keepRecent?: number;
}

const RELEVANT_MEMORY_FOR_ROLE: Record<string, string[]> = {
  director: ["client_profile", "brand_guidelines", "ongoing_campaigns",
             "daily_notes/YESTERDAY", "daily_notes/2_DAYS_AGO", "daily_notes/3_DAYS_AGO"],
  "content-lead": ["client_profile", "brand_guidelines", "content_history"],
  copywriter: ["client_profile", "brand_guidelines", "content_history"],
  "eval-judge": ["client_profile", "brand_guidelines"],
};

function resolveName(name: string, today: Date): string {
  if (name.startsWith("daily_notes/")) {
    const label = name.slice("daily_notes/".length);
    const d = new Date(today);
    if (label === "YESTERDAY") d.setDate(d.getDate() - 1);
    else if (label === "2_DAYS_AGO") d.setDate(d.getDate() - 2);
    else if (label === "3_DAYS_AGO") d.setDate(d.getDate() - 3);
    return `daily_notes/${d.toISOString().slice(0, 10)}`;
  }
  return name;
}

const memoryBlock = (dataDir: string, role: string): StandardMessage => {
  const memDir = join(dataDir, "memory");
  if (!existsSync(memDir)) return { role: "user", content: "<memory/>" };
  const want = RELEVANT_MEMORY_FOR_ROLE[role] ?? ["client_profile", "brand_guidelines"];
  const today = new Date();
  const blocks = want
    .map((n) => resolveName(n, today))
    .filter((resolved) => existsSync(join(memDir, `${resolved}.md`)))
    .map((resolved) => {
      const filePath = join(memDir, `${resolved}.md`);
      if (resolved.startsWith("daily_notes/")) {
        const content = readFileSync(filePath, "utf8");
        return `<memory file="${resolved}.md">\n<body>${content.trim()}</body>\n</memory>`;
      }
      const name = resolved;
      const m = readMemoryFile(dataDir, name);
      const fm = JSON.stringify(m.frontmatter, null, 2);
      return `<memory file="${name}.md">\n<frontmatter>${fm}</frontmatter>\n<body>${m.body.trim()}</body>\n</memory>`;
    });
  return { role: "user", content: `<memory_block>\n${blocks.join("\n")}\n</memory_block>` };
};

const summarize = (toCompact: StandardMessage[]): StandardMessage => ({
  role: "user",
  content: `[earlier turns summarized: ${toCompact.length} messages omitted]`,
});

export function makeTransformContext(opts: TransformContextOptions) {
  const keepRecent = opts.keepRecent ?? 50;
  return async (messages: AgencyMessage[]): Promise<StandardMessage[]> => {
    const llmMessages = convertToLlm(messages);
    const head = memoryBlock(opts.dataDir, opts.role);
    if (llmMessages.length <= keepRecent) return [head, ...llmMessages];
    const old = llmMessages.slice(0, llmMessages.length - keepRecent);
    const recent = llmMessages.slice(llmMessages.length - keepRecent);
    return [head, summarize(old), ...recent];
  };
}
```

- [ ] **Step 6: Register cron in src/index.ts**

```typescript
import { schedule } from "node-cron";
import { runDailySummary } from "./cron/daily-summary.js";

// inside main(), after server starts:
schedule("0 2 * * *", () => runDailySummary(db, dataDir).catch(console.error));
```

- [ ] **Step 7: Run all server tests**

```bash
cd packages/server && npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/cron/ packages/server/src/agents/transform-context.ts packages/server/src/index.ts packages/server/package.json packages/server/package-lock.json
git commit -m "feat(cron): add daily summary cron job and daily notes memory for Director"
```

---

### Task 8: Smaller gaps — server side

**Files:**
- Modify: `packages/server/src/server/routes/memory.ts`
- Modify: `packages/server/src/server/routes/deliverables.ts`
- Modify: `packages/server/src/server/routes/memory.test.ts`

- [ ] **Step 1: Write failing test for POST /api/memory**

In `packages/server/src/server/routes/memory.test.ts`, add a new describe block:

```typescript
describe("POST /api/memory (create new file)", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "memory-new-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    mkdirSync(join(dir, "memory"), { recursive: true });
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("creates a new memory file with starter frontmatter", async () => {
    const app = await buildServer({ db, broker: new Broker(db), router: {} as never, dataDir: dir, webRoot: "/nonexistent" });
    const res = await app.inject({
      method: "POST", url: "/api/memory",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: "new_client.md" }),
    });
    expect(res.statusCode).toBe(201);
    expect(existsSync(join(dir, "memory", "new_client.md"))).toBe(true);
  });

  it("rejects filename with path traversal", async () => {
    const app = await buildServer({ db, broker: new Broker(db), router: {} as never, dataDir: dir, webRoot: "/nonexistent" });
    const res = await app.inject({
      method: "POST", url: "/api/memory",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: "../evil.md" }),
    });
    expect(res.statusCode).toBe(400);
  });
});
```

The test file needs these imports at the top (check what's already there and add missing ones):
```typescript
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "../index.js";
import { Broker } from "../../broker/event-bus.js";
import { openDb, type AgencyDb } from "../../db/index.js";
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/server && npx vitest run src/server/routes/memory.test.ts
```

Expected: FAIL — `POST /api/memory` returns 404.

- [ ] **Step 3: Add POST /api/memory to routes/memory.ts**

Add at the end of `registerMemoryRoutes`, before the closing brace:

```typescript
// create new memory file
app.post<{ Body: { filename: string } }>("/api/memory", async (req, reply) => {
  const { filename } = req.body;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return reply.code(400).send({ error: "invalid filename" });
  }
  const name = filename.endsWith(".md") ? filename : `${filename}.md`;
  const dir = memDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, name);
  if (existsSync(filePath)) return reply.code(409).send({ error: "file already exists" });
  const starter = `---\ntitle: ${name.replace(/\.md$/, "")}\n---\n`;
  writeFileSync(filePath, starter, "utf8");
  try {
    const git = simpleGit(opts.dataDir);
    const isRepo = await git.checkIsRepo().catch(() => false);
    if (isRepo) {
      await git.add(filePath);
      await git.commit(`memory: create ${name}`, [filePath]);
    }
  } catch { /* best effort */ }
  opts.broker.emit("memory_created", { file: name });
  return reply.code(201).send({ ok: true, filename: name });
});
```

- [ ] **Step 4: Write failing test for revision content endpoint**

In `packages/server/src/server/routes/deliverables.test.ts`, add:

```typescript
describe("GET /api/deliverables/revisions/:revisionId/content", () => {
  it("returns revision file content", async () => {
    // setup: insert deliverable + revision + write artifact file
    const artifactsDir = join(dir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    const artifactPath = join(artifactsDir, "rev_001.md");
    writeFileSync(artifactPath, "# Hello world", "utf8");

    const deliverableId = randomUUID();
    db.insert(deliverables).values({
      id: deliverableId, delegationId: randomUUID(), type: "blog_post",
      title: "Test", status: "drafting",
    }).run();
    const revId = randomUUID();
    db.insert(deliverableRevisions).values({
      id: revId, deliverableId, artifactPath, createdByAgent: "copywriter",
    }).run();

    const app = await buildTestServer(db, dir);
    const res = await app.inject({ method: "GET", url: `/api/deliverables/revisions/${revId}/content` });
    expect(res.statusCode).toBe(200);
    expect(res.json().content).toContain("Hello world");
  });

  it("returns 404 for unknown revision", async () => {
    const app = await buildTestServer(db, dir);
    const res = await app.inject({ method: "GET", url: "/api/deliverables/revisions/nonexistent/content" });
    expect(res.statusCode).toBe(404);
  });
});
```

The test file needs `import { writeFileSync } from "node:fs"` at the top (check what's already imported).

- [ ] **Step 5: Add revision content endpoint to deliverables.ts**

Add to `registerDeliverableRoutes` in `packages/server/src/server/routes/deliverables.ts`:

```typescript
app.get<{ Params: { revisionId: string } }>(
  "/api/deliverables/revisions/:revisionId/content",
  async (req, reply) => {
    const rev = opts.db
      .select()
      .from(deliverableRevisions)
      .where(eq(deliverableRevisions.id, req.params.revisionId))
      .get();
    if (!rev) return reply.code(404).send({ error: "not found" });
    const content = readFileSync(rev.artifactPath, "utf8");
    return { content };
  },
);
```

- [ ] **Step 6: Run all server tests**

```bash
cd packages/server && npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/server/routes/memory.ts packages/server/src/server/routes/memory.test.ts packages/server/src/server/routes/deliverables.ts packages/server/src/server/routes/deliverables.test.ts
git commit -m "feat(api): add POST /api/memory new file and revision content endpoint"
```

---

### Task 9: Tasks kanban view (frontend)

**Files:**
- Modify: `packages/web/src/store/useAgencyStore.ts`
- Modify: `packages/web/src/components/layout/Sidebar.tsx`
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/App.tsx`
- Create: `packages/web/src/views/tasks.tsx`

- [ ] **Step 1: Extend the store with tasks state and new view types**

Replace `packages/web/src/store/useAgencyStore.ts` with:

```typescript
import { create } from "zustand";

export interface Task {
  id: string;
  delegationId: string;
  title: string;
  descriptionMd: string;
  status: "open" | "in_progress" | "done" | "blocked";
  assignedTo: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface AgencyState {
  activeThreadId: string | null;
  drawerOpen: boolean;
  currentView: "home" | "chat" | "deliverable" | "memory" | "onboarding" | "pipeline" | "tasks" | "agents";
  selectedDeliverableId: string | null;
  selectedMemoryFile: string | null;
  tasks: Task[];
  setActiveThread: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setView: (view: AgencyState["currentView"]) => void;
  setSelectedDeliverable: (id: string | null) => void;
  setSelectedMemoryFile: (file: string | null) => void;
  setTasks: (tasks: Task[]) => void;
  upsertTask: (task: Task) => void;
}

export const useAgencyStore = create<AgencyState>((set) => ({
  activeThreadId: null,
  drawerOpen: false,
  currentView: "home",
  selectedDeliverableId: null,
  selectedMemoryFile: null,
  tasks: [],
  setActiveThread: (id) => set({ activeThreadId: id }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setView: (view) => set({ currentView: view }),
  setSelectedDeliverable: (id) => set({ selectedDeliverableId: id, currentView: "deliverable" }),
  setSelectedMemoryFile: (file) => set({ selectedMemoryFile: file }),
  setTasks: (tasks) => set({ tasks }),
  upsertTask: (task) =>
    set((state) => {
      const idx = state.tasks.findIndex((t) => t.id === task.id);
      if (idx === -1) return { tasks: [...state.tasks, task] };
      const next = [...state.tasks];
      next[idx] = task;
      return { tasks: next };
    }),
}));
```

- [ ] **Step 2: Add tasks API helpers to api.ts**

In `packages/web/src/lib/api.ts`, add `tasks` and `agents` sections:

```typescript
  tasks: {
    list: (params?: { assigned_to?: string; status?: string }) => {
      const qs = params
        ? "?" + new URLSearchParams(params as Record<string, string>).toString()
        : "";
      return fetch(`/api/tasks${qs}`).then(json) as Promise<import("../store/useAgencyStore").Task[]>;
    },
    patch: (id: string, body: { title?: string; description_md?: string; status?: string; current_version: number }) =>
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(json),
  },
  agents: {
    getConfig: (role: string) => fetch(`/api/agents/${role}/config`).then(json),
    putConfig: (role: string, config: Record<string, unknown>) =>
      fetch(`/api/agents/${role}/config`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      }).then(json),
  },
```

- [ ] **Step 3: Add tasks + agents nav items to Sidebar.tsx**

In `packages/web/src/components/layout/Sidebar.tsx`:

Change `type NavId`:
```typescript
type NavId = "home" | "pipeline" | "memory" | "tasks" | "agents";
```

Change `NAV` array:
```typescript
const NAV: { id: NavId; label: string }[] = [
  { id: "home",     label: "Home" },
  { id: "pipeline", label: "Pipeline" },
  { id: "tasks",    label: "Tasks" },
  { id: "memory",   label: "Memory" },
  { id: "agents",   label: "Agents" },
];
```

Change `handleNav`:
```typescript
function handleNav(id: NavId) {
  if (id === "home" || id === "memory" || id === "pipeline" || id === "tasks" || id === "agents") {
    setView(id);
  }
}
```

- [ ] **Step 4: Create tasks.tsx**

Create `packages/web/src/views/tasks.tsx`:

```typescript
import { useEffect, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { useAgencyStore, type Task } from "../store/useAgencyStore";
import { api } from "../lib/api";

const COLUMNS: { id: Task["status"]; label: string }[] = [
  { id: "open",        label: "To Do" },
  { id: "in_progress", label: "Doing" },
  { id: "done",        label: "Done" },
  { id: "blocked",     label: "Blocked" },
];

function TaskCard({ task, isDragging = false }: { task: Task; isDragging?: boolean }) {
  return (
    <div style={{
      background: "var(--parchment)",
      border: "1px solid var(--rule)",
      borderRadius: 6,
      padding: "10px 12px",
      opacity: isDragging ? 0.5 : 1,
      cursor: "grab",
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-1)", marginBottom: 4 }}>
        {task.title}
      </div>
      <div className="caption" style={{ color: "var(--ink-3)" }}>
        {task.assignedTo}
      </div>
    </div>
  );
}

function DroppableColumn({ status, label, tasks }: { status: Task["status"]; label: string; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div className="caption" style={{ padding: "0 4px 8px", color: "var(--ink-2)" }}>
        {label} ({tasks.length})
      </div>
      <div
        ref={setNodeRef}
        style={{
          minHeight: 120,
          background: isOver ? "var(--primary-soft)" : "var(--surface)",
          borderRadius: 6,
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          transition: "background 0.15s",
        }}
      >
        {tasks.map((t) => <DraggableCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
}

export function TasksView() {
  const { tasks, setTasks, upsertTask } = useAgencyStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    api.tasks.list().then(setTasks).catch(console.error);
  }, [setTasks]);

  function onDragStart(evt: DragStartEvent) {
    const task = tasks.find((t) => t.id === evt.active.id);
    if (task) setActiveTask(task);
  }

  async function onDragEnd(evt: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const newStatus = over.id as Task["status"];
    if (task.status === newStatus) return;

    const optimistic = { ...task, status: newStatus };
    upsertTask(optimistic);
    try {
      await api.tasks.patch(task.id, { status: newStatus, current_version: task.version });
      const refreshed = await api.tasks.list();
      setTasks(refreshed);
    } catch {
      upsertTask(task); // rollback
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar is rendered by parent layout */}
      <main style={{ flex: 1, padding: "28px 32px", overflow: "auto" }}>
        <h1 className="heading" style={{ marginBottom: 24 }}>Tasks</h1>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div style={{ display: "flex", gap: 16 }}>
            {COLUMNS.map((col) => (
              <DroppableColumn
                key={col.id}
                status={col.id}
                label={col.label}
                tasks={tasks.filter((t) => t.status === col.id)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} />}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Wire tasks view into App.tsx**

In `packages/web/src/App.tsx`, add import and render branch:

```typescript
import { TasksView } from "./views/tasks";
// in return JSX:
{currentView === "tasks" && <TasksView />}
```

- [ ] **Step 6: Run web tests**

```bash
cd packages/web && npm test
```

Expected: PASS — existing tests green, no new failures.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/
git commit -m "feat(web): add Tasks kanban view with dnd-kit status columns"
```

---

### Task 10: Agent config UI

**Files:**
- Create: `packages/web/src/views/agents.tsx`
- Modify: `packages/web/src/App.tsx`

Note: Sidebar nav and api.ts were already updated in Task 9.

- [ ] **Step 1: Create agents.tsx**

Create `packages/web/src/views/agents.tsx`:

```typescript
import { useEffect, useState } from "react";
import { api } from "../lib/api";

const TEAM = [
  { slug: "director",          name: "Director" },
  { slug: "content-lead",      name: "Content Lead" },
  { slug: "distribution-lead", name: "Distribution Lead" },
  { slug: "insights-lead",     name: "Insights Lead" },
  { slug: "copywriter",        name: "Copywriter" },
  { slug: "social-manager",    name: "Social Manager" },
  { slug: "seo-analyst",       name: "SEO Analyst" },
  { slug: "eval-judge",        name: "Eval Judge" },
];

interface AgentConfig {
  style?: string;
  tone?: string;
  response_length?: string;
  language?: string;
  system_prompt_override?: string;
}

function ConfigPanel({ role }: { role: string }) {
  const [config, setConfig] = useState<AgentConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.agents.getConfig(role).then((data: { config: AgentConfig } | null) => {
      if (data) setConfig(data.config);
      else setConfig({});
    }).catch(() => setConfig({}));
  }, [role]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.agents.putConfig(role, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const preview = [
    config.style && `Style: ${config.style}`,
    config.tone && `Tone: ${config.tone}`,
    config.response_length && `Response length: ${config.response_length}`,
    config.language && `Language: ${config.language}`,
  ].filter(Boolean).join(" | ");

  return (
    <div style={{ padding: "0 32px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Structured fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Style</label>
            <select
              value={config.style ?? ""}
              onChange={(e) => setConfig({ ...config, style: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— not set —</option>
              <option value="terse">Terse</option>
              <option value="balanced">Balanced</option>
              <option value="verbose">Verbose</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Tone</label>
            <select
              value={config.tone ?? ""}
              onChange={(e) => setConfig({ ...config, tone: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— not set —</option>
              <option value="authoritative">Authoritative</option>
              <option value="friendly">Friendly</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Response length</label>
            <select
              value={config.response_length ?? ""}
              onChange={(e) => setConfig({ ...config, response_length: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— not set —</option>
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Language</label>
            <input
              type="text"
              value={config.language ?? ""}
              onChange={(e) => setConfig({ ...config, language: e.target.value || undefined })}
              placeholder="e.g. hu, en"
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          {preview && (
            <div style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: 4, fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>
              {preview}
            </div>
          )}
        </div>

        {/* Freeform override */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="caption">System prompt override (appended)</label>
          <textarea
            value={config.system_prompt_override ?? ""}
            onChange={(e) => setConfig({ ...config, system_prompt_override: e.target.value || undefined })}
            rows={10}
            style={{ padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13, resize: "vertical", fontFamily: "var(--font-mono)" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 20px", borderRadius: 4, border: "none", cursor: saving ? "default" : "pointer",
            background: saved ? "var(--success, #22c55e)" : "var(--bulb)", color: "#fff", fontSize: 13, fontWeight: 500,
          }}
        >
          {saving ? "Saving…" : saved ? "Saved!" : "Save & restart agent"}
        </button>
      </div>
    </div>
  );
}

export function AgentsView() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <main style={{ flex: 1, padding: "28px 0", overflow: "auto" }}>
        <h1 className="heading" style={{ padding: "0 32px", marginBottom: 24 }}>Agents</h1>
        <div style={{ display: "flex", gap: 0 }}>
          {/* Team list */}
          <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--rule)", paddingRight: 0 }}>
            {TEAM.map((t) => (
              <button
                key={t.slug}
                onClick={() => setSelectedRole(t.slug)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "9px 20px", border: "none", background: selectedRole === t.slug ? "var(--primary-soft)" : "transparent",
                  color: selectedRole === t.slug ? "var(--primary-deep)" : "var(--ink-1)",
                  fontSize: 13, cursor: "pointer",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Config panel */}
          <div style={{ flex: 1 }}>
            {selectedRole
              ? <ConfigPanel key={selectedRole} role={selectedRole} />
              : <div style={{ padding: "40px 32px", color: "var(--ink-3)", fontSize: 13 }}>Select an agent to configure</div>
            }
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Wire agents view into App.tsx**

```typescript
import { AgentsView } from "./views/agents";
// in return JSX:
{currentView === "agents" && <AgentsView />}
```

- [ ] **Step 3: Run web tests**

```bash
cd packages/web && npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/views/agents.tsx packages/web/src/App.tsx
git commit -m "feat(web): add Agents config view with per-role behavior settings"
```

---

### Task 11: Memory new file + Revision diff UI

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/views/memory.tsx` (existing view)
- Modify: `packages/web/src/views/deliverable.tsx` (existing view, check exact path)
- Modify: `packages/web/package.json`

- [ ] **Step 1: Install diff package**

```bash
cd packages/web && npm install diff && npm install -D @types/diff
```

- [ ] **Step 2: Add POST /api/memory to api.ts**

In `packages/web/src/lib/api.ts`, add to the `memory` section:

```typescript
create: (filename: string) =>
  post<{ ok: boolean; filename: string }>("/api/memory", { filename }),
```

And add revision content helper to `deliverables`:

```typescript
revisionContent: (revisionId: string) =>
  fetch(`/api/deliverables/revisions/${revisionId}/content`).then(json) as Promise<{ content: string }>,
```

- [ ] **Step 3: Find memory view file path**

```bash
find /home/brandaholic/Projects/Homelab/marquee/packages/web/src/views -name "memory*"
```

- [ ] **Step 4: Add "New file" button to Memory view**

In the Memory view file, find where the file list heading or list is rendered. Add a `+ New file` button next to it. On click, show a simple inline prompt (a text input + confirm button). On confirm, call `api.memory.create(filename)` and refresh the file list.

Example button placement (adapt to the actual file structure):

```typescript
const [newFileName, setNewFileName] = useState("");
const [showNew, setShowNew] = useState(false);

async function handleCreate() {
  if (!newFileName.trim()) return;
  const name = newFileName.endsWith(".md") ? newFileName : `${newFileName}.md`;
  await api.memory.create(name);
  setShowNew(false);
  setNewFileName("");
  // refresh file list — call whatever function already loads files
  loadFiles();
}

// In JSX, near the "Memory" heading:
<button
  onClick={() => setShowNew(true)}
  style={{ fontSize: 12, padding: "3px 10px", borderRadius: 4, border: "1px solid var(--rule)", background: "transparent", cursor: "pointer", color: "var(--ink-2)" }}
>
  + New file
</button>
{showNew && (
  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
    <input
      autoFocus
      value={newFileName}
      onChange={(e) => setNewFileName(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
      placeholder="filename.md"
      style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--rule)", borderRadius: 4, fontSize: 13 }}
    />
    <button onClick={handleCreate} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bulb)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>Create</button>
    <button onClick={() => setShowNew(false)} style={{ padding: "5px 12px", borderRadius: 4, background: "transparent", color: "var(--ink-3)", border: "1px solid var(--rule)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
  </div>
)}
```

- [ ] **Step 5: Find deliverable view file path**

```bash
find /home/brandaholic/Projects/Homelab/marquee/packages/web/src/views -name "deliverable*"
```

- [ ] **Step 6: Add revision diff to Deliverable view**

In the Deliverable view file, find where the revisions list is rendered. Add checkbox selection and a "Compare" button. When exactly two revisions are checked, fetch both contents and show a side-by-side diff.

Add these imports at the top of the deliverable view file:
```typescript
import { diffLines, type Change } from "diff";
```

Add state:
```typescript
const [checkedRevs, setCheckedRevs] = useState<string[]>([]);
const [diffContent, setDiffContent] = useState<Change[] | null>(null);
```

Toggle checkbox handler:
```typescript
function toggleRev(revId: string) {
  setCheckedRevs((prev) =>
    prev.includes(revId) ? prev.filter((id) => id !== revId) : prev.length < 2 ? [...prev, revId] : prev,
  );
  setDiffContent(null);
}
```

Compare button (shown when exactly 2 are checked):
```typescript
{checkedRevs.length === 2 && (
  <button
    onClick={async () => {
      const [a, b] = await Promise.all([
        api.deliverables.revisionContent(checkedRevs[0]),
        api.deliverables.revisionContent(checkedRevs[1]),
      ]);
      setDiffContent(diffLines(a.content, b.content));
    }}
    style={{ padding: "5px 14px", borderRadius: 4, background: "var(--bulb)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}
  >
    Compare
  </button>
)}
```

Diff display (below the revision list):
```typescript
{diffContent && (
  <div style={{ marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 12 }}>
    {diffContent.map((part, i) => (
      <div
        key={i}
        style={{
          background: part.added ? "#dcfce7" : part.removed ? "#fee2e2" : "transparent",
          color: part.added ? "#166534" : part.removed ? "#991b1b" : "var(--ink-1)",
          whiteSpace: "pre-wrap",
          padding: "1px 4px",
        }}
      >
        {(part.added ? "+ " : part.removed ? "- " : "  ") + part.value}
      </div>
    ))}
  </div>
)}
```

Add checkbox to each revision list item (adapt to existing structure):
```typescript
<input
  type="checkbox"
  checked={checkedRevs.includes(rev.id)}
  onChange={() => toggleRev(rev.id)}
  disabled={checkedRevs.length === 2 && !checkedRevs.includes(rev.id)}
  style={{ marginRight: 8, cursor: "pointer" }}
/>
```

- [ ] **Step 7: Run web tests**

```bash
cd packages/web && npm test
```

Expected: PASS.

- [ ] **Step 8: Run all tests**

```bash
cd /home/brandaholic/Projects/Homelab/marquee && npm test
```

Expected: all packages green.

- [ ] **Step 9: Commit**

```bash
git add packages/web/
git commit -m "feat(web): add Memory new file button and revision diff view"
```
