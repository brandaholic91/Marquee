# Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `campaigns` table as the top-level organizing entity above briefs, with automatic `campaignId` propagation through the delegation chain to deliverables, tasks, and memory proposals, plus a Campaigns UI view and filters.

**Architecture:** A thin `campaigns` table (id, title, description, status) is created alongside each brief — either by the `propose_brief` tool (Director-initiated) or by the `POST /api/briefs` raw endpoint (human-submitted). `campaignId` propagates automatically through delegations → deliverables → tasks via backend handlers; agents are unaware of campaigns. The UI adds a `/campaigns` view and dropdown filters in Pipeline and Tasks.

**Tech Stack:** Node.js 22, TypeScript, SQLite/Drizzle ORM (better-sqlite3), Drizzle Kit migrations, Fastify 5, React 19, Zustand, Vitest.

---

## File Structure

**New files:**
- `packages/server/drizzle/0003_campaigns.sql` — migration SQL
- `packages/server/src/server/routes/campaigns.ts` — GET/PATCH endpoints
- `packages/server/src/server/routes/campaigns.test.ts` — API tests
- `packages/web/src/views/campaigns.tsx` — Campaigns view

**Modified files:**
- `packages/server/drizzle/meta/_journal.json` — add migration entry
- `packages/server/src/db/schema.ts` — campaigns table + campaignId FK on 5 tables
- `packages/server/src/tools/proposals.ts` — proposeBrief creates campaign
- `packages/server/src/tools/proposals.test.ts` — extend with campaign test
- `packages/server/src/tools/delegation.ts` — propagate campaignId in delegateToLead + delegateToSpecialist
- `packages/server/src/tools/deliverables.ts` — propagate campaignId in makeSubmitDeliverable
- `packages/server/src/tasks/manager.ts` — propagate campaignId in onDelegationCreated
- `packages/server/src/server/routes/briefs.ts` — POST auto-creates campaign
- `packages/server/src/server/routes/deliverables.ts` — repurpose propagation + ?campaignId filter
- `packages/server/src/server/routes/tasks.ts` — ?campaignId filter
- `packages/server/src/server/index.ts` — register campaigns routes
- `packages/web/src/lib/api.ts` — campaigns API methods
- `packages/web/src/store/useAgencyStore.ts` — Campaign type + "campaigns" view
- `packages/web/src/App.tsx` — CampaignsView import + routing
- `packages/web/src/components/layout/Sidebar.tsx` — Campaigns nav item
- `packages/web/src/views/pipeline.tsx` — campaign filter dropdown
- `packages/web/src/views/tasks.tsx` — campaign filter dropdown

---

## Task 1: DB migration + schema

**Files:**
- Create: `packages/server/drizzle/0003_campaigns.sql`
- Modify: `packages/server/drizzle/meta/_journal.json`
- Modify: `packages/server/src/db/schema.ts`

- [ ] **Step 1: Write migration SQL**

Create `packages/server/drizzle/0003_campaigns.sql`:

```sql
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL DEFAULT 'active',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `briefs` ADD `campaign_id` text REFERENCES campaigns(id);
--> statement-breakpoint
ALTER TABLE `delegations` ADD `campaign_id` text REFERENCES campaigns(id);
--> statement-breakpoint
ALTER TABLE `deliverables` ADD `campaign_id` text REFERENCES campaigns(id);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `campaign_id` text REFERENCES campaigns(id);
--> statement-breakpoint
ALTER TABLE `memory_proposals` ADD `campaign_id` text REFERENCES campaigns(id);
```

- [ ] **Step 2: Update migration journal**

In `packages/server/drizzle/meta/_journal.json`, add the new entry to the `entries` array:

```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    { "idx": 0, "version": "6", "when": 1777314011788, "tag": "0000_init", "breakpoints": true },
    { "idx": 1, "version": "6", "when": 1777365143764, "tag": "0001_skinny_thunderbird", "breakpoints": true },
    { "idx": 2, "version": "6", "when": 1777385101119, "tag": "0002_late_nico_minoru", "breakpoints": true },
    { "idx": 3, "version": "6", "when": 1745798400000, "tag": "0003_campaigns", "breakpoints": true }
  ]
}
```

- [ ] **Step 3: Update schema.ts**

Add `campaigns` table before `briefs` and add `campaignId` to 5 existing tables. Full modified `packages/server/src/db/schema.ts`:

