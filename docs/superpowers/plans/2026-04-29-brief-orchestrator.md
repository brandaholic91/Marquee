# Brief Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bevezetni egy szerver oldali workflow engine-t, amely explicit fáziskövetéssel irányítja a brief pipeline-okat, kiváltva a jelenlegi ad-hoc, agent-vezérelt re-delegálási logikát.

**Architecture:** A `BriefOrchestrator` osztály figyeli a `brief_dispatched`, `deliverable_submitted` és `approval_decision` eseményeket. Minden brief típushoz (blog_post, linkedin_post, landing_page) egy `WorkflowDef` írja le a lépéseket és az átmeneteket. A futó workflow állapotát az SQLite `workflow_runs` tábla tárolja, így szerver újraindítás után sem veszik el az állapot.

**Tech Stack:** Node.js 22, TypeScript, Fastify 5, SQLite + Drizzle ORM (better-sqlite3), vitest

---

## Fájlstruktúra-áttekintés

### Új fájlok

| Fájl | Felelősség |
|---|---|
| `packages/server/src/workflows/types.ts` | `WorkflowDef`, `WorkflowStep`, `WorkflowContext`, `WorkflowState` interfészek |
| `packages/server/src/workflows/index.ts` | Registry map + `getWorkflow()` + `parseDeliverableType()` |
| `packages/server/src/workflows/blog_post.ts` | SEO (feltételes) → write lépés, jóváhagyással |
| `packages/server/src/workflows/linkedin_post.ts` | Egy write lépés, jóváhagyással |
| `packages/server/src/workflows/landing_page.ts` | SEO (feltételes) → write lépés, jóváhagyással |
| `packages/server/src/broker/orchestrator.ts` | `BriefOrchestrator` osztály |
| `packages/server/src/broker/orchestrator.test.ts` | 6 vitest eset |
| `packages/server/drizzle/0004_workflow_runs.sql` | SQL migráció |

### Módosított fájlok

| Fájl | Változás |
|---|---|
| `packages/server/src/db/schema.ts` | `workflowRuns` tábla hozzáadása |
| `packages/server/drizzle/meta/_journal.json` | Új `0004_workflow_runs` entry |
| `packages/server/src/broker/router.ts` | `queueBrief()`: orchestrátor-first + fallback |
| `packages/server/src/server/routes/approvals.ts` | `onApprovalDecision()` hívás az existing logika után |
| `packages/server/src/broker/eval-trigger.ts` | `onDeliverableShipped()` hívás a deliverable_submitted event után |
| `packages/server/src/server/index.ts` | `ServerOpts.orchestrator` mező |
| `packages/server/src/index.ts` | `BriefOrchestrator` példányosítása és injektálása |

---

## Task 1: Workflow típusok és registry

**Files:**
- Create: `packages/server/src/workflows/types.ts`
- Create: `packages/server/src/workflows/index.ts`
- Create: `packages/server/src/workflows/blog_post.ts`
- Create: `packages/server/src/workflows/linkedin_post.ts`
- Create: `packages/server/src/workflows/landing_page.ts`

- [ ] **Step 1: Hozd létre a `types.ts` fájlt**

```typescript
// packages/server/src/workflows/types.ts

export interface WorkflowState {
  keywords?: string;
  deliverableId?: string;
  [key: string]: unknown;
}

export interface WorkflowContext {
  brief: { id: string; contentMd: string; campaignId: string | null };
  state: WorkflowState;
  retryCount: number;
}

export interface WorkflowStep {
  id: string;
  agent: string;
  taskFn: (ctx: WorkflowContext) => string;
  condition?: (ctx: WorkflowContext) => boolean;
  requiresApproval?: boolean;
  extractOutput?: (artifactContent: string) => Partial<WorkflowState>;
}

export interface WorkflowDef {
  id: string;
  deliverableTypes: string[];
  steps: WorkflowStep[];
}
```

- [ ] **Step 2: Hozd létre a `blog_post.ts` workflow fájlt**

```typescript
// packages/server/src/workflows/blog_post.ts
import type { WorkflowDef } from "./types.js";

export const blogPostWorkflow: WorkflowDef = {
  id: "blog_post",
  deliverableTypes: ["blog_post"],
  steps: [
    {
      id: "seo",
      agent: "insights-lead",
      condition: (ctx) => !ctx.state.keywords,
      taskFn: (ctx) =>
        `Végezz kulcsszókutatást blog_post deliverable-hoz.\nTéma: ${ctx.brief.contentMd.slice(0, 200)}`,
      extractOutput: (artifactContent) => {
        const match = artifactContent.match(
          /\*\*Elsődleges kulcsszó[^:]*\*\*[:\s]+([^\n]+)/
        );
        return { keywords: match?.[1]?.trim() ?? undefined };
      },
    },
    {
      id: "write",
      agent: "content-lead",
      taskFn: (ctx) =>
        [
          `Írj 1 db blog_post deliverable-t.`,
          ctx.state.keywords ? `Elsődleges kulcsszó: ${ctx.state.keywords}` : "",
          `Brief: ${ctx.brief.contentMd}`,
        ]
          .filter(Boolean)
          .join("\n"),
      requiresApproval: true,
    },
  ],
};
```

- [ ] **Step 3: Hozd létre a `linkedin_post.ts` workflow fájlt**

```typescript
// packages/server/src/workflows/linkedin_post.ts
import type { WorkflowDef } from "./types.js";

export const linkedinPostWorkflow: WorkflowDef = {
  id: "linkedin_post",
  deliverableTypes: ["linkedin_post"],
  steps: [
    {
      id: "write",
      agent: "distribution-lead",
      taskFn: (ctx) =>
        `Készíts 1 db linkedin_post deliverable-t.\nBrief: ${ctx.brief.contentMd}`,
      requiresApproval: true,
    },
  ],
};
```

- [ ] **Step 4: Hozd létre a `landing_page.ts` workflow fájlt**

