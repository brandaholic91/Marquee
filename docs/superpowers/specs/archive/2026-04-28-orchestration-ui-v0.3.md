# Marquee v0.3 — Task Management, Daily Cron, Agent Config UI

## Goal

Add task management with status-based kanban, a nightly daily summary cron, an agent configuration UI, and two smaller Memory/Deliverable gaps.

## Architecture

Five independent feature areas sharing one database migration. The most significant new component is `TaskManager` — a service class that listens to broker events, creates tasks automatically, and owns the A+B notification logic for task updates. The other features (daily cron, agent config, smaller gaps) are additive changes with no cross-cutting concerns.

## Tech Stack

Node.js 22, TypeScript, SQLite/Drizzle ORM, Fastify 5, React 19, Zustand, dnd-kit (already installed), gray-matter (already installed), node-cron (new server dependency), diff (new web dependency).

---

## 1. Database Schema

One new table added to `packages/server/src/db/schema.ts`. All existing tables unchanged.

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

Migration generated with `npm run db:generate && npm run db:migrate`.

---

## 2. TaskManager Service

New file: `packages/server/src/tasks/manager.ts`

Responsibilities:
- Listen to `delegation_created` broker events → auto-create a task
- Expose `updateTask()` used by the `update_task` tool and the REST API
- Implement A+B notification logic on task update

```typescript
export class TaskManager {
  constructor(private db: AgencyDb, private broker: Broker, private router: AgentRouter) {}

  boot(): void {
    this.broker.subscribe((evt) => {
      if (evt.type === "delegation_created") this.onDelegationCreated(evt);
    });
  }

  private onDelegationCreated(evt: PersistedEvent): void {
    const { delegationId } = evt.payload as { delegationId: string };
    const delegation = this.db.select().from(delegations).where(eq(delegations.id, delegationId)).get();
    if (!delegation) return;
    const payload = delegation.payloadJson as { task?: string };
    const title = (payload.task ?? "Untitled task").slice(0, 80);
    this.db.insert(tasks).values({
      id: randomUUID(), delegationId, title,
      status: "open", assignedTo: delegation.toAgent,
    }).run();
    this.broker.emit("task_created", { delegationId, assignedTo: delegation.toAgent });
  }

  updateTask(
    taskId: string,
    patch: { title?: string; descriptionMd?: string; status?: string },
    updatedBy: string,
    currentVersion: number,
  ): Task {
    const result = this.db.update(tasks)
      .set({ ...patch, version: sql`version + 1`, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.version, currentVersion)))
      .returning()
      .get();
    if (!result) throw new ConflictError("Task was modified by someone else (version mismatch)");
    this.broker.emit("task_updated", { taskId, patch, updatedBy });
    this.notifyAgents(result, updatedBy);
    return result;
  }

  private notifyAgents(task: Task, updatedBy: string): void {
    const msg = `Task updated (by ${updatedBy}): "${task.title}" → status: ${task.status}`;
    const warmRoles = this.router.getWarmRoles();

    if (warmRoles.includes(task.assignedTo)) {
      // A: warm agent — prompt immediately
      this.router.promptWarmAgent(task.assignedTo, msg);
    } else {
      // B: transient specialist
      // B1: find Lead for this specialist, notify immediately
      const lead = SPECIALIST_TO_LEAD[task.assignedTo];
      if (lead) this.router.promptWarmAgent(lead, `${msg} — specialist is currently working on it.`);
      // B2: save pending update for specialist's next spawnAndPrompt
      this.db.insert(taskPendingUpdates).values({
        id: randomUUID(), taskId: task.id, message: msg,
      }).run();
    }
  }
}

const SPECIALIST_TO_LEAD: Record<string, string> = {
  copywriter:      "content-lead",
  "social-manager": "distribution-lead",
  "seo-analyst":   "insights-lead",
};
```

**Pending updates delivery:** `spawnAndPrompt()` in `router.ts`, after receiving a `delegationId`, first queries `tasks WHERE delegationId = ?` to get the task ID, then fetches `taskPendingUpdates WHERE taskId = task.id AND deliveredAt IS NULL`, appends each message to `userMessage`, and marks them `deliveredAt = now()`.