```typescript
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

const ts = (col: string) =>
	integer(col, { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date());

export const campaigns = sqliteTable("campaigns", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	description: text("description"),
	status: text("status", { enum: ["active", "completed", "archived"] }).notNull().default("active"),
	createdAt: ts("created_at"),
});

export const chatThreads = sqliteTable("chat_threads", {
	id: text("id").primaryKey(),
	type: text("type", { enum: ["intake", "dispatched", "consultative"] }).notNull(),
	title: text("title").notNull(),
	createdAt: ts("created_at"),
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
});

export const chatParticipants = sqliteTable("chat_participants", {
	threadId: text("thread_id")
		.notNull()
		.references(() => chatThreads.id),
	agentSlug: text("agent_slug").notNull(),
});

export const messages = sqliteTable(
	"messages",
	{
		id: text("id").primaryKey(),
		threadId: text("thread_id").references(() => chatThreads.id),
		agentSessionId: text("agent_session_id"),
		sender: text("sender").notNull(),
		type: text("type", {
			enum: [
				"chat",
				"delegation_req",
				"delegation_resp",
				"brief_proposal",
				"memory_proposal",
				"eval_report",
				"tool_call",
				"tool_result",
				"approval_decision",
				"human_brief",
			],
		}).notNull(),
		contentJson: text("content_json", { mode: "json" }).notNull(),
		createdAt: ts("created_at"),
	},
	(t) => ({
		threadIdx: index("messages_thread_idx").on(t.threadId, t.createdAt),
		sessionIdx: index("messages_session_idx").on(t.agentSessionId, t.createdAt),
	}),
);

export const briefs = sqliteTable("briefs", {
	id: text("id").primaryKey(),
	sourceThreadId: text("source_thread_id").references(() => chatThreads.id),
	campaignId: text("campaign_id").references(() => campaigns.id),
	status: text("status", { enum: ["draft", "dispatched", "done"] }).notNull(),
	contentMd: text("content_md").notNull(),
	createdAt: ts("created_at"),
	dispatchedAt: integer("dispatched_at", { mode: "timestamp_ms" }),
});

export const delegations = sqliteTable(
	"delegations",
	{
		id: text("id").primaryKey(),
		briefId: text("brief_id").references(() => briefs.id),
		parentDelegationId: text("parent_delegation_id"),
		campaignId: text("campaign_id").references(() => campaigns.id),
		fromAgent: text("from_agent").notNull(),
		toAgent: text("to_agent").notNull(),
		status: text("status", { enum: ["requested", "in_progress", "complete", "blocked"] }).notNull(),
		payloadJson: text("payload_json", { mode: "json" }).notNull(),
		requestedAt: ts("requested_at"),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
	},
	(t) => ({
		parentIdx: index("delegations_parent_idx").on(t.parentDelegationId, t.status),
		statusIdx: index("delegations_status_idx").on(t.status),
	}),
);

export const deliverables = sqliteTable(
	"deliverables",
	{
		id: text("id").primaryKey(),
		delegationId: text("delegation_id")
			.notNull()
			.references(() => delegations.id),
		campaignId: text("campaign_id").references(() => campaigns.id),
		type: text("type").notNull(),
		title: text("title").notNull(),
		status: text("status", {
			enum: ["drafting", "awaiting_eval", "awaiting_approval", "shipped", "archived"],
		}).notNull(),
		currentRevisionId: text("current_revision_id"),
		sourceDeliverableId: text("source_deliverable_id").references((): AnySQLiteColumn => deliverables.id),
		createdAt: ts("created_at"),
		updatedAt: ts("updated_at"),
	},
	(t) => ({
		statusIdx: index("deliverables_status_idx").on(t.status),
	}),
);

export const deliverableRevisions = sqliteTable("deliverable_revisions", {
	id: text("id").primaryKey(),
	deliverableId: text("deliverable_id")
		.notNull()
		.references(() => deliverables.id),
	artifactPath: text("artifact_path").notNull(),
	createdByAgent: text("created_by_agent").notNull(),
	createdAt: ts("created_at"),
});

export const evals = sqliteTable("evals", {
	id: text("id").primaryKey(),
	revisionId: text("revision_id")
		.notNull()
		.references(() => deliverableRevisions.id),
	scoresJson: text("scores_json", { mode: "json" }).notNull(),
	summaryMd: text("summary_md").notNull(),
	createdAt: ts("created_at"),
});

export const approvals = sqliteTable("approvals", {
	id: text("id").primaryKey(),
	deliverableId: text("deliverable_id")
		.notNull()
		.references(() => deliverables.id),
	decision: text("decision", { enum: ["approved", "rejected", "requested_changes"] }).notNull(),
	note: text("note"),
	decidedAt: ts("decided_at"),
});

export const agentSessions = sqliteTable(
	"agent_sessions",
	{
		id: text("id").primaryKey(),
		agentSlug: text("agent_slug").notNull(),
		lifecycle: text("lifecycle", { enum: ["warm", "transient"] }).notNull(),
		parentDelegationId: text("parent_delegation_id").references(() => delegations.id),
		startedAt: ts("started_at"),
		endedAt: integer("ended_at", { mode: "timestamp_ms" }),
	},
	(t) => ({
		activeIdx: index("sessions_active_idx").on(t.endedAt),
	}),
);

export const turns = sqliteTable(
	"turns",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => agentSessions.id),
		model: text("model").notNull(),
		promptTokens: integer("prompt_tokens").notNull(),
		completionTokens: integer("completion_tokens").notNull(),
		costUsd: integer("cost_usd_cents").notNull(),
		latencyMs: integer("latency_ms").notNull(),
		startedAt: ts("started_at"),
		endedAt: integer("ended_at", { mode: "timestamp_ms" }),
	},
	(t) => ({
		sessionIdx: index("turns_session_idx").on(t.sessionId, t.startedAt),
	}),
);

export const events = sqliteTable(
	"events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		ts: ts("ts"),
		agentSlug: text("agent_slug"),
		sessionId: text("session_id"),
		turnId: text("turn_id"),
		type: text("type").notNull(),
		payloadJson: text("payload_json", { mode: "json" }).notNull(),
	},
	(t) => ({
		tsIdx: index("events_ts_idx").on(t.ts),
	}),
);

export const memoryProposals = sqliteTable("memory_proposals", {
	id: text("id").primaryKey(),
	agentSessionId: text("agent_session_id"),
	campaignId: text("campaign_id").references(() => campaigns.id),
	file: text("file").notNull(),
	patch: text("patch").notNull(),
	status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
	createdAt: ts("created_at"),
});

export const tasks = sqliteTable(
	"tasks",
	{
		id: text("id").primaryKey(),
		delegationId: text("delegation_id").notNull().references(() => delegations.id),
		campaignId: text("campaign_id").references(() => campaigns.id),
		title: text("title").notNull(),
		descriptionMd: text("description_md").notNull().default(""),
		status: text("status", { enum: ["open", "in_progress", "done", "blocked"] }).notNull(),
		assignedTo: text("assigned_to").notNull(),
		version: integer("version").notNull().default(1),
		createdAt: ts("created_at"),
		updatedAt: ts("updated_at"),
	},
	(t) => ({
		assignedStatusIdx: index("tasks_assigned_status_idx").on(t.assignedTo, t.status),
	}),
);

export const taskPendingUpdates = sqliteTable("task_pending_updates", {
	id: text("id").primaryKey(),
	taskId: text("task_id").notNull().references(() => tasks.id),
	message: text("message").notNull(),
	deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
	createdAt: ts("created_at"),
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/server && npm run build 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Run existing tests to confirm baseline**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: all tests pass (same count as before).

- [ ] **Step 6: Commit**

```bash
git add packages/server/drizzle/0003_campaigns.sql packages/server/drizzle/meta/_journal.json packages/server/src/db/schema.ts
git commit -m "feat: add campaigns table and campaignId FK to briefs/delegations/deliverables/tasks/memory_proposals"
```

---

## Task 2: proposeBrief creates campaign

**Files:**
- Modify: `packages/server/src/tools/proposals.ts`
- Modify: `packages/server/src/tools/proposals.test.ts`

- [ ] **Step 1: Write failing test**

Add to the `describe("proposal tools")` block in `packages/server/src/tools/proposals.test.ts`:

```typescript
import { campaigns } from "../db/schema.js"; // add to existing import
```

Add test after the existing `propose_brief` test:

```typescript
it("propose_brief creates a campaign with the brief title", async () => {
  const emit = vi.fn();
  const result = await proposeBrief.execute(
    { threadId: randomUUID(), title: "Q2 Launch", scope: "blog", deliverables: ["blog_post"] },
    { db, agentSlug: "director", agentSessionId: randomUUID(), emit },
  );
  const brief = db.select().from(briefs).where(eq(briefs.id, result.briefId)).get()!;
  expect(brief.campaignId).toBeDefined();
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, brief.campaignId!)).get();
  expect(campaign?.title).toBe("Q2 Launch");
  expect(campaign?.status).toBe("active");
});
```

Add to imports at top of test file: `import { eq } from "drizzle-orm";`

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npm test -- proposals 2>&1 | tail -15
```

Expected: FAIL — `brief.campaignId` is null.

- [ ] **Step 3: Update proposeBrief.execute to create campaign**

Full updated `packages/server/src/tools/proposals.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { briefs, campaigns, memoryProposals } from "../db/schema.js";
import type { AgentToolDef } from "./types.js";

const proposeBriefInput = z.object({
	threadId: z.string(),
	title: z.string(),
	scope: z.string(),
	deliverables: z.array(z.string()).min(1),
	deadline: z.string().optional(),
});

export const proposeBrief: AgentToolDef<z.infer<typeof proposeBriefInput>, { briefId: string }> = {
	name: "propose_brief",
	description: "Propose a structured brief in the chat. Human reviews and approves to dispatch.",
	schema: {
		type: "object",
		properties: {
			threadId: { type: "string" },
			title: { type: "string" },
			scope: { type: "string" },
			deliverables: { type: "array", items: { type: "string" }, minItems: 1 },
			deadline: { type: "string" },
		},
		required: ["threadId", "title", "scope", "deliverables"],
	},
	input: proposeBriefInput,
	async execute(input, ctx) {
		const campaignId = randomUUID();
		ctx.db.insert(campaigns).values({ id: campaignId, title: input.title, status: "active" }).run();

		const id = randomUUID();
		const md = [
			`# ${input.title}`, "",
			`**Scope:** ${input.scope}`, "",
			`**Deliverables:** ${input.deliverables.join(", ")}`,
			input.deadline ? `**Deadline:** ${input.deadline}` : "",
		].filter(Boolean).join("\n");
		ctx.db.insert(briefs).values({
			id, sourceThreadId: null, status: "draft", contentMd: md, campaignId,
		}).run();
		ctx.emit("brief_proposed", { briefId: id, threadId: input.threadId, title: input.title });
		return { briefId: id };
	},
};