```typescript
// packages/server/src/workflows/landing_page.ts
import type { WorkflowDef } from "./types.js";

export const landingPageWorkflow: WorkflowDef = {
  id: "landing_page",
  deliverableTypes: ["landing_page"],
  steps: [
    {
      id: "seo",
      agent: "insights-lead",
      condition: (ctx) => !ctx.state.keywords,
      taskFn: (ctx) =>
        `Végezz kulcsszókutatást landing_page deliverable-hoz.\nTéma: ${ctx.brief.contentMd.slice(0, 200)}`,
      extractOutput: (artifactContent) => {
        const match = artifactContent.match(
          /\*\*Elsődleges kulcsszó[^:]*\*\*[:\s]+([^\n]+)/
        );
        return { keywords: match?.[1]?.trim() ?? undefined };
      },
    },
    {
      id: "write",
      agent: "content-lead",
      taskFn: (ctx) =>
        [
          `Írj 1 db landing_page deliverable-t.`,
          ctx.state.keywords ? `Elsődleges kulcsszó: ${ctx.state.keywords}` : "",
          `Brief: ${ctx.brief.contentMd}`,
        ]
          .filter(Boolean)
          .join("\n"),
      requiresApproval: true,
    },
  ],
};
```

- [ ] **Step 5: Hozd létre a `workflows/index.ts` registry fájlt**

```typescript
// packages/server/src/workflows/index.ts
import type { WorkflowDef } from "./types.js";
import { blogPostWorkflow } from "./blog_post.js";
import { linkedinPostWorkflow } from "./linkedin_post.js";
import { landingPageWorkflow } from "./landing_page.js";

export type { WorkflowDef, WorkflowStep, WorkflowContext, WorkflowState } from "./types.js";

const ALL_WORKFLOWS: WorkflowDef[] = [
  blogPostWorkflow,
  linkedinPostWorkflow,
  landingPageWorkflow,
];

// Map: deliverableType string → WorkflowDef
const REGISTRY = new Map<string, WorkflowDef>();
for (const wf of ALL_WORKFLOWS) {
  for (const type of wf.deliverableTypes) {
    REGISTRY.set(type.toLowerCase(), wf);
  }
}

export function getWorkflow(deliverableType: string): WorkflowDef | undefined {
  return REGISTRY.get(deliverableType.toLowerCase());
}

export const KNOWN_DELIVERABLE_TYPES = [
  "blog_post",
  "linkedin_post",
  "landing_page",
  "twitter_thread",
  "seo_report",
  "case_study",
  "ad_copy",
  "email",
  "video_script",
  "white_paper",
] as const;

export function parseDeliverableType(contentMd: string): string | null {
  const match = contentMd.match(
    /\b(blog_post|linkedin_post|landing_page|twitter_thread|seo_report|case_study|ad_copy|email|video_script|white_paper)\b/i
  );
  return match?.[1]?.toLowerCase() ?? null;
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/workflows/types.ts \
        packages/server/src/workflows/index.ts \
        packages/server/src/workflows/blog_post.ts \
        packages/server/src/workflows/linkedin_post.ts \
        packages/server/src/workflows/landing_page.ts
git commit -m "feat(workflows): add workflow type definitions, registry, and 3 workflow defs"
```

---

## Task 2: DB séma — workflowRuns tábla

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Create: `packages/server/drizzle/0004_workflow_runs.sql`
- Modify: `packages/server/drizzle/meta/_journal.json`

- [ ] **Step 1: Add `workflowRuns` tábla a `schema.ts`-be**

Nyisd meg a `packages/server/src/db/schema.ts` fájlt. A fájl végéhez, a `taskPendingUpdates` blokk után add hozzá:

```typescript
export const workflowRuns = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  briefId: text("brief_id").notNull().references(() => briefs.id),
  campaignId: text("campaign_id").references(() => campaigns.id),
  workflowId: text("workflow_id").notNull(),
  currentStepId: text("current_step_id").notNull(),
  stateJson: text("state_json", { mode: "json" }).notNull().$defaultFn(() => ({})),
  status: text("status", {
    enum: ["running", "awaiting_approval", "complete", "failed"],
  })
    .notNull()
    .default("running"),
  activeDelegationId: text("active_delegation_id"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});
```

- [ ] **Step 2: Hozd létre a `0004_workflow_runs.sql` migrációs fájlt**

```sql
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`brief_id` text NOT NULL,
	`campaign_id` text,
	`workflow_id` text NOT NULL,
	`current_step_id` text NOT NULL,
	`state_json` text NOT NULL DEFAULT '{}',
	`status` text NOT NULL DEFAULT 'running',
	`active_delegation_id` text,
	`retry_count` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
```

Mentsd ide: `packages/server/drizzle/0004_workflow_runs.sql`

- [ ] **Step 3: Frissítsd a `meta/_journal.json` fájlt**

A meglévő `entries` tömb végéhez add hozzá az új entry-t (az utolsó `}` elé, a tömbön belül):

```json
{
  "idx": 4,
  "version": "6",
  "when": 1777500000000,
  "tag": "0004_workflow_runs",
  "breakpoints": true
}
```

A teljes fájl így nézzen ki:

```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    {
      "idx": 0,
      "version": "6",
      "when": 1777314011788,
      "tag": "0000_init",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "6",
      "when": 1777365143764,
      "tag": "0001_skinny_thunderbird",
      "breakpoints": true
    },
    {
      "idx": 2,
      "version": "6",
      "when": 1777385101119,
      "tag": "0002_late_nico_minoru",
      "breakpoints": true
    },
    {
      "idx": 3,
      "version": "6",
      "when": 1777420000000,
      "tag": "0003_campaigns",
      "breakpoints": true
    },
    {
      "idx": 4,
      "version": "6",
      "when": 1777500000000,
      "tag": "0004_workflow_runs",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 4: Ellenőrizd, hogy a migráció lefut**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
set -a && source .env 2>/dev/null || true && set +a
DATA_DIR=$(mktemp -d) node -e "
const { openDb } = await import('./packages/server/src/db/index.js');
const { db, close } = openDb(process.env.DATA_DIR + '/test.db');
console.log('Migration OK');
close();
" --input-type=module
```

Várható output:
```
Migration OK
```

