import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
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
      campaignId: delegation.campaignId ?? null,
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