const proposeMemoryUpdateInput = z.object({
	file: z.string(),
	patch: z.string().min(10),
	rationale: z.string().optional(),
});

export const proposeMemoryUpdate: AgentToolDef<z.infer<typeof proposeMemoryUpdateInput>, { proposalId: string }> = {
	name: "propose_memory_update",
	description: "Propose a unified-diff patch to a memory file. Human approves, then git-committed.",
	schema: {
		type: "object",
		properties: {
			file: { type: "string" },
			patch: { type: "string", minLength: 10 },
			rationale: { type: "string" },
		},
		required: ["file", "patch"],
	},
	input: proposeMemoryUpdateInput,
	async execute(input, ctx) {
		proposeMemoryUpdateInput.parse(input);
		const id = randomUUID();
		ctx.db.insert(memoryProposals).values({
			id, agentSessionId: ctx.agentSessionId, file: input.file, patch: input.patch, status: "pending",
		}).run();
		ctx.emit("memory_proposed", { proposalId: id, file: input.file, by: ctx.agentSlug });
		return { proposalId: id };
	},
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/server && npm test -- proposals 2>&1 | tail -10
```

Expected: all proposal tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/tools/proposals.ts packages/server/src/tools/proposals.test.ts
git commit -m "feat: proposeBrief creates campaign with brief title"
```

---

## Task 3: POST /api/briefs auto-creates campaign

**Files:**
- Modify: `packages/server/src/server/routes/briefs.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/server/routes/briefs.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { openDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import { briefs, campaigns } from "../../db/schema.js";
import type { AgentRouter } from "../../broker/router.js";

function makeApp() {
  const dir = mkdtempSync(join(tmpdir(), "briefs-test-"));
  mkdirSync(join(dir, "memory"), { recursive: true });
  const { db, close } = openDb(join(dir, "test.db"));
  const broker = new Broker(db);
  return { db, broker, dir, close,
    cleanup: () => { close(); rmSync(dir, { recursive: true, force: true }); } };
}

describe("POST /api/briefs", () => {
  it("creates a campaign from the first line of contentMd", async () => {
    const { db, broker, dir, cleanup } = makeApp();
    const app = await buildServer({ db, broker, router: {} as AgentRouter, dataDir: dir, webRoot: "/nonexistent" });
    const res = await app.inject({
      method: "POST", url: "/api/briefs",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentMd: "# Q2 LinkedIn Series\n\nWrite 5 posts about product features." }),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; ok: boolean }>();
    const brief = db.select().from(briefs).where((b) => b).all().find(b => b.id === body.id)!;
    expect(brief.campaignId).toBeDefined();
    const campaign = db.select().from(campaigns).all().find(c => c.id === brief.campaignId);
    expect(campaign?.title).toBe("Q2 LinkedIn Series");
    expect(campaign?.status).toBe("active");
    cleanup();
  });

  it("uses date fallback when contentMd has no header line", async () => {
    const { db, broker, dir, cleanup } = makeApp();
    const app = await buildServer({ db, broker, router: {} as AgentRouter, dataDir: dir, webRoot: "/nonexistent" });
    const res = await app.inject({
      method: "POST", url: "/api/briefs",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentMd: "Write some content." }),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string }>();
    const brief = db.select().from(briefs).all().find(b => b.id === body.id)!;
    const campaign = db.select().from(campaigns).all().find(c => c.id === brief.campaignId);
    expect(campaign?.title).toMatch(/^Brief \d{4}-\d{2}-\d{2}$/);
    cleanup();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npm test -- briefs.test 2>&1 | tail -15
```

Expected: FAIL — `brief.campaignId` is null.

- [ ] **Step 3: Update POST /api/briefs to auto-create campaign**

Full updated `packages/server/src/server/routes/briefs.ts`:

```typescript
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { briefs, campaigns } from "../../db/schema.js";

export function registerBriefRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/briefs", async () => opts.db.select().from(briefs).all());

	app.post<{ Body: { contentMd: string } }>("/api/briefs", async (req, reply) => {
		const { contentMd } = req.body;
		if (!contentMd?.trim()) {
			return reply.status(400).send({ error: "contentMd is required" });
		}
		const firstLine = contentMd.trim().split("\n")[0].replace(/^#+\s*/, "").trim();
		const campaignTitle = firstLine.slice(0, 80) || `Brief ${new Date().toISOString().slice(0, 10)}`;

		const campaignId = randomUUID();
		opts.db.insert(campaigns).values({ id: campaignId, title: campaignTitle, status: "active" }).run();

		const id = randomUUID();
		opts.db.insert(briefs).values({
			id, status: "draft",
			contentMd: contentMd.trim(),
			campaignId,
		}).run();
		opts.router.queueBrief(id);
		return { id, ok: true };
	});

	app.post<{ Params: { id: string } }>("/api/briefs/:id/dispatch", async (req) => {
		opts.db.update(briefs).set({ status: "dispatched", dispatchedAt: new Date() })
			.where(eq(briefs.id, req.params.id)).run();
		opts.broker.emit("brief_dispatched", { briefId: req.params.id });
		return { ok: true };
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/server && npm test -- briefs.test 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 5: Run all tests to check for regressions**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/server/routes/briefs.ts packages/server/src/server/routes/briefs.test.ts
git commit -m "feat: POST /api/briefs auto-creates campaign from contentMd title"
```

---

## Task 4: delegation.ts — propagate campaignId

**Files:**
- Modify: `packages/server/src/tools/delegation.ts`
- Test: `packages/server/src/tools/delegation.test.ts` (existing file)

- [ ] **Step 1: Find the existing delegation test file**

```bash
ls packages/server/src/tools/delegation.test.ts 2>/dev/null || echo "not found"
```

If not found, the tests will be added in a new file. If found, add to existing.

- [ ] **Step 2: Write failing tests**

Create (or add to) `packages/server/src/tools/delegation.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs, campaigns, delegations } from "../db/schema.js";
import { delegateToLead, delegateToSpecialist } from "./delegation.js";

let dir: string;
let db: AgencyDb;
let close: () => void;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "deleg-test-"));
  ({ db, close } = openDb(join(dir, "test.db")));
});
afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

describe("delegateToLead", () => {
  it("copies campaignId from brief when briefId provided", async () => {
    const emit = vi.fn();
    const campaignId = randomUUID();
    db.insert(campaigns).values({ id: campaignId, title: "Test Campaign", status: "active" }).run();
    const briefId = randomUUID();
    db.insert(briefs).values({ id: briefId, status: "draft", contentMd: "test", campaignId }).run();

    const result = await delegateToLead.execute(
      { lead: "content-lead", task: "Write a blog post", briefId },
      { db, agentSlug: "director", agentSessionId: randomUUID(), emit },
    );

    const delegation = db.select().from(delegations).all().find(d => d.id === result.delegationId)!;
    expect(delegation.campaignId).toBe(campaignId);
  });

  it("sets campaignId to null when no briefId provided", async () => {
    const emit = vi.fn();
    const result = await delegateToLead.execute(
      { lead: "content-lead", task: "Write a blog post" },
      { db, agentSlug: "director", agentSessionId: randomUUID(), emit },
    );
    const delegation = db.select().from(delegations).all().find(d => d.id === result.delegationId)!;
    expect(delegation.campaignId).toBeNull();
  });
});

describe("delegateToSpecialist", () => {
  it("inherits campaignId from parent delegation", async () => {
    const emit = vi.fn();
    const campaignId = randomUUID();
    db.insert(campaigns).values({ id: campaignId, title: "Test Campaign", status: "active" }).run();
    const parentId = randomUUID();
    db.insert(delegations).values({
      id: parentId, fromAgent: "director", toAgent: "content-lead",
      status: "in_progress", payloadJson: {}, campaignId,
    }).run();

    const result = await delegateToSpecialist.execute(
      { specialist: "copywriter", task: "Write blog post" },
      { db, agentSlug: "content-lead", agentSessionId: randomUUID(), delegationId: parentId, emit },
    );

    const delegation = db.select().from(delegations).all().find(d => d.id === result.delegationId)!;
    expect(delegation.campaignId).toBe(campaignId);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/server && npm test -- delegation.test 2>&1 | tail -15
```

Expected: FAIL — `delegation.campaignId` is null.

- [ ] **Step 4: Update delegation.ts**

Full updated `packages/server/src/tools/delegation.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { briefs, delegations } from "../db/schema.js";
import type { AgentToolDef, ToolContext } from "./types.js";

const KNOWN_LEADS = new Set(["content-lead", "distribution-lead", "insights-lead"]);
const KNOWN_SPECIALISTS_BY_LEAD: Record<string, Set<string>> = {
	"content-lead": new Set(["copywriter", "repurposer"]),
	"distribution-lead": new Set(["social-manager", "paid-specialist"]),
	"insights-lead": new Set(["seo-analyst", "analytics-analyst"]),
};

const delegateToLeadInput = z.object({
	lead: z.string(),
	task: z.string().min(1),
	briefId: z.string().optional(),
	context: z.string().optional(),
});

export const delegateToLead: AgentToolDef<z.infer<typeof delegateToLeadInput>, { delegationId: string }> = {
	name: "delegate_to_lead",
	description: "Delegate a task to a Lead agent. Use this only as the Director.",
	schema: {
		type: "object",
		properties: {
			lead: { type: "string" },
			task: { type: "string", minLength: 1 },
			briefId: { type: "string" },
			context: { type: "string" },
		},
		required: ["lead", "task"],
	},
	input: delegateToLeadInput,
	async execute(input, ctx) {
		if (!KNOWN_LEADS.has(input.lead)) {
			throw new Error(`Unknown lead "${input.lead}". Valid: ${[...KNOWN_LEADS].join(", ")}`);
		}
		let campaignId: string | null = null;
		if (input.briefId) {
			const brief = ctx.db.select().from(briefs).where(eq(briefs.id, input.briefId)).get();
			campaignId = brief?.campaignId ?? null;
		}
		const id = randomUUID();
		ctx.db.insert(delegations).values({
			id, briefId: input.briefId, campaignId, fromAgent: ctx.agentSlug, toAgent: input.lead,
			status: "requested", payloadJson: { task: input.task, context: input.context } as never,
		}).run();
		ctx.emit("delegation_created", { delegationId: id, from: ctx.agentSlug, to: input.lead });
		return { delegationId: id };
	},
};

const delegateToSpecialistInput = z.object({
	specialist: z.string(),
	task: z.string().min(1),
	context: z.string().optional(),
});

export const delegateToSpecialist: AgentToolDef<z.infer<typeof delegateToSpecialistInput>, { delegationId: string }> = {
	name: "delegate_to_specialist",
	description: "Delegate a task to a Specialist agent under your supervision. Lead-only.",
	schema: {
		type: "object",
		properties: {
			specialist: { type: "string" },
			task: { type: "string", minLength: 1 },
			context: { type: "string" },
		},
		required: ["specialist", "task"],
	},
	input: delegateToSpecialistInput,
	async execute(input, ctx) {
		const allowed = KNOWN_SPECIALISTS_BY_LEAD[ctx.agentSlug];
		if (!allowed) throw new Error(`${ctx.agentSlug} is not a Lead and cannot delegate to specialists`);
		if (!allowed.has(input.specialist))
			throw new Error(`${ctx.agentSlug} cannot delegate to "${input.specialist}". Allowed: ${[...allowed].join(", ")}`);
		let campaignId: string | null = null;
		if (ctx.delegationId) {
			const parent = ctx.db.select().from(delegations).where(eq(delegations.id, ctx.delegationId)).get();
			campaignId = parent?.campaignId ?? null;
		}
		const id = randomUUID();
		ctx.db.insert(delegations).values({
			id, parentDelegationId: ctx.delegationId, campaignId, fromAgent: ctx.agentSlug, toAgent: input.specialist,
			status: "requested", payloadJson: { task: input.task, context: input.context } as never,
		}).run();
		ctx.emit("delegation_created", { delegationId: id, from: ctx.agentSlug, to: input.specialist });
		return { delegationId: id };
	},
};

const submitToDirectorInput = z.object({
	summary: z.string().min(1),
	deliverableId: z.string().optional(),
});

export const submitToDirector: AgentToolDef<z.infer<typeof submitToDirectorInput>, { ok: true }> = {
	name: "submit_to_director",
	description: "Forward your synthesized output up to the Director. Lead-only.",
	schema: {
		type: "object",
		properties: {
			summary: { type: "string", minLength: 1 },
			deliverableId: { type: "string" },
		},
		required: ["summary"],
	},
	input: submitToDirectorInput,
	async execute(input, ctx) {
		if (!ctx.delegationId) throw new Error("submit_to_director requires an active delegation context");
		ctx.db.update(delegations)
			.set({ status: "complete", completedAt: new Date(),
				payloadJson: { summary: input.summary, deliverableId: input.deliverableId } as never })
			.where(eq(delegations.id, ctx.delegationId))
			.run();
		ctx.emit("delegation_complete", { delegationId: ctx.delegationId });
		return { ok: true };
	},
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/server && npm test -- delegation.test 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/tools/delegation.ts packages/server/src/tools/delegation.test.ts
git commit -m "feat: propagate campaignId in delegateToLead and delegateToSpecialist"
```

---

## Task 5: submitDeliverable + TaskManager — propagate campaignId

**Files:**
- Modify: `packages/server/src/tools/deliverables.ts`
- Modify: `packages/server/src/tasks/manager.ts`

- [ ] **Step 1: Write failing tests for submitDeliverable**

Add to `packages/server/src/tools/deliverables.test.ts` (create if it doesn't exist, following the same pattern as proposals.test.ts):

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { campaigns, delegations, deliverables } from "../db/schema.js";
import { makeSubmitDeliverable } from "./deliverables.js";

let dir: string;
let db: AgencyDb;
let close: () => void;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "deliverables-tool-test-"));
  mkdirSync(join(dir, "artifacts"), { recursive: true });
  ({ db, close } = openDb(join(dir, "test.db")));
});
afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