Ha hiba jelenik meg, ellenőrizd, hogy a `0004_workflow_runs.sql` szintaxisa helyes és a `_journal.json` valid JSON.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/schema.ts \
        packages/server/drizzle/0004_workflow_runs.sql \
        packages/server/drizzle/meta/_journal.json
git commit -m "feat(db): add workflow_runs table and migration 0004"
```

---

## Task 3: BriefOrchestrator osztály — tesztekkel együtt (TDD)

**Files:**
- Create: `packages/server/src/broker/orchestrator.test.ts`
- Create: `packages/server/src/broker/orchestrator.ts`

### Segédtípusok a teszt fájlhoz

A tesztben szükség van egy minimális `Broker` mock-ra és egy valódi in-memory DB-re. A meglévő tesztekből (pl. `manager.test.ts`) látható minta: `openDb()` real DB-vel, `Broker` valódi példányként, a `router`-t pedig `vi.fn()`-nel mockoljuk.

- [ ] **Step 1: Írj failing teszteket az `orchestrator.test.ts`-be**

```typescript
// packages/server/src/broker/orchestrator.test.ts
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs, campaigns, delegations, workflowRuns } from "../db/schema.js";
import { Broker } from "./event-bus.js";
import { BriefOrchestrator } from "./orchestrator.js";
import type { AgentRouter } from "./router.js";

// Minimal router mock — csak a spawnAndPrompt+queueBrief metódusok kellenek
function makeRouter() {
  return {
    spawnAndPrompt: vi.fn(),
    queueBrief: vi.fn(),
    getWarmRoles: vi.fn(() => [
      "director", "content-lead", "distribution-lead", "insights-lead", "eval-judge",
    ]),
  } as unknown as AgentRouter;
}

// Helper: brief + delegation + deliverable létrehozása adott típussal
function insertBrief(db: AgencyDb, contentMd: string, campaignId?: string) {
  const id = randomUUID();
  db.insert(briefs).values({
    id,
    contentMd,
    status: "dispatched",
    campaignId: campaignId ?? null,
  }).run();
  return id;
}

function insertDelegation(
  db: AgencyDb,
  briefId: string,
  fromAgent: string,
  toAgent: string,
  campaignId?: string,
) {
  const id = randomUUID();
  db.insert(delegations).values({
    id,
    briefId,
    fromAgent,
    toAgent,
    status: "in_progress",
    payloadJson: { task: "orchestrator-managed" } as never,
    campaignId: campaignId ?? null,
  }).run();
  return id;
}