**New method on AgentRouter:** `promptWarmAgent(role, message)` — wraps the existing warm agent map lookup + `.prompt()` call.

**Instantiation order in `src/index.ts`:**
```typescript
const broker = new Broker(db, webhookUrl);
const router = new AgentRouter(db, broker, dataDir);
const taskManager = new TaskManager(db, broker, router);
taskManager.boot();   // subscribe before router.boot()
router.boot();
```

---

## 3. update_task Tool

New file: `packages/server/src/tools/tasks.ts`

```typescript
const updateTaskInput = z.object({
  task_id:         z.string(),
  current_version: z.number().int(),
  title:           z.string().optional(),
  description_md:  z.string().optional(),
  status:          z.enum(["open", "in_progress", "done", "blocked"]).optional(),
});

export const updateTask: AgentToolDef<...> = {
  name: "update_task",
  description: "Update a task's title, description, or status. Director and Lead agents only.",
  schema: { ... },
  input: updateTaskInput,
  async execute(input, ctx) {
    const patch = {
      title: input.title,
      descriptionMd: input.description_md,
      status: input.status,
    };
    const updated = ctx.taskManager.updateTask(input.task_id, patch, ctx.agentSlug, input.current_version);
    return { ok: true, taskId: updated.id, newVersion: updated.version };
  },
};
```

`ToolContext` kiegészül `taskManager: TaskManager`-rel. A `toolsForRole` switch-ben a `director`, `content-lead`, `distribution-lead`, `insights-lead` megkapja az `updateTask` tool-t.

---

## 4. Tasks API Routes

New file: `packages/server/src/server/routes/tasks.ts`

```
GET  /api/tasks           ?assigned_to=<slug>&status=<status>
PATCH /api/tasks/:id      body: { title?, description_md?, status?, current_version }
                          updatedBy = "human"
```

`registerTaskRoutes(app, opts)` regisztrálva a `server/index.ts`-ben.

---

## 5. Daily Cron

New file: `packages/server/src/cron/daily-summary.ts`

```typescript
export async function runDailySummary(db: AgencyDb, dataDir: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  // query: sessions, delegations, deliverables, evals for today
  const md = buildDailySummaryMd({ today, sessions, delegations, deliverables, evals });
  const dir = join(dataDir, "memory", "daily_notes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${today}.md`), md, "utf8");
}
```

Generated markdown structure:
```markdown
# Daily Summary — YYYY-MM-DD

## Sessions (N)
- director: N sessions, N turns

## Delegations (N)
- content-lead → copywriter: blog post (done)

## Deliverables
- "Title" — status (eval: N/10)

## Eval scores
- brand_voice: N, factual_accuracy: N, usp_usage: N
```

**Registered in `src/index.ts`:**
```typescript
import { schedule } from "node-cron";
import { runDailySummary } from "./cron/daily-summary.js";
schedule("0 2 * * *", () => runDailySummary(db, dataDir).catch(console.error));
```

**`RELEVANT_MEMORY_FOR_ROLE` update in `transform-context.ts`:**
```typescript
director: ["client_profile", "brand_guidelines", "ongoing_campaigns",
           "daily_notes/YESTERDAY", "daily_notes/2_DAYS_AGO", "daily_notes/3_DAYS_AGO"],
```

The `memoryBlock()` function resolves `daily_notes/YESTERDAY` to the actual `daily_notes/YYYY-MM-DD.md` filename before reading.

---

## 6. Agent Config UI

### Backend

New file: `packages/server/src/agents/config.ts`

```typescript
export interface AgentConfig {
  style?: "terse" | "verbose" | "balanced";
  tone?: "authoritative" | "friendly" | "neutral";
  response_length?: "concise" | "detailed";
  language?: string;         // e.g. "hu", "en"
  system_prompt_override?: string;
}

export function loadAgentConfig(dataDir: string, role: string): AgentConfig | null {
  const path = join(dataDir, "agents", role, "config.md");
  if (!existsSync(path)) return null;
  return matter(readFileSync(path, "utf8")).data as AgentConfig;
}