describe("makeSubmitDeliverable", () => {
  it("copies campaignId from delegation onto deliverable", async () => {
    const campaignId = randomUUID();
    db.insert(campaigns).values({ id: campaignId, title: "Test", status: "active" }).run();
    const delegationId = randomUUID();
    db.insert(delegations).values({
      id: delegationId, fromAgent: "content-lead", toAgent: "copywriter",
      status: "in_progress", payloadJson: {}, campaignId,
    }).run();

    const emit = vi.fn();
    const submitDeliverable = makeSubmitDeliverable(dir);
    await submitDeliverable.execute(
      { type: "blog_post", title: "Test Post", contentMd: "x".repeat(50) },
      { db, agentSlug: "copywriter", agentSessionId: randomUUID(), delegationId, emit },
    );

    const d = db.select().from(deliverables).all()[0]!;
    expect(d.campaignId).toBe(campaignId);
  });

  it("sets campaignId to null when delegation has no campaign", async () => {
    const delegationId = randomUUID();
    db.insert(delegations).values({
      id: delegationId, fromAgent: "content-lead", toAgent: "copywriter",
      status: "in_progress", payloadJson: {},
    }).run();

    const emit = vi.fn();
    const submitDeliverable = makeSubmitDeliverable(dir);
    await submitDeliverable.execute(
      { type: "blog_post", title: "Test Post", contentMd: "x".repeat(50) },
      { db, agentSlug: "copywriter", agentSessionId: randomUUID(), delegationId, emit },
    );

    const d = db.select().from(deliverables).all()[0]!;
    expect(d.campaignId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npm test -- deliverables.test 2>&1 | tail -15
```

Expected: FAIL — `d.campaignId` is null.

- [ ] **Step 3: Update makeSubmitDeliverable to propagate campaignId**

In `packages/server/src/tools/deliverables.ts`, update the imports and the `execute` function:

```typescript
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { deliverables, deliverableRevisions, delegations, messages } from "../db/schema.js";
import type { AgentToolDef } from "./types.js";
```

In the `execute` function of `makeSubmitDeliverable`, add campaignId lookup before the insert:

```typescript
async execute(input, ctx) {
	if (!ctx.delegationId) throw new Error("submit_deliverable requires an active delegation context");
	const delegation = ctx.db.select().from(delegations).where(eq(delegations.id, ctx.delegationId)).get();
	const campaignId = delegation?.campaignId ?? null;

	const deliverableId = randomUUID();
	const revisionId = randomUUID();
	const artifactDir = join(dataDir, "artifacts", deliverableId);
	mkdirSync(artifactDir, { recursive: true });
	const artifactPath = join(artifactDir, "rev_001.md");
	writeFileSync(artifactPath, input.contentMd);

	ctx.db.insert(deliverables).values({
		id: deliverableId, delegationId: ctx.delegationId,
		type: input.type, title: input.title, status: "awaiting_eval",
		currentRevisionId: revisionId,
		sourceDeliverableId: input.source_deliverable_id ?? null,
		campaignId,
	}).run();
	ctx.db.insert(deliverableRevisions).values({
		id: revisionId, deliverableId, artifactPath, createdByAgent: ctx.agentSlug,
	}).run();
	ctx.emit("deliverable_submitted", { deliverableId, revisionId });
	return { deliverableId, revisionId };
},
```

- [ ] **Step 4: Write failing test for TaskManager**

Add to `packages/server/src/tasks/manager.test.ts` (find existing file or create):

```bash
cat packages/server/src/tasks/manager.test.ts | head -30
```

Add the following test (inside the appropriate describe block or as a new one):

```typescript
it("copies campaignId from delegation to task", () => {
  // seed campaign + delegation with campaignId
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
```

(Add `campaigns` to the import from `"../db/schema.js"` in the test file.)

- [ ] **Step 5: Run failing test**

```bash
cd packages/server && npm test -- manager.test 2>&1 | tail -15
```

Expected: FAIL — `task.campaignId` is null.

- [ ] **Step 6: Update TaskManager.onDelegationCreated**

In `packages/server/src/tasks/manager.ts`, update `onDelegationCreated`:

```typescript
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
```

- [ ] **Step 7: Run all tests to verify**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/tools/deliverables.ts packages/server/src/tools/deliverables.test.ts packages/server/src/tasks/manager.ts
git commit -m "feat: propagate campaignId in submitDeliverable and TaskManager"
```

---

## Task 6: repurpose endpoint + campaignId filters

**Files:**
- Modify: `packages/server/src/server/routes/deliverables.ts`
- Modify: `packages/server/src/server/routes/tasks.ts`

- [ ] **Step 1: Write failing test for repurpose campaignId propagation**

In `packages/server/src/server/routes/deliverables.test.ts`, add:

```typescript
describe("POST /api/deliverables/:id/repurpose — campaignId propagation", () => {
  it("sets campaignId on the new delegation from source deliverable", async () => {
    const { db, broker, router, dir } = deps;
    const campaignId = randomUUID();
    db.insert(campaigns).values({ id: campaignId, title: "Test Campaign", status: "active" }).run();
    const { delId } = seedDeliverable(db, "shipped");
    // set campaignId on the deliverable
    db.update(deliverables).set({ campaignId }).where(eq(deliverables.id, delId)).run();

    const app = await makeApp(db, broker, router, dir);
    await app.inject({
      method: "POST", url: `/api/deliverables/${delId}/repurpose`,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channels: ["linkedin"] }),
    });

    const newDelegation = db.select().from(delegations).all()
      .find(d => d.toAgent === "content-lead" && d.fromAgent === "human")!;
    expect(newDelegation.campaignId).toBe(campaignId);
  });
});
```

Add `campaigns` and `eq` to imports in `deliverables.test.ts` if not already present.

- [ ] **Step 2: Write failing test for ?campaignId filter on deliverables**

In the same test file, add:

```typescript
describe("GET /api/deliverables?campaignId", () => {
  it("filters deliverables by campaignId", async () => {
    const { db, broker, router, dir } = deps;
    const campaignId = randomUUID();
    db.insert(campaigns).values({ id: campaignId, title: "C", status: "active" }).run();
    const { delId: id1 } = seedDeliverable(db);
    db.update(deliverables).set({ campaignId }).where(eq(deliverables.id, id1)).run();
    seedDeliverable(db); // second deliverable without campaignId

    const app = await makeApp(db, broker, router, dir);
    const res = await app.inject({ method: "GET", url: `/api/deliverables?campaignId=${campaignId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string }[]>();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(id1);
  });
});
```

- [ ] **Step 3: Write failing test for ?campaignId filter on tasks**

In `packages/server/src/server/routes/tasks.test.ts`, add:

```typescript
describe("GET /api/tasks?campaignId", () => {
  it("filters tasks by campaignId", async () => {
    // seed: one task with campaignId, one without
    const campaignId = randomUUID();
    db.insert(campaigns).values({ id: campaignId, title: "C", status: "active" }).run();
    const dlgId1 = randomUUID(); const dlgId2 = randomUUID();
    db.insert(delegations).values({ id: dlgId1, fromAgent: "director", toAgent: "copywriter", status: "requested", payloadJson: {}, campaignId }).run();
    db.insert(delegations).values({ id: dlgId2, fromAgent: "director", toAgent: "copywriter", status: "requested", payloadJson: {} }).run();
    const t1 = randomUUID(); const t2 = randomUUID();
    db.insert(tasks).values({ id: t1, delegationId: dlgId1, title: "Task 1", status: "open", assignedTo: "copywriter", campaignId }).run();
    db.insert(tasks).values({ id: t2, delegationId: dlgId2, title: "Task 2", status: "open", assignedTo: "copywriter" }).run();

    const app = await makeApp(db, broker, router, dir);
    const res = await app.inject({ method: "GET", url: `/api/tasks?campaignId=${campaignId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string }[]>();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(t1);
  });
});
```

(Add `campaigns`, `tasks` to imports in tasks.test.ts if not already there.)

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd packages/server && npm test -- "deliverables.test|tasks.test" 2>&1 | tail -20
```

Expected: FAIL on the new tests.

- [ ] **Step 5: Update deliverables.ts — repurpose propagation + filter**

In `packages/server/src/server/routes/deliverables.ts`:

Change the GET endpoint:
```typescript
app.get<{ Querystring: { campaignId?: string } }>("/api/deliverables", async (req) => {
  let result = opts.db.select().from(deliverables).all();
  if (req.query.campaignId) result = result.filter((d) => d.campaignId === req.query.campaignId);
  return result;
});
```

In the repurpose endpoint, add campaignId propagation after fetching `d`:
```typescript
// After: const d = opts.db.select().from(deliverables)...
// Before: const { channels } = req.body;
const campaignId = d.campaignId ?? null;
```

Then set it on the delegation insert:
```typescript
opts.db.insert(delegations).values({
  id: delegationId,
  fromAgent: "human",
  toAgent: "content-lead",
  status: "requested",
  campaignId,
  payloadJson: { ... } as never,
}).run();
```

- [ ] **Step 6: Update tasks.ts — campaignId filter**

In `packages/server/src/server/routes/tasks.ts`, update the GET handler:

```typescript
app.get<{ Querystring: { assigned_to?: string; status?: string; campaignId?: string } }>("/api/tasks", async (req) => {
  let result = opts.db.select().from(tasks).all();
  if (req.query.assigned_to) result = result.filter((t) => t.assignedTo === req.query.assigned_to);
  if (req.query.status) result = result.filter((t) => t.status === req.query.status);
  if (req.query.campaignId) result = result.filter((t) => t.campaignId === req.query.campaignId);
  return result;
});
```

- [ ] **Step 7: Run all tests**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/server/routes/deliverables.ts packages/server/src/server/routes/tasks.ts
git commit -m "feat: repurpose propagates campaignId; add ?campaignId filter to deliverables and tasks"
```

---

## Task 7: campaigns API routes

**Files:**
- Create: `packages/server/src/server/routes/campaigns.ts`
- Create: `packages/server/src/server/routes/campaigns.test.ts`
- Modify: `packages/server/src/server/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/server/routes/campaigns.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type AgencyDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import { campaigns, delegations, deliverables, tasks } from "../../db/schema.js";
import type { AgentRouter } from "../../broker/router.js";

let dir: string;
let db: AgencyDb;
let close: () => void;
let broker: Broker;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "campaigns-test-"));
  mkdirSync(join(dir, "memory"), { recursive: true });
  ({ db, close } = openDb(join(dir, "test.db")));
  broker = new Broker(db);
});
afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

async function makeApp() {
  return buildServer({ db, broker, router: {} as AgentRouter, dataDir: dir, webRoot: "/nonexistent" });
}

function seedCampaign(title = "Test Campaign") {
  const id = randomUUID();
  db.insert(campaigns).values({ id, title, status: "active" }).run();
  return id;
}

describe("GET /api/campaigns", () => {
  it("returns empty array when no campaigns", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/campaigns" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns campaigns with deliverableCount and taskCount", async () => {
    const campaignId = seedCampaign("My Campaign");
    const dlgId = randomUUID();
    db.insert(delegations).values({ id: dlgId, fromAgent: "director", toAgent: "copywriter", status: "complete", payloadJson: {}, campaignId }).run();
    db.insert(deliverables).values({ id: randomUUID(), delegationId: dlgId, type: "blog_post", title: "Post", status: "shipped", campaignId }).run();
    db.insert(deliverables).values({ id: randomUUID(), delegationId: dlgId, type: "blog_post", title: "Post 2", status: "awaiting_approval", campaignId }).run();
    db.insert(tasks).values({ id: randomUUID(), delegationId: dlgId, title: "Task 1", status: "open", assignedTo: "copywriter", campaignId }).run();

    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/campaigns" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; title: string; deliverableCount: number; taskCount: number; pendingApprovals: number }[]>();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("My Campaign");
    expect(body[0].deliverableCount).toBe(2);
    expect(body[0].taskCount).toBe(1);
    expect(body[0].pendingApprovals).toBe(1);
  });
});

describe("GET /api/campaigns/:id", () => {
  it("returns 404 for unknown campaign", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/campaigns/nonexistent" });
    expect(res.statusCode).toBe(404);
  });

  it("returns campaign with deliverables and tasks arrays", async () => {
    const campaignId = seedCampaign();
    const dlgId = randomUUID();
    db.insert(delegations).values({ id: dlgId, fromAgent: "director", toAgent: "copywriter", status: "complete", payloadJson: {}, campaignId }).run();
    db.insert(deliverables).values({ id: randomUUID(), delegationId: dlgId, type: "blog_post", title: "Post", status: "shipped", campaignId }).run();
    db.insert(tasks).values({ id: randomUUID(), delegationId: dlgId, title: "Task", status: "done", assignedTo: "copywriter", campaignId }).run();

    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: `/api/campaigns/${campaignId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; deliverables: unknown[]; tasks: unknown[] }>();
    expect(body.id).toBe(campaignId);
    expect(body.deliverables).toHaveLength(1);
    expect(body.tasks).toHaveLength(1);
  });
});

describe("PATCH /api/campaigns/:id", () => {
  it("updates title and status", async () => {
    const campaignId = seedCampaign("Old Title");
    const app = await makeApp();
    const res = await app.inject({
      method: "PATCH", url: `/api/campaigns/${campaignId}`,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New Title", status: "completed" }),
    });
    expect(res.statusCode).toBe(200);
    const updated = db.select().from(campaigns).all().find(c => c.id === campaignId)!;
    expect(updated.title).toBe("New Title");
    expect(updated.status).toBe("completed");
  });

  it("returns 404 for unknown campaign", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "PATCH", url: "/api/campaigns/nonexistent",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/server && npm test -- campaigns.test 2>&1 | tail -10
```

Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Create campaigns.ts route file**

Create `packages/server/src/server/routes/campaigns.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { campaigns, deliverables, tasks } from "../../db/schema.js";

export function registerCampaignRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/campaigns", async () => {
		const allCampaigns = opts.db.select().from(campaigns).all();
		const allDeliverables = opts.db.select().from(deliverables).all();
		const allTasks = opts.db.select().from(tasks).all();
		return allCampaigns.map((c) => ({
			...c,
			deliverableCount: allDeliverables.filter((d) => d.campaignId === c.id).length,
			taskCount: allTasks.filter((t) => t.campaignId === c.id).length,
			pendingApprovals: allDeliverables.filter((d) => d.campaignId === c.id && d.status === "awaiting_approval").length,
		}));
	});

	app.get<{ Params: { id: string } }>("/api/campaigns/:id", async (req, reply) => {
		const c = opts.db.select().from(campaigns).where(eq(campaigns.id, req.params.id)).get();
		if (!c) return reply.code(404).send({ error: "not found" });
		const campaignDeliverables = opts.db.select().from(deliverables)
			.where(eq(deliverables.campaignId, req.params.id)).all();
		const campaignTasks = opts.db.select().from(tasks)
			.where(eq(tasks.campaignId, req.params.id)).all();
		return { ...c, deliverables: campaignDeliverables, tasks: campaignTasks };
	});

	app.patch<{ Params: { id: string }; Body: { title?: string; description?: string; status?: string } }>(
		"/api/campaigns/:id",
		async (req, reply) => {
			const c = opts.db.select().from(campaigns).where(eq(campaigns.id, req.params.id)).get();
			if (!c) return reply.code(404).send({ error: "not found" });
			const { title, description, status } = req.body;
			const patch: Partial<{ title: string; description: string | null; status: "active" | "completed" | "archived" }> = {};
			if (title !== undefined) patch.title = title;
			if (description !== undefined) patch.description = description;
			if (status !== undefined) patch.status = status as "active" | "completed" | "archived";
			opts.db.update(campaigns).set(patch).where(eq(campaigns.id, req.params.id)).run();
			return { ok: true };
		},
	);
}
```

- [ ] **Step 4: Register campaigns routes in server/index.ts**

In `packages/server/src/server/index.ts`:

Add import:
```typescript
import { registerCampaignRoutes } from "./routes/campaigns.js";
```

Add registration after `registerStatsRoutes`:
```typescript
registerCampaignRoutes(app, opts);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/server && npm test -- campaigns.test 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 6: Run all tests**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/server/routes/campaigns.ts packages/server/src/server/routes/campaigns.test.ts packages/server/src/server/index.ts
git commit -m "feat: add GET/PATCH /api/campaigns endpoints"
```

---

## Task 8: Web — api.ts + store + App.tsx wiring

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/store/useAgencyStore.ts`
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Add Campaign type and campaigns to useAgencyStore.ts**

Full updated `packages/web/src/store/useAgencyStore.ts`:

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
  campaignId?: string | null;
}

export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  createdAt: string;
  deliverableCount?: number;
  taskCount?: number;
  pendingApprovals?: number;
}

interface AgencyState {
  activeThreadId: string | null;
  drawerOpen: boolean;
  currentView: "home" | "chat" | "deliverable" | "memory" | "onboarding" | "pipeline" | "tasks" | "agents" | "skills" | "calendar" | "campaigns";
  selectedDeliverableId: string | null;
  selectedMemoryFile: string | null;
  tasks: Task[];
  campaigns: Campaign[];
  sidebarCollapsed: boolean;
  activeAgents: string[];
  setActiveThread: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveAgents: (slugs: string[]) => void;
  setView: (view: AgencyState["currentView"]) => void;
  setSelectedDeliverable: (id: string | null) => void;
  setSelectedMemoryFile: (file: string | null) => void;
  setTasks: (tasks: Task[]) => void;
  upsertTask: (task: Task) => void;
  setCampaigns: (campaigns: Campaign[]) => void;
}

export const useAgencyStore = create<AgencyState>((set) => ({
  activeThreadId: null,
  drawerOpen: false,
  currentView: "home",
  selectedDeliverableId: null,
  selectedMemoryFile: null,
  tasks: [],
  campaigns: [],
  sidebarCollapsed: false,
  activeAgents: [],
  setActiveThread: (id) => set({ activeThreadId: id }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setActiveAgents: (slugs) => set({ activeAgents: slugs }),
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
  setCampaigns: (campaigns) => set({ campaigns }),
}));
```

- [ ] **Step 2: Add campaigns API to api.ts**

In `packages/web/src/lib/api.ts`, add to the `api` export object before `snapshot`:

```typescript
campaigns: {
  list: () => fetch("/api/campaigns").then(json) as Promise<import("../store/useAgencyStore").Campaign[]>,
  get: (id: string) => fetch(`/api/campaigns/${id}`).then(json),
  patch: (id: string, body: { title?: string; description?: string; status?: string }) =>
    fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(json),
},
```

- [ ] **Step 3: Add CampaignsView to App.tsx**

In `packages/web/src/App.tsx`, add import:
```typescript
import { CampaignsView } from "./views/campaigns";
```

Add render line inside the return div (after CalendarView line):
```typescript
{currentView === "campaigns" && <CampaignsView />}
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only about missing `CampaignsView` export (not yet created) — no other errors.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/api.ts packages/web/src/store/useAgencyStore.ts packages/web/src/App.tsx
git commit -m "feat: add Campaign type, campaigns api methods, wire campaigns view in App"
```

---

## Task 9: CampaignsView

**Files:**
- Create: `packages/web/src/views/campaigns.tsx`

- [ ] **Step 1: Create campaigns.tsx**

Create `packages/web/src/views/campaigns.tsx`:

```typescript
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Sidebar } from "../components/layout/Sidebar";
import { useBreakpoint } from "../hooks/useBreakpoint";
import type { Campaign } from "../store/useAgencyStore";

const STATUS_COLOR: Record<string, string> = {
  active: "var(--success, #2d7a4f)",
  completed: "var(--ink-2)",
  archived: "var(--ink-3)",
};

interface CampaignDetail extends Campaign {
  deliverables: { id: string; title: string; type: string; status: string }[];
  tasks: { id: string; title: string; status: string; assignedTo: string }[];
}

function CampaignDetailPanel({ campaign, isMobile = false }: { campaign: CampaignDetail; isMobile?: boolean }) {
  const pad = isMobile ? 16 : 32;
  const deliverablesByStatus = campaign.deliverables.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: `0 ${pad}px` }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
          color: STATUS_COLOR[campaign.status] ?? "var(--ink-2)",
          padding: "2px 8px", borderRadius: 3, border: `1px solid currentColor`,
        }}>
          {campaign.status}
        </span>
      </div>

      {campaign.description && (
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 20, lineHeight: 1.5 }}>
          {campaign.description}
        </p>
      )}

      <div style={{ marginBottom: 20 }}>
        <div className="caption" style={{ marginBottom: 8 }}>Deliverables ({campaign.deliverables.length})</div>
        {campaign.deliverables.length === 0
          ? <div style={{ fontSize: 13, color: "var(--ink-3)" }}>None yet</div>
          : Object.entries(deliverablesByStatus).map(([status, count]) => (
            <div key={status} style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>
              {count}× {status.replace(/_/g, " ")}
            </div>
          ))
        }
      </div>

      <div>
        <div className="caption" style={{ marginBottom: 8 }}>Tasks ({campaign.tasks.length})</div>
        {campaign.tasks.length === 0
          ? <div style={{ fontSize: 13, color: "var(--ink-3)" }}>None yet</div>
          : campaign.tasks.slice(0, 8).map((t) => (
            <div key={t.id} style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4, display: "flex", gap: 8 }}>
              <span style={{ color: "var(--ink-3)" }}>{t.assignedTo}</span>
              <span>{t.title}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

export function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"list" | "detail">("list");
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).catch(() => {});
  }, []);

  async function handleSelect(id: string) {
    setLoading(true);
    try {
      const detail = await api.campaigns.get(id);
      setSelected(detail as CampaignDetail);
      if (isMobile) setMobilePanel("detail");
    } finally {
      setLoading(false);
    }
  }

  const listPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {campaigns.length === 0
        ? <div style={{ padding: "40px 20px", color: "var(--ink-3)", fontSize: 13 }}>No campaigns yet. Create a brief to start one.</div>
        : campaigns.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c.id)}
            style={{
              display: "flex", width: "100%", textAlign: "left",
              padding: isMobile ? "14px 16px" : "10px 20px",
              border: "none", borderBottom: "1px solid var(--rule)",
              background: selected?.id === c.id ? "var(--primary-soft)" : "transparent",
              color: selected?.id === c.id ? "var(--primary-deep)" : "var(--ink-1)",
              fontSize: 13, cursor: "pointer",
              justifyContent: "space-between", alignItems: "center", gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {c.deliverableCount ?? 0} deliverable{c.deliverableCount !== 1 ? "s" : ""} · {c.taskCount ?? 0} tasks
                {(c.pendingApprovals ?? 0) > 0 && <span style={{ color: "var(--accent)" }}> · {c.pendingApprovals} pending</span>}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
              color: STATUS_COLOR[c.status] ?? "var(--ink-3)",
            }}>
              {c.status}
            </span>
          </button>
        ))
      }
    </div>
  );

  const detailPanel = selected ? (
    <div>
      {isMobile && (
        <button
          onClick={() => setMobilePanel("list")}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 13, padding: "0 16px", marginBottom: 12 }}
        >
          ← Campaigns
        </button>
      )}
      <h2 className="heading" style={{ padding: `0 ${isMobile ? 16 : 32}px`, marginBottom: 16, fontSize: 18 }}>
        {loading ? "…" : selected.title}
      </h2>
      {!loading && <CampaignDetailPanel campaign={selected} isMobile={isMobile} />}
    </div>
  ) : (
    <div style={{ padding: "40px 32px", color: "var(--ink-3)", fontSize: 13 }}>
      Select a campaign to view details
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="campaigns" />
      <main style={{ flex: 1, overflow: "auto", padding: isMobile ? "20px 0 88px" : "28px 0" }}>
        <h1 className="heading" style={{ padding: `0 ${isMobile ? 16 : 32}px`, marginBottom: 24 }}>Campaigns</h1>

        {isMobile ? (
          mobilePanel === "list" ? listPanel : detailPanel
        ) : (
          <div style={{ display: "flex", gap: 0 }}>
            <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--rule)", overflowY: "auto" }}>
              {listPanel}
            </div>
            <div style={{ flex: 1 }}>{detailPanel}</div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/views/campaigns.tsx
git commit -m "feat: add CampaignsView with list + detail panel"
```

---

## Task 10: Sidebar nav + routing

**Files:**
- Modify: `packages/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add "campaigns" to Sidebar**

In `packages/web/src/components/layout/Sidebar.tsx`:

1. Update the `NavId` type:
```typescript
type NavId = "home" | "pipeline" | "memory" | "tasks" | "agents" | "skills" | "calendar" | "campaigns";
```

2. Add to the `NAV` array, before `{ id: "calendar", label: "Calendar" }`:
```typescript
{ id: "campaigns", label: "Campaigns" },
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/layout/Sidebar.tsx
git commit -m "feat: add Campaigns to sidebar nav"
```

---

## Task 11: Pipeline + Tasks campaign filter dropdown

**Files:**
- Modify: `packages/web/src/views/pipeline.tsx`
- Modify: `packages/web/src/views/tasks.tsx`

- [ ] **Step 1: Add campaign filter to pipeline.tsx**

In `packages/web/src/views/pipeline.tsx`, add state and filter logic. Find the section where `deliverables` state is loaded and the header is rendered.

Add imports at top:
```typescript
import type { Campaign } from "../store/useAgencyStore";
```

Add state after existing state declarations:
```typescript
const [campaigns, setCampaigns] = useState<Campaign[]>([]);
const [campaignFilter, setCampaignFilter] = useState<string>("");
```

In the `useEffect` that loads deliverables, also load campaigns:
```typescript
useEffect(() => {
  api.deliverables.list().then(setDeliverables).catch(() => {});
  api.campaigns.list().then(setCampaigns).catch(() => {});
}, []);
```

Add filter logic after the `deliverables` state is set (in the render, before splitting into columns):
```typescript
const filtered = campaignFilter
  ? deliverables.filter((d) => (d as { campaignId?: string | null }).campaignId === campaignFilter)
  : deliverables;
```

Then use `filtered` instead of `deliverables` when building the columns. Find the line that distributes deliverables into `COLUMNS` (it looks like `COLUMNS.map(col => ({ ...col, items: deliverables.filter(d => d.status === col.status) }))`) and replace `deliverables` with `filtered`.

Add the campaign filter dropdown in the header, right before or after the `<h1>` tag:

```typescript
{campaigns.length > 0 && (
  <select
    value={campaignFilter}
    onChange={(e) => setCampaignFilter(e.target.value)}
    style={{
      padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 4,
      background: "var(--parchment)", fontSize: 12, color: "var(--ink-2)",
      marginLeft: isMobile ? 0 : 16,
    }}
  >
    <option value="">All campaigns</option>
    {campaigns.map((c) => (
      <option key={c.id} value={c.id}>{c.title}</option>
    ))}
  </select>
)}
```

- [ ] **Step 2: Add campaign filter to tasks.tsx**

In `packages/web/src/views/tasks.tsx`, mirror the same pattern:

Add import:
```typescript
import type { Campaign } from "../store/useAgencyStore";
```

Add state:
```typescript
const [campaigns, setCampaigns] = useState<Campaign[]>([]);
const [campaignFilter, setCampaignFilter] = useState<string>("");
```

Load campaigns alongside tasks:
```typescript
useEffect(() => {
  api.tasks.list().then(setTasks).catch(() => {});
  api.campaigns.list().then(setCampaigns).catch(() => {});
}, []);
```

Wait — `tasks.tsx` uses `useAgencyStore` for tasks, not local state. Adjust: load campaigns into local state `useState<Campaign[]>([])`, and filter tasks from the store:

```typescript
const allTasks = useAgencyStore((s) => s.tasks);
const displayTasks = campaignFilter
  ? allTasks.filter((t) => t.campaignId === campaignFilter)
  : allTasks;
```

Replace `allTasks` (or however the tasks are currently used in `COLUMNS.map`) with `displayTasks`.

Add the same dropdown select in the header as pipeline.tsx.

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run server tests one final time**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/views/pipeline.tsx packages/web/src/views/tasks.tsx
git commit -m "feat: add campaign filter dropdown to Pipeline and Tasks views"
```

---

## Self-Review

**Spec coverage check:**
- [x] campaigns table (Task 1)
- [x] briefs.campaignId, delegations.campaignId, deliverables.campaignId, tasks.campaignId, memory_proposals.campaignId (Task 1)
- [x] proposeBrief creates campaign with title (Task 2)
- [x] POST /api/briefs auto-campaign from contentMd (Task 3)
- [x] delegateToLead inherits from brief (Task 4)
- [x] delegateToSpecialist inherits from parent (Task 4)
- [x] submitDeliverable inherits from delegation (Task 5)
- [x] TaskManager inherits from delegation (Task 5)
- [x] repurpose inherits from source deliverable (Task 6)
- [x] GET /api/campaigns with counts (Task 7)
- [x] GET /api/campaigns/:id with deliverables + tasks (Task 7)
- [x] PATCH /api/campaigns/:id (Task 7)
- [x] ?campaignId filter on deliverables (Task 6)
- [x] ?campaignId filter on tasks (Task 6)
- [x] Campaigns nav item (Task 10)
- [x] CampaignsView with list + detail (Task 9)
- [x] Pipeline filter dropdown (Task 11)
- [x] Tasks filter dropdown (Task 11)
- [x] memory_proposals.campaignId schema field — added in Task 1 schema. Note: the `proposeMemoryUpdate` tool does NOT auto-set campaignId (it has no delegation context). The column exists and is nullable; future work can add session-based lookup if needed.

**Type consistency check:** `Campaign` interface defined in Task 8 (`useAgencyStore.ts`), used in Task 9 (`campaigns.tsx`) and Task 11 (`pipeline.tsx`, `tasks.tsx`) — consistent.

**Placeholder scan:** No TBD/TODO in plan. Task 11 step 1 says "find the line that distributes deliverables into COLUMNS" — this is slightly open. The full pipeline.tsx is ~200 lines; the implementer should look for `.filter(d => d.status === col.status)` and wrap `deliverables` with `filtered`.