describe("BriefOrchestrator", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;
  let broker: Broker;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orchestrator-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    broker = new Broker(db);
  });

  afterEach(() => {
    close();
    rmSync(dir, { recursive: true, force: true });
  });

  // ------------------------------------------------------------------ //
  // Test 1: Ismert deliverable type → workflow_run létrejön + delegation //
  // ------------------------------------------------------------------ //
  it("onBriefDispatched ismert type-nál: workflow_run létrejön és delegation emittálódik", () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);

    const briefId = insertBrief(db, "Írj egy blog_post-ot az AI marketingről.");

    const handled = orchestrator.onBriefDispatched(briefId);

    expect(handled).toBe(true);

    const runs = db.select().from(workflowRuns).all();
    expect(runs).toHaveLength(1);
    expect(runs[0].briefId).toBe(briefId);
    expect(runs[0].workflowId).toBe("blog_post");
    expect(runs[0].status).toBe("running");
    expect(runs[0].currentStepId).toBe("seo"); // első lépés: seo (condition: nincs keywords)

    // A router.spawnAndPrompt-ot meghívta az első lépés agentjével
    expect(router.spawnAndPrompt).toHaveBeenCalledOnce();
  });

  // ------------------------------------------------------------------ //
  // Test 2: Ismeretlen type → false, nincs workflow_run               //
  // ------------------------------------------------------------------ //
  it("onBriefDispatched ismeretlen type-nál: false visszatér, nincs workflow_run", () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);

    const briefId = insertBrief(db, "Valami amihez nincs workflow definitíve.");

    const handled = orchestrator.onBriefDispatched(briefId);

    expect(handled).toBe(false);
    expect(db.select().from(workflowRuns).all()).toHaveLength(0);
    expect(router.spawnAndPrompt).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------ //
  // Test 3: onDeliverableShipped seo lépésnél → kulcsszó kinyerés +    //
  //         következő lépés indul                                       //
  // ------------------------------------------------------------------ //
  it("onDeliverableShipped seo_report-ra: keywords kinyerődik state-be, következő lépés indul", () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);

    const briefId = insertBrief(db, "Írj egy blog_post-ot az AI marketingről.");
    orchestrator.onBriefDispatched(briefId);

    // Szimuláljuk: az seo lépés elkészítette a deliverable-t
    const run = db.select().from(workflowRuns).all()[0]!;
    const delegId = insertDelegation(db, briefId, "orchestrator", "insights-lead");

    // Deliverable és revision létrehozása a DB-ben
    const { deliverables, deliverableRevisions } = await import("../db/schema.js");
    const deliverableId = randomUUID();
    const revisionId = randomUUID();
    const artifactPath = join(dir, "seo_output.md");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      artifactPath,
      "## SEO kutatás\n\n**Elsődleges kulcsszó:** AI marketing automatizálás\n\nFőbb pontok...",
    );
    db.insert(deliverables).values({
      id: deliverableId,
      delegationId: delegId,
      type: "seo_report",
      title: "SEO kutatás",
      status: "shipped",
      currentRevisionId: revisionId,
      campaignId: null,
    }).run();
    db.insert(deliverableRevisions).values({
      id: revisionId,
      deliverableId,
      artifactPath,
      createdByAgent: "seo-analyst",
    }).run();

    // Update the run to tie it to this delegation
    db.update(workflowRuns)
      .set({ activeDelegationId: delegId })
      .where(eq(workflowRuns.id, run.id))
      .run();

    // Trigger
    const handled = orchestrator.onDeliverableShipped(deliverableId);

    expect(handled).toBe(true);

    const updatedRun = db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    expect(updatedRun.currentStepId).toBe("write"); // következő lépésre lépett
    expect((updatedRun.stateJson as { keywords?: string }).keywords).toBe("AI marketing automatizálás");

    // A write lépés agent-jét spawnolja
    expect(router.spawnAndPrompt).toHaveBeenCalledTimes(2); // seo + write
  });

  // ------------------------------------------------------------------ //
  // Test 4: requiresApproval lépésnél status → awaiting_approval       //
  // ------------------------------------------------------------------ //
  it("onDeliverableShipped requiresApproval lépésnél: status → awaiting_approval", () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);

    // linkedin_post: csak egy write lépés requiresApproval=true
    const briefId = insertBrief(db, "Készíts egy linkedin_post-ot.");
    orchestrator.onBriefDispatched(briefId);

    const run = db.select().from(workflowRuns).all()[0]!;
    const delegId = insertDelegation(db, briefId, "orchestrator", "distribution-lead");

    const { deliverables, deliverableRevisions } = await import("../db/schema.js");
    const deliverableId = randomUUID();
    const revisionId = randomUUID();
    const artifactPath = join(dir, "li_output.md");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(artifactPath, "LinkedIn poszt tartalom...");
    db.insert(deliverables).values({
      id: deliverableId,
      delegationId: delegId,
      type: "linkedin_post",
      title: "LinkedIn poszt",
      status: "awaiting_approval",
      currentRevisionId: revisionId,
      campaignId: null,
    }).run();
    db.insert(deliverableRevisions).values({
      id: revisionId,
      deliverableId,
      artifactPath,
      createdByAgent: "distribution-lead",
    }).run();

    db.update(workflowRuns)
      .set({ activeDelegationId: delegId })
      .where(eq(workflowRuns.id, run.id))
      .run();

    orchestrator.onDeliverableShipped(deliverableId);

    const updatedRun = db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    expect(updatedRun.status).toBe("awaiting_approval");
    expect(updatedRun.currentStepId).toBe("write"); // NEM lép a következőre
  });

  // ------------------------------------------------------------------ //
  // Test 5: approved az utolsó lépésnél → complete                     //
  // ------------------------------------------------------------------ //
  it("onApprovalDecision('approved') utolsó lépésnél: status → complete", () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);

    const briefId = insertBrief(db, "Készíts egy linkedin_post-ot.");
    orchestrator.onBriefDispatched(briefId);

    const run = db.select().from(workflowRuns).all()[0]!;
    const delegId = insertDelegation(db, briefId, "orchestrator", "distribution-lead");

    const { deliverables, deliverableRevisions } = await import("../db/schema.js");
    const deliverableId = randomUUID();
    const revisionId = randomUUID();
    const artifactPath = join(dir, "li_approved.md");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(artifactPath, "LinkedIn poszt tartalom...");
    db.insert(deliverables).values({
      id: deliverableId,
      delegationId: delegId,
      type: "linkedin_post",
      title: "LinkedIn poszt",
      status: "awaiting_approval",
      currentRevisionId: revisionId,
      campaignId: null,
    }).run();
    db.insert(deliverableRevisions).values({
      id: revisionId,
      deliverableId,
      artifactPath,
      createdByAgent: "distribution-lead",
    }).run();

    // Seteljük a run-t awaiting_approval-ba manuálisan
    db.update(workflowRuns)
      .set({ activeDelegationId: delegId, status: "awaiting_approval" })
      .where(eq(workflowRuns.id, run.id))
      .run();

    const handled = orchestrator.onApprovalDecision(deliverableId, "approved");

    expect(handled).toBe(true);
    const updatedRun = db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    expect(updatedRun.status).toBe("complete");
  });

  // ------------------------------------------------------------------ //
  // Test 6: requested_changes → retryCount++, ugyanaz a lépés újra    //
  // ------------------------------------------------------------------ //
  it("onApprovalDecision('requested_changes'): retryCount++, ugyanaz a lépés újra fut", () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);

    const briefId = insertBrief(db, "Készíts egy linkedin_post-ot.");
    orchestrator.onBriefDispatched(briefId);

    const run = db.select().from(workflowRuns).all()[0]!;
    const delegId = insertDelegation(db, briefId, "orchestrator", "distribution-lead");

    const { deliverables, deliverableRevisions } = await import("../db/schema.js");
    const deliverableId = randomUUID();
    const revisionId = randomUUID();
    const artifactPath = join(dir, "li_retry.md");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(artifactPath, "LinkedIn poszt tartalom...");
    db.insert(deliverables).values({
      id: deliverableId,
      delegationId: delegId,
      type: "linkedin_post",
      title: "LinkedIn poszt",
      status: "awaiting_approval",
      currentRevisionId: revisionId,
      campaignId: null,
    }).run();
    db.insert(deliverableRevisions).values({
      id: revisionId,
      deliverableId,
      artifactPath,
      createdByAgent: "distribution-lead",
    }).run();

    db.update(workflowRuns)
      .set({ activeDelegationId: delegId, status: "awaiting_approval", retryCount: 0 })
      .where(eq(workflowRuns.id, run.id))
      .run();

    const handled = orchestrator.onApprovalDecision(
      deliverableId,
      "requested_changes",
      "Kérlek rövidítsd meg!",
    );

    expect(handled).toBe(true);
    const updatedRun = db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    expect(updatedRun.retryCount).toBe(1);
    expect(updatedRun.status).toBe("running");
    expect(updatedRun.currentStepId).toBe("write"); // UGYANAZ a lépés

    // Újra spawnolja az agentet
    expect(router.spawnAndPrompt).toHaveBeenCalledTimes(2); // első dispatch + retry
  });
});
```

- [ ] **Step 2: Futtasd a teszteket — elvárt hogy mind fail-eljenek (modul nem létezik)**

```bash
cd /home/brandaholic/Projects/Homelab/marquee/packages/server
npx vitest run src/broker/orchestrator.test.ts 2>&1 | head -40
```

Várható output: `Cannot find module '../broker/orchestrator.js'` vagy hasonló import hiba.

- [ ] **Step 3: Implementáld a `BriefOrchestrator` osztályt**

```typescript
// packages/server/src/broker/orchestrator.ts
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import {
  briefs,
  campaigns,
  delegations,
  deliverables,
  deliverableRevisions,
  workflowRuns,
} from "../db/schema.js";
import type { Broker } from "./event-bus.js";
import type { AgentRouter } from "./router.js";
import { getWorkflow, parseDeliverableType } from "../workflows/index.js";
import type { WorkflowContext, WorkflowDef, WorkflowStep, WorkflowState } from "../workflows/types.js";