export function buildBehaviorBlock(config: AgentConfig): string {
  const lines = [
    config.style && `Style: ${config.style}`,
    config.tone && `Tone: ${config.tone}`,
    config.response_length && `Response length: ${config.response_length}`,
    config.language && `Language: ${config.language}`,
  ].filter(Boolean);
  const structured = lines.length ? `## Behavior\n${lines.join(" | ")}\n` : "";
  const override = config.system_prompt_override
    ? `\n${config.system_prompt_override.trim()}\n`
    : "";
  return structured + override;
}
```

**`buildSystemPrompt()` in `factory.ts`** appends `buildBehaviorBlock(config)` at the end if config exists.

New file: `packages/server/src/server/routes/agents.ts`

```
GET  /api/agents/:role/config   → { frontmatter, body } of config.md (or null)
PUT  /api/agents/:role/config   → write config.md, if warm role → router.restartWarmAgent(role)
```

**`restartWarmAgent(role)` on `AgentRouter`:** closes old session (`endedAt = now()`), creates new `Agent` instance with `makeAgent()`, registers new session row. Message history is not preserved (clean start with new system prompt).

### Frontend

New `NavId`: `"agents"` added to `NAV` array in `Sidebar.tsx`.

New view: `packages/web/src/views/agents.tsx`

Layout:
- Left panel: Team list (same slugs as Sidebar TEAM array), click selects agent
- Right panel on selection:
  - Structured fields: Style (dropdown), Tone (dropdown), Response length (dropdown), Language (text input)
  - Freeform textarea: `system_prompt_override`
  - Live preview: shows the generated behavior block
  - "Save & restart agent" button → `PUT /api/agents/:role/config`

---

## 7. Tasks Kanban View (Frontend)

New view: `packages/web/src/views/tasks.tsx`

Four status columns: **To Do** (`open`), **Doing** (`in_progress`), **Done** (`done`), **Blocked** (`blocked`).

Each card shows: title, assigned agent badge (Avatar + name), delegation source ("from director").

Drag-and-drop with `dnd-kit` (already installed): dragging a card between columns fires `PATCH /api/tasks/:id` with new status. Optimistic update in store, rollback on error.

Click on card → slide-out panel: title input, description_md textarea, status dropdown, "Save" button.

SSE events `task_created` and `task_updated` trigger store refresh.

**Store additions to `useAgencyStore`:**
```typescript
tasks: Task[]
setTasks: (tasks: Task[]) => void
upsertTask: (task: Task) => void
```

---

## 8. Smaller Gaps

### Memory "New file" button

New endpoint: `POST /api/memory` body: `{ filename: string }` — validates no path traversal, creates `dataDir/memory/<filename>.md` with starter frontmatter, git commits.

Frontend: `+` button in Memory file list header → modal with filename input → POST → opens inline editor on the new file.

### Revision diff view

New endpoint: `GET /api/deliverables/revisions/:revisionId/content` — looks up the revision by ID, reads the artifact file at `artifactPath`, returns `{ content: string }`. The `artifactPath` is never exposed to the client.

Frontend: in Deliverable detail view, revision list items get a checkbox. When two are checked, a "Compare" button appears → side-by-side diff using the `diff` npm package (added as dependency), rendered with `+`/`-` line highlighting using existing design tokens.

---

## Error Handling

- `updateTask` version mismatch → `ConflictError` → HTTP 409
- `PUT /api/agents/:role/config` unknown role → HTTP 404
- `POST /api/memory` filename with `..` or `/` → HTTP 400
- `GET /api/deliverables/revision-content` path outside artifacts dir → HTTP 403
- Daily cron failure → `console.error`, no crash (`.catch(console.error)`)

---

## Testing

- `tasks/manager.test.ts`: task auto-creation on delegation_created, updateTask happy path, version conflict → ConflictError, A notification (warm agent prompt), B notification (pending update + lead prompt)
- `tools/tasks.test.ts`: update_task tool success, conflict propagation
- `server/routes/tasks.test.ts`: GET /api/tasks filters, PATCH /api/tasks/:id happy + 409
- `agents/config.test.ts`: loadAgentConfig with/without file, buildBehaviorBlock with all fields, with partial fields
- `cron/daily-summary.test.ts`: buildDailySummaryMd with mock data, file written to correct path
- `server/routes/memory.test.ts`: POST /api/memory happy path, path traversal rejection
- All existing tests must continue to pass