// Type alias a DB sorhoz
type WorkflowRunRow = typeof workflowRuns.$inferSelect;

export class BriefOrchestrator {
  constructor(
    private db: AgencyDb,
    private broker: Broker,
    private router: AgentRouter,
  ) {}

  // ------------------------------------------------------------------ //
  // Publikus — integrációs pontok hívják                                //
  // ------------------------------------------------------------------ //

  /**
   * Megvizsgálja a brief típusát és elindítja a workflow-t, ha van regisztrált def.
   * @returns true ha az orchestrátor kezeli, false ha nem (fallback a régi logikára)
   */
  onBriefDispatched(briefId: string): boolean {
    const brief = this.db.select().from(briefs).where(eq(briefs.id, briefId)).get();
    if (!brief) return false;

    const deliverableType = parseDeliverableType(brief.contentMd);
    if (!deliverableType) return false;

    const workflow = getWorkflow(deliverableType);
    if (!workflow) return false;

    // Workflow futás létrehozása az első lépéssel
    const firstStep = this.getFirstActiveStep(workflow, {
      brief: this.getBriefContext(brief),
      state: {},
      retryCount: 0,
    });
    if (!firstStep) return false;

    const runId = randomUUID();
    this.db.insert(workflowRuns).values({
      id: runId,
      briefId,
      campaignId: brief.campaignId ?? null,
      workflowId: workflow.id,
      currentStepId: firstStep.id,
      stateJson: {} as never,
      status: "running",
      retryCount: 0,
    }).run();

    const run = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).get()!;
    this.executeStep(run, firstStep);
    return true;
  }

  /**
   * Deliverable shipped eseményre reagál.
   * Ha az aktív run lépéséhez van extractOutput, kinyeri az adatot és továbblép.
   * Ha requiresApproval, awaiting_approval-ba kerül.
   * @returns true ha az orchestrátor kezelt, false ha ismeretlen
   */
  onDeliverableShipped(deliverableId: string): boolean {
    const run = this.findRunByActiveDelegation(deliverableId);
    if (!run) return false;
    if (run.status !== "running") return false;

    const workflow = getWorkflow(run.workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find((s) => s.id === run.currentStepId);
    if (!step) return false;

    // extractOutput: kinyeri az adatot az artifact tartalmából
    let updatedState: WorkflowState = run.stateJson as WorkflowState;
    if (step.extractOutput) {
      const content = this.readDeliverableContent(deliverableId);
      const extracted = step.extractOutput(content);
      updatedState = { ...updatedState, ...extracted };
      this.db.update(workflowRuns)
        .set({ stateJson: updatedState as never, updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id))
        .run();
    }

    if (step.requiresApproval) {
      this.db.update(workflowRuns)
        .set({ status: "awaiting_approval", updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id))
        .run();
      return true;
    }

    // Nincs approval szükséges → továbblép
    const updatedRun = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    this.advanceRun(updatedRun);
    return true;
  }

  /**
   * Approval döntést kezel.
   * approved → advanceRun (következő lépés vagy complete)
   * rejected → failed
   * requested_changes → retryCount++, ugyanaz a lépés újra
   * @returns true ha az orchestrátor kezelt, false ha ismeretlen
   */
  onApprovalDecision(deliverableId: string, decision: string, note?: string): boolean {
    const run = this.findRunByActiveDelegation(deliverableId);
    if (!run) return false;
    if (run.status !== "awaiting_approval") return false;

    if (decision === "approved") {
      this.advanceRun(run);
      return true;
    }

    if (decision === "rejected") {
      this.db.update(workflowRuns)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id))
        .run();
      return true;
    }

    if (decision === "requested_changes") {
      const newRetryCount = run.retryCount + 1;
      this.db.update(workflowRuns)
        .set({ status: "running", retryCount: newRetryCount, updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id))
        .run();

      const workflow = getWorkflow(run.workflowId);
      if (!workflow) return false;
      const step = workflow.steps.find((s) => s.id === run.currentStepId);
      if (!step) return false;

      const updatedRun = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
      const ctx = this.buildContext(updatedRun);
      const retryTask = note
        ? `${step.taskFn(ctx)}\n\n**Visszajelzés:** ${note}`
        : step.taskFn(ctx);

      this.spawnDelegation(updatedRun, step.agent, retryTask);
      return true;
    }

    return false;
  }

  // ------------------------------------------------------------------ //
  // Privát — belső logika                                               //
  // ------------------------------------------------------------------ //

  /**
   * Megkeresi a következő aktív (condition = true / nincs condition) lépést
   * az aktuális után, és elindítja. Ha nincs több lépés → complete.
   */
  private advanceRun(run: WorkflowRunRow): void {
    const workflow = getWorkflow(run.workflowId);
    if (!workflow) return;

    const ctx = this.buildContext(run);
    const currentIdx = workflow.steps.findIndex((s) => s.id === run.currentStepId);
    const remaining = workflow.steps.slice(currentIdx + 1);

    for (const step of remaining) {
      if (step.condition && !step.condition(ctx)) continue; // skip
      // Van következő lépés
      this.db.update(workflowRuns)
        .set({ currentStepId: step.id, status: "running", updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id))
        .run();
      const updatedRun = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
      this.executeStep(updatedRun, step);
      return;
    }

    // Nincs több lépés → complete
    this.db.update(workflowRuns)
      .set({ status: "complete", updatedAt: new Date() })
      .where(eq(workflowRuns.id, run.id))
      .run();
  }

  /**
   * Egy lépés végrehajtása: delegáció létrehozása + agent spawning.
   */
  private executeStep(run: WorkflowRunRow, step: WorkflowStep): void {
    const ctx = this.buildContext(run);
    const taskText = step.taskFn(ctx);
    this.spawnDelegation(run, step.agent, taskText);
  }

  /**
   * Delegáció létrehozása DB-ben + agent spawning a routeren keresztül.
   */
  private spawnDelegation(run: WorkflowRunRow, agentRole: string, taskText: string): void {
    const delegationId = randomUUID();
    this.db.insert(delegations).values({
      id: delegationId,
      briefId: run.briefId,
      fromAgent: "orchestrator",
      toAgent: agentRole,
      status: "in_progress",
      payloadJson: { task: taskText } as never,
      campaignId: run.campaignId ?? null,
    }).run();

    // activeDelegationId frissítése — így tudjuk később visszakeresni a run-t
    this.db.update(workflowRuns)
      .set({ activeDelegationId: delegationId, updatedAt: new Date() })
      .where(eq(workflowRuns.id, run.id))
      .run();

    this.router.spawnAndPrompt(agentRole, delegationId, taskText);
  }

  /**
   * Megkeresi a WorkflowRun-t az activeDelegationId-n keresztül.
   * A deliverable → delegation → workflowRun láncon navigál.
   */
  private findRunByActiveDelegation(deliverableId: string): WorkflowRunRow | undefined {
    const deliverable = this.db
      .select()
      .from(deliverables)
      .where(eq(deliverables.id, deliverableId))
      .get();
    if (!deliverable) return undefined;

    return this.db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.activeDelegationId, deliverable.delegationId))
      .get();
  }

  /**
   * Megkeresi az első lépést, amelynek condition-je true (vagy nincs condition).
   */
  private getFirstActiveStep(
    workflow: WorkflowDef,
    ctx: WorkflowContext,
  ): WorkflowStep | undefined {
    return workflow.steps.find((s) => !s.condition || s.condition(ctx));
  }

  /**
   * WorkflowContext összeállítása a run aktuális állapotából.
   */
  private buildContext(run: WorkflowRunRow): WorkflowContext {
    const brief = this.db.select().from(briefs).where(eq(briefs.id, run.briefId)).get();
    return {
      brief: brief
        ? { id: brief.id, contentMd: brief.contentMd, campaignId: brief.campaignId ?? null }
        : { id: run.briefId, contentMd: "", campaignId: null },
      state: (run.stateJson ?? {}) as WorkflowState,
      retryCount: run.retryCount,
    };
  }

  /**
   * Brief context kinyerése a getBriefContext híváshoz (csak a briefs táblából).
   */
  private getBriefContext(
    brief: typeof briefs.$inferSelect,
  ): WorkflowContext["brief"] {
    return {
      id: brief.id,
      contentMd: brief.contentMd,
      campaignId: brief.campaignId ?? null,
    };
  }

  /**
   * Deliverable artifact tartalmának beolvasása fájlrendszerből.
   */
  private readDeliverableContent(deliverableId: string): string {
    const deliverable = this.db
      .select()
      .from(deliverables)
      .where(eq(deliverables.id, deliverableId))
      .get();
    if (!deliverable?.currentRevisionId) return "";

    const rev = this.db
      .select()
      .from(deliverableRevisions)
      .where(eq(deliverableRevisions.id, deliverable.currentRevisionId))
      .get();
    if (!rev?.artifactPath) return "";

    try {
      return readFileSync(rev.artifactPath, "utf8");
    } catch {
      return "";
    }
  }
}
```

- [ ] **Step 4: Futtasd a teszteket — elvárt hogy mind pass-oljon**

```bash
cd /home/brandaholic/Projects/Homelab/marquee/packages/server
npx vitest run src/broker/orchestrator.test.ts
```

Várható output:
```
 ✓ src/broker/orchestrator.test.ts (6)
   ✓ BriefOrchestrator > onBriefDispatched ismert type-nál: workflow_run létrejön és delegation emittálódik
   ✓ BriefOrchestrator > onBriefDispatched ismeretlen type-nál: false visszatér, nincs workflow_run
   ✓ BriefOrchestrator > onDeliverableShipped seo_report-ra: keywords kinyerődik state-be, következő lépés indul
   ✓ BriefOrchestrator > onDeliverableShipped requiresApproval lépésnél: status → awaiting_approval
   ✓ BriefOrchestrator > onApprovalDecision('approved') utolsó lépésnél: status → complete
   ✓ BriefOrchestrator > onApprovalDecision('requested_changes'): retryCount++, ugyanaz a lépés újra fut

 Test Files  1 passed (1)
 Tests       6 passed (6)
```

Ha bármelyik teszt fail-el, ellenőrizd:
- A `workflowRuns` export megvan-e a `schema.ts`-ben
- A `router.spawnAndPrompt` hozzáférhető-e az `AgentRouter`-en (jelenlegi scope: `private` → **ezt publikussá kell tenni**, lásd Task 4)

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/broker/orchestrator.ts \
        packages/server/src/broker/orchestrator.test.ts
git commit -m "feat(orchestrator): add BriefOrchestrator with 6 passing tests"
```

---

## Task 4: AgentRouter.spawnAndPrompt elérhetővé tétele

**Files:**
- Modify: `packages/server/src/broker/router.ts`

A `BriefOrchestrator` szükségessé teszi, hogy a `router.spawnAndPrompt()` publikus legyen. Jelenleg `private`. A `queueBrief()` metódusban is bevezeti az orchestrator-first mintát.

- [ ] **Step 1: Tegyük publikussá a `spawnAndPrompt` metódust**

A `packages/server/src/broker/router.ts` fájlban keresd meg a sort:

```typescript
	private spawnAndPrompt(role: string, delegationId: string, userMessage: string): void {
```

Változtasd erre:

```typescript
	spawnAndPrompt(role: string, delegationId: string, userMessage: string): void {
```

- [ ] **Step 2: Módosítsd a `queueBrief()` metódust orchestrator-first fallback-kel**

A `queueBrief` metódus jelenleg:

```typescript
	queueBrief(briefId: string): void {
		const brief = this.db.select().from(briefs).where(eq(briefs.id, briefId)).get();
		if (!brief) {
			console.error("queueBrief: brief not found", briefId);
			return;
		}
		const director = this.warmAgents.get("director");
		if (!director) {
			console.error("queueBrief: director agent not initialized");
			return;
		}
		const userMessage = [
			"## New Brief",
			`Brief ID: ${briefId}`,
			"",
			brief.contentMd ?? "",
		].join("\n");
		director.prompt(userMessage).catch(console.error);
	}
```

Cseréld le erre (az `orchestrator` opcionális mezőt a konstruktor NEM kapja, hanem setter-rel vagy a `boot()` előtt injectable):

```typescript
	private orchestrator?: { onBriefDispatched: (briefId: string) => boolean };

	setOrchestrator(orchestrator: { onBriefDispatched: (briefId: string) => boolean }): void {
		this.orchestrator = orchestrator;
	}

	queueBrief(briefId: string): void {
		const brief = this.db.select().from(briefs).where(eq(briefs.id, briefId)).get();
		if (!brief) {
			console.error("queueBrief: brief not found", briefId);
			return;
		}

		// Orchestrator-first: ha van regisztrált workflow, az kezeli
		if (this.orchestrator?.onBriefDispatched(briefId)) {
			return;
		}

		// Fallback: régi director prompt logika
		const director = this.warmAgents.get("director");
		if (!director) {
			console.error("queueBrief: director agent not initialized");
			return;
		}
		const userMessage = [
			"## New Brief",
			`Brief ID: ${briefId}`,
			"",
			brief.contentMd ?? "",
		].join("\n");
		director.prompt(userMessage).catch(console.error);
	}
```

- [ ] **Step 3: Ellenőrizd, hogy a meglévő tesztek zöldek maradnak**

```bash
cd /home/brandaholic/Projects/Homelab/marquee/packages/server
npx vitest run
```

Várható output: minden meglévő teszt zöld, az orchestrator tesztek is zöldek.

```
 Test Files  X passed (X)
 Tests       Y passed (Y)
```

Ha `spawnAndPrompt` láthatóság miatt fail-el valamelyik teszt, ellenőrizd az összes helyet ahol hivatkoznak rá.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/broker/router.ts
git commit -m "feat(router): make spawnAndPrompt public, add orchestrator-first queueBrief fallback"
```

---

## Task 5: Integrációs pontok bekötése

**Files:**
- Modify: `packages/server/src/broker/eval-trigger.ts`
- Modify: `packages/server/src/server/routes/approvals.ts`
- Modify: `packages/server/src/server/index.ts`
- Modify: `packages/server/src/index.ts`

### 5a: eval-trigger.ts — onDeliverableShipped hívás

- [ ] **Step 1: Add hozzá az orchestrator opcionális paramétert az `EvalTrigger`-hez**

A `packages/server/src/broker/eval-trigger.ts` fájlban a konstruktor `opts` object-et kap. Adj hozzá egy opcionális `orchestrator` mezőt.

Keresd meg:
```typescript
export class EvalTrigger {
	private unsub?: () => void;

	constructor(
		private db: AgencyDb,
		private broker: Broker,
		private dataDir: string,
		private authManager?: AuthManager,
	) {}
```

Cseréld le:
```typescript
export interface EvalTriggerOpts {
	authManager?: AuthManager;
	orchestrator?: { onDeliverableShipped: (deliverableId: string) => boolean };
}

export class EvalTrigger {
	private unsub?: () => void;

	constructor(
		private db: AgencyDb,
		private broker: Broker,
		private dataDir: string,
		private opts: EvalTriggerOpts = {},
	) {}
```

- [ ] **Step 2: Hívd meg az orchestratort a deliverable_submitted event kezelőjének VÉGÉN**

Az `attach()` metódusban, az `agent.prompt(userMessage).catch(console.error);` sor UTÁN add hozzá:

```typescript
			// Orchestrator értesítése: lehet hogy ez az ő managelt deliverable-ja
			// A hívás idempotens — ha az orchestrátor nem ismeri, false-t ad vissza
			this.opts.orchestrator?.onDeliverableShipped(deliverableId);
```

A teljes `attach()` eseménykezelő a változtatás után (a releváns rész):

```typescript
			agent.prompt(userMessage).catch(console.error);

			// Orchestrator értesítése: lehet hogy ez az ő managelt deliverable-ja
			this.opts.orchestrator?.onDeliverableShipped(deliverableId);
```

- [ ] **Step 3: Frissítsd az `authManager`-es hivatkozásokat a `makeAgent` hívásban**

Az `EvalTrigger` belső `makeAgent` hívásában az `authManager`-t az `opts`-ból vesszük:

Keresd meg:
```typescript
			role: "eval-judge",
				dataDir: this.dataDir,
				db: this.db,
				sessionId,
				authManager: this.authManager,
```

Cseréld le:
```typescript
			role: "eval-judge",
				dataDir: this.dataDir,
				db: this.db,
				sessionId,
				authManager: this.opts.authManager,
```

### 5b: approvals.ts — onApprovalDecision hívás

- [ ] **Step 4: Bővítsd a `ServerOpts` interfészt orchestrator mezővel**

A `packages/server/src/server/index.ts` fájlban a `ServerOpts` interfészhez add hozzá:

```typescript
export interface ServerOpts {
	db: AgencyDb;
	broker: Broker;
	router: AgentRouter;
	dataDir: string;
	webRoot: string;
	cronManager?: CronManager;
	orchestrator?: {
		onApprovalDecision: (deliverableId: string, decision: string, note?: string) => boolean;
	};
}
```

- [ ] **Step 5: Hívd meg az orchestratort az `approvals.ts` végén**

A `packages/server/src/server/routes/approvals.ts` fájlban a route handler végén, közvetlenül a `opts.broker.emit("approval_decision", ...)` sor ELŐTT add hozzá:

```typescript
		// Orchestrator értesítése — ha az övé a deliverable, ő kezeli az átmenetet
		opts.orchestrator?.onApprovalDecision(id, decision, note);
```

A fájl végén lévő blokk a változtatás után:

```typescript
		// Orchestrator értesítése — ha az övé a deliverable, ő kezeli az átmenetet
		opts.orchestrator?.onApprovalDecision(id, decision, note);
		opts.broker.emit("approval_decision", { deliverableId: id, decision, note });
		return { ok: true };
```

### 5c: index.ts — BriefOrchestrator példányosítása

- [ ] **Step 6: Példányosítsd és kösd be az orchestratort a szerver belépési pontján**

A `packages/server/src/index.ts` fájlban:

1. Add hozzá az importot a többi broker import mellé:
```typescript
import { BriefOrchestrator } from "./broker/orchestrator.js";
```

2. A `router.boot()` sor UTÁN add hozzá:
```typescript
	const orchestrator = new BriefOrchestrator(db, broker, router);
	router.setOrchestrator(orchestrator);
```

3. Az `EvalTrigger` példányosítását frissítsd (add át az `orchestrator`-t):
```typescript
	const evalTrigger = new EvalTrigger(db, broker, dataDir, {
		authManager,
		orchestrator,
	});
```

4. A `buildServer` hívásba add át az `orchestrator`-t:
```typescript
	const app = await buildServer({ db, broker, router, dataDir, webRoot, cronManager, orchestrator });
```

- [ ] **Step 7: Futtasd az összes tesztet**

```bash
cd /home/brandaholic/Projects/Homelab/marquee/packages/server
npx vitest run
```

Várható output:
```
 Test Files  X passed (X)
 Tests       Y passed (Y)
 Duration    ...
```

Ha `EvalTrigger` konstruktor hívás hibát ad (pl. `manager.test.ts` vagy más fájl ahol `EvalTrigger`-t instantiálnak), frissítsd azokat is az új signature-re. A `authManager`-t most `opts.authManager`-ként kell átadni:
```typescript
// Régi:
new EvalTrigger(db, broker, dataDir, authManager)
// Új:
new EvalTrigger(db, broker, dataDir, { authManager })
```

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/broker/eval-trigger.ts \
        packages/server/src/server/routes/approvals.ts \
        packages/server/src/server/index.ts \
        packages/server/src/index.ts
git commit -m "feat(integration): wire BriefOrchestrator into eval-trigger, approvals, and server entrypoint"
```

---

## Task 6: Teljes test suite ellenőrzés

**Files:**
- (nem hoz létre új fájlt — csak ellenőrző lépés)

- [ ] **Step 1: Futtasd az összes tesztet**

```bash
cd /home/brandaholic/Projects/Homelab/marquee/packages/server
npx vitest run --reporter=verbose
```

Várható output (minden teszt zöld):
```
 ✓ src/db/index.test.ts (1)
 ✓ src/db/schema.test.ts (X)
 ✓ src/db/queries.test.ts (X)
 ✓ src/tasks/manager.test.ts (5)
 ✓ src/tools/delegation.test.ts (X)
 ✓ src/broker/orchestrator.test.ts (6)

 Test Files  X passed (X)
 Tests       Y passed (Y)
```

Ha bármelyik teszt megtörik:

- `Cannot find 'workflowRuns'` → ellenőrizd, hogy a `schema.ts`-ben exportált a tábla
- `EvalTrigger constructor` hiba → lásd a Task 5 Step 7-es megjegyzését
- `spawnAndPrompt is not a function` → ellenőrizd, hogy a `private` kulcsszót eltávolítottad

- [ ] **Step 2: TypeScript build ellenőrzés**

```bash
cd /home/brandaholic/Projects/Homelab/marquee/packages/server
npx tsc --noEmit 2>&1 | head -60
```

Várható output: semmi (0 error). Ha van hiba, javítsd a típushibákat (leggyakoribb: `AgentRouter.spawnAndPrompt` public, `EvalTrigger` új konstruktor signature).

- [ ] **Step 3: Commit**

```bash
git add -p  # csak ha van valami nem staged
git commit -m "test: verify all tests pass after orchestrator integration" --allow-empty
```

Ha nincs unstaged változás, ezt a commit-ot kihagyhatod.

---

## Önellenőrző lista

### Spec lefedettség

| Spec követelmény | Task |
|---|---|
| `WorkflowDef`, `WorkflowStep`, `WorkflowContext`, `WorkflowState` típusok | Task 1 |
| `blog_post` workflow (seo feltételes + write) | Task 1 |
| `linkedin_post` workflow (write jóváhagyással) | Task 1 |
| `landing_page` workflow (seo feltételes + write) | Task 1 |
| Registry + `getWorkflow()` + `parseDeliverableType()` | Task 1 |
| `workflowRuns` tábla DB séma | Task 2 |
| `0004_workflow_runs.sql` migráció | Task 2 |
| `_journal.json` frissítés (timestamp: 1777500000000) | Task 2 |
| `BriefOrchestrator.onBriefDispatched()` → bool | Task 3 |
| `BriefOrchestrator.onDeliverableShipped()` → bool | Task 3 |
| `BriefOrchestrator.onApprovalDecision()` → bool | Task 3 |
| `advanceRun`, `executeStep`, `getBriefContext` privát metódusok | Task 3 |
| `router.queueBrief()` orchestrator-first + fallback | Task 4 |
| `approvals.ts` orchestrátor hívás AFTER existing logika | Task 5 |
| `eval-trigger.ts` `onDeliverableShipped()` hívás | Task 5 |
| `index.ts` orchestrátor példányosítás + injektálás | Task 5 |
| 6 teszt eset (T1–T6) | Task 3 |
| Összes meglévő teszt zöld marad | Task 6 |

### Visszafelé kompatibilitás

- `queueBrief()` fallback: ha `onBriefDispatched` false → régi director prompt fut. Nincs breaking change.
- `approvals.ts`: az orchestrátor hívás ADDITÍV, az existing logika (delegation re-trigger, brief done) változatlan marad.
- `eval-trigger.ts`: az orchestrátor hívás a meglévő eval-judge spawning UTÁN van, nem helyette.
- Az összes jelenlegi teszt változatlan API-t lát — a `spawnAndPrompt` public-ra változtatása nem töri a meglévő teszteket (a mock `vi.fn()`-ek nem vizsgálnak láthatóságot).
