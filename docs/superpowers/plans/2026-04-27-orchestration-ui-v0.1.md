# Orchestration UI v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.1 agency orchestration UI replacing WUPHF: Node backend on `pi-agent-core` with 4 active roles (Director, Content Lead, Copywriter, Eval Judge), React+Vite SPA dashboard, SQLite + markdown/git memory persistence, deployed on VM 260 (192.168.2.60). Single end-to-end blog post deliverable flows through chat-intake → delegation → drafting → eval → approval → shipped.

**Architecture:** Single Node process owns all agents (long-lived Director/Lead/Eval, spawn-per-task Copywriter), exposes HTTP REST + SSE; React SPA connects via SSE for live event feed and REST POST for actions; SQLite WAL stores runtime state, markdown/git stores curated memory. pi-agent-core is the agent runtime; Hermes is fully removed.

**Tech Stack:** Node.js 22 LTS, TypeScript 5.x, `pi-agent-core` + `pi-ai` (`opencode-go` provider), Fastify 5, `better-sqlite3` + Drizzle ORM, Vite 5, React 19, Tailwind 3, shadcn/ui, vitest, Biome (formatter/linter, matching pi-mono), systemd

**Spec reference:** `docs/superpowers/specs/2026-04-27-orchestration-ui-design.md`

---

## Task map

| # | Task | Files |
|---|---|---|
| 1 | Pick name + scaffold monorepo | new |
| 2 | Backend deps + Biome + vitest | `package.json`, `biome.json` |
| 3 | SQLite schema (Drizzle) | `packages/server/src/db/schema.ts` |
| 4 | Drizzle migrations + WAL init | `packages/server/src/db/index.ts` |
| 5 | Dashboard query helpers | `packages/server/src/db/queries.ts` |
| 6 | Custom AgentMessage types | `packages/server/src/agents/messages.ts` |
| 7 | `convertToLlm` implementation | `packages/server/src/agents/convert-to-llm.ts` |
| 8 | Provider config + model registry | `packages/server/src/providers/index.ts` |
| 9 | Memory read + frontmatter | `packages/server/src/memory/read.ts` |
| 10 | Mustache template interpolation | `packages/server/src/memory/template.ts` |
| 11 | Memory write (git atomic patch) | `packages/server/src/memory/write.ts` |
| 12 | Skill recipe loader | `packages/server/src/skills/loader.ts` |
| 13 | Write 5 skill recipe markdown files | `packages/server/src/skills/recipes/*.md` |
| 14 | `transformContext` hook | `packages/server/src/agents/transform-context.ts` |
| 15 | Protocol tools — delegation | `packages/server/src/tools/delegation.ts` |
| 16 | Protocol tools — deliverables | `packages/server/src/tools/deliverables.ts` |
| 17 | Protocol tools — proposals | `packages/server/src/tools/proposals.ts` |
| 18 | Protocol tools — misc + eval | `packages/server/src/tools/misc.ts` |
| 19 | Integration tools | `packages/server/src/tools/integration.ts` |
| 20 | Tool registry per role | `packages/server/src/tools/registry.ts` |
| 21 | Agent factory + role registry | `packages/server/src/agents/factory.ts` |
| 22 | Broker — event bus + persistence | `packages/server/src/broker/event-bus.ts` |
| 23 | Broker — routing + lifecycle | `packages/server/src/broker/router.ts` |
| 24 | Broker — boot recovery | `packages/server/src/broker/recovery.ts` |
| 25 | Telemetry + budget guard | `packages/server/src/telemetry/index.ts` |
| 26 | Eval Judge auto-trigger | `packages/server/src/broker/eval-trigger.ts` |
| 27 | Fastify server + REST routes | `packages/server/src/server/index.ts` |
| 28 | SSE endpoint + snapshot | `packages/server/src/server/sse.ts` |
| 29 | Smoke test script | `packages/server/scripts/smoke.ts` |
| 30 | Frontend bootstrap | `packages/web/` |
| 31 | Frontend — API + SSE client | `packages/web/src/lib/{api,sse}.ts` |
| 32 | Frontend — Onboarding chat | `packages/web/src/views/onboarding.tsx` |
| 33 | Frontend — Home dashboard | `packages/web/src/views/home.tsx` |
| 34 | Frontend — Chat drawer + full view | `packages/web/src/components/chat/*` |
| 35 | Frontend — Deliverable detail | `packages/web/src/views/deliverable.tsx` |
| 36 | Frontend — Memory editor | `packages/web/src/views/memory.tsx` |
| 37 | systemd unit + deploy script | `infra/marquee.service`, `scripts/deploy.sh` |

---

## Task 1: Pick final name + scaffold monorepo

**Files:**
- Create: `~/Projects/Homelab/<name>/` (root)
- Create: `~/Projects/Homelab/<name>/{package.json,tsconfig.json,biome.json,.gitignore}`
- Create: `~/Projects/Homelab/<name>/packages/{server,web}/` subdirs

- [x] **Name locked: `marquee`** (decided 2026-04-27 — theater marquee metaphor, "what goes on the marquee for marketing"). Drives repo name, npm package names, default port banner, systemd unit name.

- [ ] **Create monorepo root**

```bash
mkdir -p ~/Projects/Homelab/marquee/packages/{server,web}
cd ~/Projects/Homelab/marquee
git init
```

- [ ] **Copy DESIGN.md into the marquee repo root**

```bash
cp ~/Projects/Homelab/docs/superpowers/specs/2026-04-27-marquee-design.md \
   ~/Projects/Homelab/marquee/DESIGN.md
```

This DESIGN.md drives the visual grammar for Tasks 30-36 (frontend). It's also consumed by `npx @google/design.md lint DESIGN.md` for token validation. Verify after copy:

```bash
cd ~/Projects/Homelab/marquee
npx -y @google/design.md lint DESIGN.md
```

Expected: 0 errors, ~7 warnings (all of type "color defined but unreferenced by component" — intentional; these colors are used as Tailwind border/text utilities not modeled in the design.md component schema).

- [ ] **Root `package.json` (workspaces)**

`~/Projects/Homelab/marquee/package.json`:

```json
{
  "name": "marquee-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "check": "biome check .",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.6.3"
  },
  "engines": { "node": ">=22.0.0" }
}
```

- [ ] **Root `tsconfig.json`** (extended by packages)

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Root `biome.json`** (matches pi-mono style)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 120
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": { "formatter": { "quoteStyle": "double" } }
}
```

- [ ] **`.gitignore`**

```
node_modules/
dist/
*.tsbuildinfo
.env
.env.local
~/.marquee/state.db*
.DS_Store
```

- [ ] **Initial commit**

```bash
git add .
git commit -m "chore: scaffold marquee monorepo"
```

---

## Task 2: Backend package — deps, vitest, scripts

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/vitest.config.ts`
- Create: `packages/server/src/index.ts` (placeholder)

- [ ] **`packages/server/package.json`**

```json
{
  "name": "@marquee/server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "smoke": "tsx scripts/smoke.ts"
  },
  "dependencies": {
    "@mariozechner/pi-agent-core": "^0.x",
    "@mariozechner/pi-ai": "^0.x",
    "fastify": "^5.0.0",
    "@fastify/static": "^8.0.0",
    "@fastify/cors": "^10.0.0",
    "better-sqlite3": "^11.5.0",
    "drizzle-orm": "^0.36.0",
    "gray-matter": "^4.0.3",
    "simple-git": "^3.27.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Pin pi-agent-core and pi-ai to actual current versions**

```bash
cd packages/server
npm view @mariozechner/pi-agent-core version
npm view @mariozechner/pi-ai version
# Update package.json with the exact "^X.Y.Z" returned
```

- [ ] **`packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "scripts/**/*"]
}
```

- [ ] **`packages/server/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { include: ["src/**"] },
  },
});
```

- [ ] **`packages/server/src/index.ts`** (placeholder — replaced in Task 27)

```ts
console.log("agency server placeholder");
```

- [ ] **Install + verify build**

```bash
cd ~/Projects/Homelab/marquee
npm install
npm run build
```

Expected: clean TypeScript build, no errors.

- [ ] **Commit**

```bash
git add .
git commit -m "feat: add backend package skeleton (Fastify, pi-agent-core, Drizzle)"
```

---

## Task 3: SQLite schema with Drizzle

**Files:**
- Create: `packages/server/src/db/schema.ts`
- Create: `packages/server/src/db/index.ts`
- Test: `packages/server/src/db/schema.test.ts`

- [ ] **Write schema**

`packages/server/src/db/schema.ts`:

```ts
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const ts = () => integer("ts", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

export const chatThreads = sqliteTable("chat_threads", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["intake", "dispatched", "consultative"] }).notNull(),
  title: text("title").notNull(),
  createdAt: ts(),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
});

export const chatParticipants = sqliteTable("chat_participants", {
  threadId: text("thread_id").notNull().references(() => chatThreads.id),
  agentSlug: text("agent_slug").notNull(), // 'human' is one
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").references(() => chatThreads.id),
  agentSessionId: text("agent_session_id"),
  sender: text("sender").notNull(), // agent slug or 'human'
  type: text("type", {
    enum: [
      "chat", "delegation_req", "delegation_resp",
      "brief_proposal", "memory_proposal", "eval_report",
      "tool_call", "tool_result", "approval_decision", "human_brief",
    ],
  }).notNull(),
  contentJson: text("content_json", { mode: "json" }).notNull(),
  createdAt: ts(),
}, (t) => ({
  threadIdx: index("messages_thread_idx").on(t.threadId, t.createdAt),
  sessionIdx: index("messages_session_idx").on(t.agentSessionId, t.createdAt),
}));

export const briefs = sqliteTable("briefs", {
  id: text("id").primaryKey(),
  sourceThreadId: text("source_thread_id").references(() => chatThreads.id),
  status: text("status", { enum: ["draft", "dispatched", "done"] }).notNull(),
  contentMd: text("content_md").notNull(),
  createdAt: ts(),
  dispatchedAt: integer("dispatched_at", { mode: "timestamp_ms" }),
});

export const delegations = sqliteTable("delegations", {
  id: text("id").primaryKey(),
  briefId: text("brief_id").references(() => briefs.id),
  parentDelegationId: text("parent_delegation_id"),
  fromAgent: text("from_agent").notNull(),
  toAgent: text("to_agent").notNull(),
  status: text("status", { enum: ["requested", "in_progress", "complete", "blocked"] }).notNull(),
  payloadJson: text("payload_json", { mode: "json" }).notNull(),
  requestedAt: ts(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
}, (t) => ({
  parentIdx: index("delegations_parent_idx").on(t.parentDelegationId, t.status),
  statusIdx: index("delegations_status_idx").on(t.status),
}));

export const deliverables = sqliteTable("deliverables", {
  id: text("id").primaryKey(),
  delegationId: text("delegation_id").notNull().references(() => delegations.id),
  type: text("type").notNull(), // 'blog_post' for v0.1
  title: text("title").notNull(),
  status: text("status", {
    enum: ["drafting", "awaiting_eval", "awaiting_approval", "shipped", "archived"],
  }).notNull(),
  currentRevisionId: text("current_revision_id"),
  createdAt: ts(),
  updatedAt: ts(),
}, (t) => ({
  statusIdx: index("deliverables_status_idx").on(t.status),
}));

export const deliverableRevisions = sqliteTable("deliverable_revisions", {
  id: text("id").primaryKey(),
  deliverableId: text("deliverable_id").notNull().references(() => deliverables.id),
  artifactPath: text("artifact_path").notNull(), // ~/.marquee/artifacts/<id>/rev_NNN.md
  createdByAgent: text("created_by_agent").notNull(),
  createdAt: ts(),
});

export const evals = sqliteTable("evals", {
  id: text("id").primaryKey(),
  revisionId: text("revision_id").notNull().references(() => deliverableRevisions.id),
  scoresJson: text("scores_json", { mode: "json" }).notNull(), // { brand_voice, factual_accuracy, usp_usage }
  summaryMd: text("summary_md").notNull(),
  createdAt: ts(),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  deliverableId: text("deliverable_id").notNull().references(() => deliverables.id),
  decision: text("decision", { enum: ["approved", "rejected", "requested_changes"] }).notNull(),
  note: text("note"),
  decidedAt: ts(),
});

export const agentSessions = sqliteTable("agent_sessions", {
  id: text("id").primaryKey(),
  agentSlug: text("agent_slug").notNull(),
  lifecycle: text("lifecycle", { enum: ["warm", "transient"] }).notNull(),
  parentDelegationId: text("parent_delegation_id").references(() => delegations.id),
  startedAt: ts(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
}, (t) => ({
  activeIdx: index("sessions_active_idx").on(t.endedAt),
}));

export const turns = sqliteTable("turns", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => agentSessions.id),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  costUsd: integer("cost_usd_cents").notNull(), // store in cents to avoid float
  latencyMs: integer("latency_ms").notNull(),
  startedAt: ts(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
}, (t) => ({
  sessionIdx: index("turns_session_idx").on(t.sessionId, t.startedAt),
}));

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: ts(),
  agentSlug: text("agent_slug"),
  sessionId: text("session_id"),
  turnId: text("turn_id"),
  type: text("type").notNull(),
  payloadJson: text("payload_json", { mode: "json" }).notNull(),
}, (t) => ({
  tsIdx: index("events_ts_idx").on(t.ts),
}));

export const memoryProposals = sqliteTable("memory_proposals", {
  id: text("id").primaryKey(),
  agentSessionId: text("agent_session_id"),
  file: text("file").notNull(),
  patch: text("patch").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
  createdAt: ts(),
});
```

- [ ] **Write a smoke test that the schema compiles + tables can be created**

`packages/server/src/db/schema.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("schema", () => {
  it("creates all tables in a fresh db", () => {
    const dir = mkdtempSync(join(tmpdir(), "agency-test-"));
    const sqlite = new Database(join(dir, "test.db"));
    const db = drizzle(sqlite, { schema });
    // For this test we use raw migrations from drizzle-kit (Task 4); here we
    // just verify the schema itself compiles and exports the expected tables.
    expect(Object.keys(schema)).toContain("chatThreads");
    expect(Object.keys(schema)).toContain("messages");
    expect(Object.keys(schema)).toContain("deliverables");
    expect(Object.keys(schema)).toContain("turns");
  });
});
```

- [ ] **Run test — should PASS** (it only checks the export, not migration yet)

```bash
npm test -- src/db/schema.test.ts
```

- [ ] **Commit**

```bash
git add packages/server/src/db/
git commit -m "feat(db): add SQLite schema for chat, briefs, delegations, deliverables, telemetry"
```

---

## Task 4: Drizzle migrations + WAL init

**Files:**
- Create: `packages/server/drizzle.config.ts`
- Create: `packages/server/src/db/index.ts`
- Create: `packages/server/drizzle/` (generated migrations)
- Test: `packages/server/src/db/index.test.ts`

- [ ] **`packages/server/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
```

- [ ] **Generate initial migration**

```bash
cd packages/server
npx drizzle-kit generate --name=init
```

Expected: a `drizzle/0000_init.sql` file is generated.

- [ ] **Write `packages/server/src/db/index.ts`**

```ts
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type AgencyDb = BetterSQLite3Database<typeof schema>;

export function openDb(path: string): AgencyDb {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
  return db;
}
```

- [ ] **Write integration test**

`packages/server/src/db/index.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "./index";
import { chatThreads } from "./schema";
import { randomUUID } from "node:crypto";

describe("openDb", () => {
  let dir: string;
  let db: AgencyDb;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-test-"));
    db = openDb(join(dir, "test.db"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("inserts and reads a chat thread", () => {
    const id = randomUUID();
    db.insert(chatThreads).values({ id, type: "intake", title: "test" }).run();
    const rows = db.select().from(chatThreads).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("test");
  });
});
```

- [ ] **Run test — PASS expected**

```bash
npm test -- src/db/index.test.ts
```

- [ ] **Commit**

```bash
git add packages/server/{drizzle.config.ts,drizzle/,src/db/index.ts,src/db/index.test.ts}
git commit -m "feat(db): add WAL-mode SQLite open + migration runner"
```

---

## Task 5: Dashboard query helpers

**Files:**
- Create: `packages/server/src/db/queries.ts`
- Test: `packages/server/src/db/queries.test.ts`

- [ ] **Write failing tests first**

`packages/server/src/db/queries.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "./index";
import { agentSessions, deliverables, delegations, turns } from "./schema";
import * as q from "./queries";

describe("dashboard queries", () => {
  let dir: string;
  let db: AgencyDb;
  const seed = (frag: () => void) => frag();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-test-"));
    db = openDb(join(dir, "test.db"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("approvalsQueue returns deliverables awaiting_approval", () => {
    const dlgId = randomUUID();
    db.insert(delegations).values({
      id: dlgId, fromAgent: "director", toAgent: "content-lead",
      status: "complete", payloadJson: {} as never,
    }).run();
    db.insert(deliverables).values({
      id: randomUUID(), delegationId: dlgId, type: "blog_post",
      title: "Test", status: "awaiting_approval",
    }).run();
    expect(q.approvalsQueue(db)).toHaveLength(1);
  });

  it("topSpenderToday returns agent with highest cost in current day", () => {
    const sId = randomUUID();
    db.insert(agentSessions).values({
      id: sId, agentSlug: "copywriter", lifecycle: "transient",
    }).run();
    db.insert(turns).values({
      id: randomUUID(), sessionId: sId, model: "kimi-k2.6",
      promptTokens: 1000, completionTokens: 500, costUsdCents: 25, latencyMs: 1200,
    }).run();
    expect(q.topSpenderToday(db)?.agentSlug).toBe("copywriter");
  });

  it("activeAgents returns sessions with ended_at IS NULL", () => {
    db.insert(agentSessions).values({
      id: randomUUID(), agentSlug: "director", lifecycle: "warm",
    }).run();
    expect(q.activeAgents(db)).toHaveLength(1);
  });
});
```

- [ ] **Run tests — FAIL with `q.approvalsQueue is not a function`**

```bash
npm test -- src/db/queries.test.ts
```

- [ ] **Implement `packages/server/src/db/queries.ts`**

```ts
import { and, desc, eq, gte, isNull, sum } from "drizzle-orm";
import type { AgencyDb } from "./index";
import { agentSessions, deliverables, events, turns } from "./schema";

export const approvalsQueue = (db: AgencyDb) =>
  db.select().from(deliverables).where(eq(deliverables.status, "awaiting_approval")).all();

export const pipelineCounts = (db: AgencyDb) =>
  db
    .select({ status: deliverables.status, count: sum(deliverables.id).mapWith(Number) })
    .from(deliverables)
    .groupBy(deliverables.status)
    .all();

export const recentEvents = (db: AgencyDb, limit = 100) =>
  db.select().from(events).orderBy(desc(events.ts)).limit(limit).all();

export const eventsAfter = (db: AgencyDb, lastId: number) =>
  db.select().from(events).where(gte(events.id, lastId + 1)).orderBy(events.id).all();

export const activeAgents = (db: AgencyDb) =>
  db.select().from(agentSessions).where(isNull(agentSessions.endedAt)).all();

export const topSpenderToday = (db: AgencyDb) => {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const rows = db
    .select({
      agentSlug: agentSessions.agentSlug,
      total: sum(turns.costUsdCents).mapWith(Number),
    })
    .from(turns)
    .innerJoin(agentSessions, eq(agentSessions.id, turns.sessionId))
    .where(gte(turns.startedAt, dayStart))
    .groupBy(agentSessions.agentSlug)
    .orderBy(desc(sum(turns.costUsdCents)))
    .limit(1)
    .all();
  return rows[0] ?? null;
};
```

- [ ] **Run tests — PASS expected**

```bash
npm test -- src/db/queries.test.ts
```

- [ ] **Commit**

```bash
git add packages/server/src/db/queries.ts packages/server/src/db/queries.test.ts
git commit -m "feat(db): add dashboard query helpers (approvals, top spender, active agents)"
```

---

## Task 6: Custom AgentMessage types + module structure

**Files:**
- Create: `packages/server/src/agents/messages.ts`
- Test: `packages/server/src/agents/messages.test.ts`

- [ ] **Write failing test**

`packages/server/src/agents/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  type AgencyMessage,
  isDelegationRequest,
  isBriefProposal,
  newDelegationRequest,
} from "./messages";

describe("messages", () => {
  it("constructs a delegation_request message", () => {
    const m = newDelegationRequest({
      from: "director",
      to: "content-lead",
      payload: { briefId: "abc", task: "write a 500-word blog post" },
    });
    expect(m.type).toBe("delegation_request");
    expect(isDelegationRequest(m)).toBe(true);
    expect(isBriefProposal(m)).toBe(false);
  });
});
```

- [ ] **Run — FAIL**

```bash
npm test -- src/agents/messages.test.ts
```

- [ ] **Implement `packages/server/src/agents/messages.ts`**

```ts
import { randomUUID } from "node:crypto";

// Standard pi-agent-core message shapes (we only re-declare what we use).
export type StandardMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool"; toolCallId: string; content: string };

// ---- Custom typed messages ----

export interface DelegationRequestMessage {
  type: "delegation_request";
  id: string;
  from: string;        // agent slug
  to: string;          // agent slug
  payload: { briefId?: string; deliverableId?: string; task: string; context?: string };
  ts: number;
}

export interface DelegationResponseMessage {
  type: "delegation_response";
  id: string;
  delegationId: string;
  from: string;
  to: string;
  result: { ok: boolean; deliverableId?: string; summary: string };
  ts: number;
}

export interface BriefProposalMessage {
  type: "brief_proposal";
  id: string;
  from: string;     // 'director' typically
  threadId: string;
  draft: { title: string; scope: string; deliverables: string[]; deadline?: string };
  ts: number;
}

export interface MemoryProposalMessage {
  type: "memory_proposal";
  id: string;
  from: string;
  file: string;     // 'client_profile.md' etc.
  patch: string;    // unified diff
  ts: number;
}

export interface EvalReportMessage {
  type: "eval_report";
  id: string;
  deliverableRevisionId: string;
  scores: { brand_voice: number; factual_accuracy: number; usp_usage: number };
  summary: string;
  ts: number;
}

export interface ApprovalDecisionMessage {
  type: "approval_decision";
  id: string;
  deliverableId: string;
  decision: "approved" | "rejected" | "requested_changes";
  note?: string;
  ts: number;
}

export interface HumanBriefMessage {
  type: "human_brief";
  id: string;
  briefId: string;
  ts: number;
}

export type CustomMessage =
  | DelegationRequestMessage
  | DelegationResponseMessage
  | BriefProposalMessage
  | MemoryProposalMessage
  | EvalReportMessage
  | ApprovalDecisionMessage
  | HumanBriefMessage;

export type AgencyMessage = StandardMessage | CustomMessage;

// ---- Constructors ----

export const newDelegationRequest = (
  args: Omit<DelegationRequestMessage, "type" | "id" | "ts">,
): DelegationRequestMessage => ({
  type: "delegation_request", id: randomUUID(), ts: Date.now(), ...args,
});

export const newDelegationResponse = (
  args: Omit<DelegationResponseMessage, "type" | "id" | "ts">,
): DelegationResponseMessage => ({
  type: "delegation_response", id: randomUUID(), ts: Date.now(), ...args,
});

export const newBriefProposal = (
  args: Omit<BriefProposalMessage, "type" | "id" | "ts">,
): BriefProposalMessage => ({
  type: "brief_proposal", id: randomUUID(), ts: Date.now(), ...args,
});

export const newMemoryProposal = (
  args: Omit<MemoryProposalMessage, "type" | "id" | "ts">,
): MemoryProposalMessage => ({
  type: "memory_proposal", id: randomUUID(), ts: Date.now(), ...args,
});

export const newEvalReport = (
  args: Omit<EvalReportMessage, "type" | "id" | "ts">,
): EvalReportMessage => ({
  type: "eval_report", id: randomUUID(), ts: Date.now(), ...args,
});

// ---- Type guards ----

export const isCustom = (m: AgencyMessage): m is CustomMessage =>
  "type" in m && m.type !== "user" && m.type !== "assistant" && m.type !== "tool";

export const isDelegationRequest = (m: AgencyMessage): m is DelegationRequestMessage =>
  isCustom(m) && m.type === "delegation_request";

export const isBriefProposal = (m: AgencyMessage): m is BriefProposalMessage =>
  isCustom(m) && m.type === "brief_proposal";

export const isEvalReport = (m: AgencyMessage): m is EvalReportMessage =>
  isCustom(m) && m.type === "eval_report";
```

- [ ] **Run — PASS**

```bash
npm test -- src/agents/messages.test.ts
```

- [ ] **Commit**

```bash
git add packages/server/src/agents/messages.ts packages/server/src/agents/messages.test.ts
git commit -m "feat(agents): add custom AgencyMessage types with constructors and type guards"
```

---

## Task 7: `convertToLlm` — serialize custom messages to LLM-readable text

**Files:**
- Create: `packages/server/src/agents/convert-to-llm.ts`
- Test: `packages/server/src/agents/convert-to-llm.test.ts`

- [ ] **Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { convertToLlm } from "./convert-to-llm";
import { newDelegationRequest, newBriefProposal } from "./messages";

describe("convertToLlm", () => {
  it("serializes a delegation_request into a tagged user message", () => {
    const m = newDelegationRequest({
      from: "director", to: "content-lead",
      payload: { task: "write 500-word post about X" },
    });
    const out = convertToLlm([m]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("user");
    expect(out[0].content).toContain("<delegation");
    expect(out[0].content).toContain("write 500-word");
  });

  it("passes standard messages through unchanged", () => {
    const out = convertToLlm([{ role: "user", content: "hi" }]);
    expect(out).toEqual([{ role: "user", content: "hi" }]);
  });

  it("serializes a brief_proposal into an assistant message with tag", () => {
    const m = newBriefProposal({
      from: "director", threadId: "t1",
      draft: { title: "Q2 plan", scope: "blog x3", deliverables: ["blog_post"] },
    });
    const out = convertToLlm([m]);
    expect(out[0].role).toBe("assistant");
    expect(out[0].content).toContain("<brief_proposal");
    expect(out[0].content).toContain("Q2 plan");
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement**

`packages/server/src/agents/convert-to-llm.ts`:

```ts
import type { AgencyMessage, CustomMessage, StandardMessage } from "./messages";

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function serializeCustom(m: CustomMessage): StandardMessage {
  switch (m.type) {
    case "delegation_request":
      return {
        role: "user",
        content:
          `<delegation from="${m.from}" to="${m.to}">\n` +
          `task: ${escapeXml(m.payload.task)}\n` +
          (m.payload.context ? `context: ${escapeXml(m.payload.context)}\n` : "") +
          `</delegation>`,
      };
    case "delegation_response":
      return {
        role: "user",
        content:
          `<delegation_result from="${m.from}" ok="${m.result.ok}">\n` +
          `${escapeXml(m.result.summary)}\n` +
          `</delegation_result>`,
      };
    case "brief_proposal":
      return {
        role: "assistant",
        content:
          `<brief_proposal id="${m.id}">\n` +
          `title: ${escapeXml(m.draft.title)}\n` +
          `scope: ${escapeXml(m.draft.scope)}\n` +
          `deliverables: ${m.draft.deliverables.join(", ")}\n` +
          `</brief_proposal>`,
      };
    case "memory_proposal":
      return {
        role: "assistant",
        content:
          `<memory_proposal id="${m.id}" file="${m.file}">\n` +
          `${escapeXml(m.patch)}\n` +
          `</memory_proposal>`,
      };
    case "eval_report":
      return {
        role: "user",
        content:
          `<eval_report id="${m.id}">\n` +
          `brand_voice: ${m.scores.brand_voice}/5\n` +
          `factual_accuracy: ${m.scores.factual_accuracy}/5\n` +
          `usp_usage: ${m.scores.usp_usage}/5\n` +
          `summary: ${escapeXml(m.summary)}\n` +
          `</eval_report>`,
      };
    case "approval_decision":
      return {
        role: "user",
        content:
          `<approval_decision deliverable="${m.deliverableId}" decision="${m.decision}">\n` +
          (m.note ? escapeXml(m.note) : "") +
          `</approval_decision>`,
      };
    case "human_brief":
      return { role: "user", content: `<human_brief id="${m.briefId}"/>` };
  }
}

export function convertToLlm(messages: AgencyMessage[]): StandardMessage[] {
  return messages.map((m) =>
    "type" in m && (m.type === "user" || m.type === "assistant" || m.type === "tool")
      ? (m as StandardMessage)
      : "role" in m
        ? (m as StandardMessage)
        : serializeCustom(m as CustomMessage),
  );
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/agents/convert-to-llm.ts packages/server/src/agents/convert-to-llm.test.ts
git commit -m "feat(agents): add convertToLlm to serialize custom messages as XML-tagged text"
```

---

## Task 8: Provider config + model registry

**Files:**
- Create: `packages/server/src/providers/index.ts`
- Test: `packages/server/src/providers/index.test.ts`

- [ ] **Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { modelForRole, providerMode } from "./index";

describe("providers", () => {
  it("returns Kimi K2.6 for director in flat mode", () => {
    process.env.HERMES_PROVIDER_MODE = "flat";
    const m = modelForRole("director");
    expect(m.provider).toBe("opencode-go");
    expect(m.id).toMatch(/kimi-k2\.6/i);
  });

  it("returns Haiku for content-lead in api mode", () => {
    process.env.HERMES_PROVIDER_MODE = "api";
    const m = modelForRole("content-lead");
    expect(m.provider).toBe("openrouter");
    expect(m.id).toContain("claude-haiku");
  });

  it("providerMode reads env var", () => {
    process.env.HERMES_PROVIDER_MODE = "flat";
    expect(providerMode()).toBe("flat");
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement**

`packages/server/src/providers/index.ts`:

```ts
import { getModel } from "@mariozechner/pi-ai";

export type ProviderMode = "flat" | "api";

export const providerMode = (): ProviderMode =>
  (process.env.HERMES_PROVIDER_MODE as ProviderMode) ?? "flat";

const FLAT_MAP: Record<string, string> = {
  director: "kimi-k2.6",
  "content-lead": "deepseek-v4-pro",
  copywriter: "kimi-k2.6",
  "eval-judge": "minimax-m2.7",
};

const API_MAP: Record<string, string> = {
  director: "anthropic/claude-sonnet-4-7",
  "content-lead": "anthropic/claude-haiku-4-5",
  copywriter: "anthropic/claude-sonnet-4-7",
  "eval-judge": "anthropic/claude-haiku-4-5",
};

export function modelForRole(role: string) {
  const mode = providerMode();
  if (mode === "flat") {
    const id = FLAT_MAP[role] ?? "kimi-k2.6";
    return getModel("opencode-go", id);
  }
  const id = API_MAP[role] ?? "anthropic/claude-haiku-4-5";
  return getModel("openrouter", id);
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/providers/
git commit -m "feat(providers): add per-role model selection for flat (OpenCode Go) and api (OpenRouter) modes"
```

---

## Task 9: Memory read + YAML frontmatter

**Files:**
- Create: `packages/server/src/memory/read.ts`
- Test: `packages/server/src/memory/read.test.ts`

- [ ] **Write failing test**

```ts
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readMemoryFile } from "./read";

describe("readMemoryFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-mem-"));
    mkdirSync(join(dir, "memory"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("parses YAML frontmatter and body", () => {
    writeFileSync(
      join(dir, "memory/client_profile.md"),
      `---\nclient_name: Stackly\nicp: PLG SaaS\n---\n\n# Stackly\n\nbody here\n`,
    );
    const m = readMemoryFile(dir, "client_profile");
    expect(m.frontmatter.client_name).toBe("Stackly");
    expect(m.frontmatter.icp).toBe("PLG SaaS");
    expect(m.body.trim()).toContain("body here");
  });

  it("returns empty frontmatter for files without YAML", () => {
    writeFileSync(join(dir, "memory/notes.md"), "just text");
    const m = readMemoryFile(dir, "notes");
    expect(m.frontmatter).toEqual({});
    expect(m.body).toBe("just text");
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/memory/read.ts`**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export interface MemoryFile {
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string;
}

export function readMemoryFile(dataDir: string, name: string): MemoryFile {
  const path = join(dataDir, "memory", `${name}.md`);
  const raw = readFileSync(path, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
    raw,
  };
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/memory/read.ts packages/server/src/memory/read.test.ts
git commit -m "feat(memory): add memory file reader with YAML frontmatter parsing"
```

---

## Task 10: Mustache-style template interpolation

**Files:**
- Create: `packages/server/src/memory/template.ts`
- Test: `packages/server/src/memory/template.test.ts`

- [ ] **Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { interpolate } from "./template";

describe("interpolate", () => {
  it("replaces a top-level variable", () => {
    expect(interpolate("hello {{name}}", { name: "world" })).toBe("hello world");
  });

  it("replaces nested keys with dot syntax", () => {
    expect(interpolate("voice: {{client.brand_voice}}", { client: { brand_voice: "tight" } })).toBe(
      "voice: tight",
    );
  });

  it("leaves missing keys as empty string", () => {
    expect(interpolate("a {{nope}} b", {})).toBe("a  b");
  });

  it("supports underscore-prefixed namespaces", () => {
    const ctx = { client_profile: { brand_voice: "data-driven" } };
    expect(interpolate("{{client_profile.brand_voice}}", ctx)).toBe("data-driven");
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/memory/template.ts`**

```ts
const lookup = (ctx: Record<string, unknown>, path: string): string => {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return "";
    }
  }
  return cur == null ? "" : String(cur);
};

export function interpolate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => lookup(ctx, p));
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/memory/template.ts packages/server/src/memory/template.test.ts
git commit -m "feat(memory): add mustache-style template interpolation with dotted paths"
```

---

## Task 11: Memory write — atomic git patch

**Files:**
- Create: `packages/server/src/memory/write.ts`
- Test: `packages/server/src/memory/write.test.ts`

- [ ] **Write failing test**

```ts
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit from "simple-git";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { applyMemoryPatch, initMemoryRepo } from "./write";

describe("memory write", () => {
  let dir: string;
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "agency-mem-write-"));
    mkdirSync(join(dir, "memory"));
    writeFileSync(join(dir, "memory/client_profile.md"), "---\nclient_name: Old\n---\n\nbody\n");
    await initMemoryRepo(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("applies a unified diff and commits it", async () => {
    const patch =
      `--- a/memory/client_profile.md\n` +
      `+++ b/memory/client_profile.md\n` +
      `@@ -1,3 +1,3 @@\n` +
      ` ---\n` +
      `-client_name: Old\n` +
      `+client_name: New\n` +
      ` ---\n`;
    const result = await applyMemoryPatch(dir, "client_profile.md", patch, "agent-test");
    expect(result.ok).toBe(true);
    const after = readFileSync(join(dir, "memory/client_profile.md"), "utf8");
    expect(after).toContain("client_name: New");
    const git = simpleGit(join(dir, "memory"));
    const log = await git.log();
    expect(log.latest?.message).toContain("agent-test");
  });

  it("rolls back on bad patch", async () => {
    const before = readFileSync(join(dir, "memory/client_profile.md"), "utf8");
    const patch = `--- a/memory/client_profile.md\n+++ b/memory/client_profile.md\n@@ -1,1 +1,1 @@\n-NONEXISTENT\n+x\n`;
    const result = await applyMemoryPatch(dir, "client_profile.md", patch, "agent-test");
    expect(result.ok).toBe(false);
    const after = readFileSync(join(dir, "memory/client_profile.md"), "utf8");
    expect(after).toBe(before);
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/memory/write.ts`**

```ts
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";

const memoryDir = (dataDir: string) => join(dataDir, "memory");

export async function initMemoryRepo(dataDir: string): Promise<void> {
  const dir = memoryDir(dataDir);
  const git: SimpleGit = simpleGit(dir);
  if (!existsSync(join(dir, ".git"))) {
    await git.init();
    await git.addConfig("user.name", "agency-bot");
    await git.addConfig("user.email", "agency-bot@localhost");
    await git.add(".");
    await git.commit("chore: init memory repo");
  }
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
}

export async function applyMemoryPatch(
  dataDir: string,
  file: string,
  patch: string,
  authorAgent: string,
): Promise<ApplyResult> {
  const dir = memoryDir(dataDir);
  const git = simpleGit(dir);

  // Stash any unstaged work before checking — safe baseline
  await git.add(".");

  const patchFile = join(dir, ".pending.patch");
  writeFileSync(patchFile, patch);

  try {
    await git.raw(["apply", "--check", patchFile]);
  } catch (e) {
    return { ok: false, error: String(e) };
  }

  try {
    await git.raw(["apply", patchFile]);
    await git.add(file);
    await git.commit(`memory: ${file} updated by ${authorAgent}`);
    return { ok: true };
  } catch (e) {
    // Rollback
    await git.checkout(file);
    return { ok: false, error: String(e) };
  } finally {
    try { writeFileSync(patchFile, ""); } catch {}
  }
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/memory/write.ts packages/server/src/memory/write.test.ts
git commit -m "feat(memory): add atomic git-backed patch apply with rollback"
```

---

## Task 12: Skill recipe loader

**Files:**
- Create: `packages/server/src/skills/loader.ts`
- Create: `packages/server/src/skills/recipes/.gitkeep`
- Test: `packages/server/src/skills/loader.test.ts`

- [ ] **Write failing test**

```ts
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSkill, loadSkillsForRole } from "./loader";

describe("skills loader", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-skills-"));
    mkdirSync(join(dir, "skills/copywriter"), { recursive: true });
    writeFileSync(
      join(dir, "skills/copywriter/blog_post_writer.md"),
      `---\nname: blog_post_writer\nwhen_to_use: blog_post delegation\n---\n\nWrite for {{client_profile.brand_voice}}\n`,
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("loads a recipe by name", () => {
    const r = loadSkill(dir, "copywriter", "blog_post_writer");
    expect(r.frontmatter.name).toBe("blog_post_writer");
    expect(r.body).toContain("Write for");
  });

  it("interpolates variables when rendered", () => {
    const r = loadSkill(dir, "copywriter", "blog_post_writer");
    const rendered = r.render({ client_profile: { brand_voice: "tight" } });
    expect(rendered).toContain("Write for tight");
  });

  it("loads all recipes for a role", () => {
    const all = loadSkillsForRole(dir, "copywriter");
    expect(all).toHaveLength(1);
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/skills/loader.ts`**

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { interpolate } from "../memory/template.js";

export interface SkillRecipe {
  frontmatter: Record<string, unknown>;
  body: string;
  render(ctx: Record<string, unknown>): string;
}

const skillsDir = (dataDir: string) => join(dataDir, "skills");

export function loadSkill(dataDir: string, role: string, name: string): SkillRecipe {
  const path = join(skillsDir(dataDir), role, `${name}.md`);
  const raw = readFileSync(path, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
    render: (ctx) => interpolate(parsed.content, ctx),
  };
}

export function loadSkillsForRole(dataDir: string, role: string): SkillRecipe[] {
  const dir = join(skillsDir(dataDir), role);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  return files.map((f) => loadSkill(dataDir, role, f.replace(/\.md$/, "")));
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/skills/
git commit -m "feat(skills): add markdown skill recipe loader with template rendering"
```

---

## Task 13: Author 5 skill recipe markdown files

**Files:**
- Create: `packages/server/src/skills/recipes/director/brief_parser.md`
- Create: `packages/server/src/skills/recipes/director/lead_router.md`
- Create: `packages/server/src/skills/recipes/content-lead/editorial_brief_handoff.md`
- Create: `packages/server/src/skills/recipes/copywriter/blog_post_writer.md`
- Create: `packages/server/src/skills/recipes/eval-judge/three_dim_review.md`

These files ship with the package and are copied to `~/.marquee/skills/` on first run.

- [ ] **`director/brief_parser.md`**

```markdown
---
name: brief_parser
when_to_use: A new chat thread is opened or the human posts a request without a structured brief
input_schema:
  user_request: string
output: a propose_brief tool call with title, scope, deliverables, deadline
---

# Brief parsing recipe

Read the user's request and current memory ({{client_profile.client_name}}, {{client_profile.icp}}).

Ask clarifying questions ONE AT A TIME if any of the following are unclear:
1. **Title** — what should we call this work?
2. **Scope** — what is in / out of scope?
3. **Deliverables** — concrete artifacts (e.g., 1× blog_post, 3× linkedin_post)
4. **Deadline** — when is it due?

Once all four are clear, call `propose_brief(...)`. The user will review and approve in the chat.

Tone: friendly, concise. Mirror {{client_profile.brand_voice}}.
```

- [ ] **`director/lead_router.md`**

```markdown
---
name: lead_router
when_to_use: A brief has been confirmed and dispatched
output: a delegate_to_lead tool call to the appropriate Lead
---

# Routing rules

| Deliverable type | Lead |
|---|---|
| blog_post, landing_page, email_copy | content-lead |
| linkedin_post, twitter_thread, ad_copy (v0.2+) | distribution-lead |
| seo_brief, performance_report (v0.2+) | insights-lead |

For v0.1, all blog_post deliverables route to content-lead.

When delegating, include:
- The brief id
- A 1-2 sentence framing of what success looks like
- Any non-obvious constraints from {{brand_guidelines.tone_of_voice}}
```

- [ ] **`content-lead/editorial_brief_handoff.md`**

```markdown
---
name: editorial_brief_handoff
when_to_use: Director delegates a content task to you
output: a delegate_to_specialist tool call to copywriter, plus optional context
---

# Specialist delegation

For v0.1 the only Specialist under your supervision is `copywriter`.

When you delegate to copywriter, give them:
1. The original brief context (do NOT re-summarize the whole company — they will read_memory)
2. Target word count (default: 1200-1500 for blog_post)
3. Target keywords if provided
4. The 2-3 most important brand voice rules from {{brand_guidelines.tone_of_voice}}

After they `submit_to_director`, you forward the result up. Do not editorialize unless the deliverable misses scope.
```

- [ ] **`copywriter/blog_post_writer.md`**

```markdown
---
name: blog_post_writer
when_to_use: A delegation request with deliverable type 'blog_post' arrives
input_schema:
  topic: string
  target_keywords: string[]
  word_count: number
output: a submit_deliverable tool call with the full markdown
---

# Blog post writing recipe

You write for {{client_profile.client_name}}: {{client_profile.tagline}}.
Target audience: {{client_profile.icp}}.
USP: {{client_profile.usp}}.

## Required structure

1. **Hook** (1 paragraph) — open with a specific number, counterintuitive insight, or named pain point. No "in today's fast-paced world" openings.
2. **Problem framing** (2-3 paragraphs) — name the situation precisely, with 1-2 concrete examples your reader has experienced.
3. **Body** (1000-1300 words) — 3-5 sections with H2 headings. Each section: claim → evidence → so-what.
4. **Take-away** (1 paragraph) — what should the reader do or remember? No empty calls to action.

## Style rules ({{brand_guidelines.tone_of_voice}})

- Sentence-level: 12-22 words average. Vary between short and medium. Avoid 30+ word sentences.
- No words: "comprehensive guide", "ultimate", "everything you need", "in today's", "leverage" (verb), "synergy"
- Cite sources inline as Markdown links.
- Concrete > abstract. Numbers > adjectives.

## Output

Call `submit_deliverable({ type: "blog_post", title: "...", contentMd: "..." })`.
Do NOT call respond_to_lead first — the lead reviews after submission.
```

- [ ] **`eval-judge/three_dim_review.md`**

```markdown
---
name: three_dim_review
when_to_use: A new deliverable revision is awaiting_eval
input_schema:
  deliverableId: string
  revisionId: string
output: a submit_eval_report tool call with 3 scores and a summary
---

# Eval rubric

Read the deliverable via `read_deliverable(deliverableId)`. Read {{client_profile.client_name}} memory ({{brand_guidelines}}).

Score each dimension 1-5:

## brand_voice (1-5)
- 5: Indistinguishable from {{brand_guidelines.reference_examples}}
- 3: Mostly on-brand, 1-2 voice slips
- 1: Generic SaaS marketing copy

## factual_accuracy (1-5)
- 5: Every claim is specific and verifiable; sources cited where appropriate
- 3: Claims are reasonable but unsupported
- 1: Contains demonstrably false or unverifiable statements

## usp_usage (1-5)
- 5: USP "{{client_profile.usp}}" is naturally woven in and reinforced
- 3: USP mentioned once, not central
- 1: USP absent or contradicted

## Output

`submit_eval_report({ deliverableRevisionId, scores: {...}, summary })`.

Summary format: 2-3 sentences. Lead with the lowest-scoring dimension and one specific example. Do not gloss.

This is **advisory** — your score does not block approval. The human decides.
```

- [ ] **Commit**

```bash
git add packages/server/src/skills/recipes/
git commit -m "feat(skills): add 5 v0.1 skill recipes (brief_parser, lead_router, editorial_brief_handoff, blog_post_writer, three_dim_review)"
```

---

## Task 14: `transformContext` hook (memory injection + retention)

**Files:**
- Create: `packages/server/src/agents/transform-context.ts`
- Test: `packages/server/src/agents/transform-context.test.ts`

- [ ] **Write failing test**

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { makeTransformContext } from "./transform-context";

describe("transformContext", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-tc-"));
    mkdirSync(join(dir, "memory"));
    writeFileSync(
      join(dir, "memory/client_profile.md"),
      "---\nclient_name: Stackly\nbrand_voice: tight\n---\n\nbody\n",
    );
    writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: data-driven\n---\nx");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("prepends memory block as first user message", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 50 });
    const out = await tc([{ role: "user", content: "hi" }]);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].role).toBe("user");
    expect(out[0].content).toContain("Stackly");
    expect(out[0].content).toContain("data-driven");
  });

  it("prunes when message count exceeds keepRecent", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 5 });
    const many = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
    const out = await tc(many);
    // 1 memory block + 1 summary + 5 recent = 7
    expect(out.length).toBeLessThanOrEqual(7);
    expect(out.some((m) => "content" in m && m.content.includes("[earlier turns summarized"))).toBe(true);
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/agents/transform-context.ts`**

```ts
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readMemoryFile } from "../memory/read.js";
import type { AgencyMessage, StandardMessage } from "./messages.js";
import { convertToLlm } from "./convert-to-llm.js";

export interface TransformContextOptions {
  dataDir: string;
  role: string;
  keepRecent?: number; // default 50
}

const RELEVANT_MEMORY_FOR_ROLE: Record<string, string[]> = {
  director: ["client_profile", "brand_guidelines", "ongoing_campaigns"],
  "content-lead": ["client_profile", "brand_guidelines", "content_history"],
  copywriter: ["client_profile", "brand_guidelines", "content_history"],
  "eval-judge": ["client_profile", "brand_guidelines"],
};

const memoryBlock = (dataDir: string, role: string): StandardMessage => {
  const memDir = join(dataDir, "memory");
  if (!existsSync(memDir)) return { role: "user", content: "<memory/>" };
  const want = RELEVANT_MEMORY_FOR_ROLE[role] ?? ["client_profile", "brand_guidelines"];
  const present = new Set(readdirSync(memDir).map((f) => f.replace(/\.md$/, "")));
  const blocks = want.filter((n) => present.has(n)).map((n) => {
    const m = readMemoryFile(dataDir, n);
    const fm = JSON.stringify(m.frontmatter, null, 2);
    return `<memory file="${n}.md">\n<frontmatter>${fm}</frontmatter>\n<body>${m.body.trim()}</body>\n</memory>`;
  });
  return { role: "user", content: `<memory_block>\n${blocks.join("\n")}\n</memory_block>` };
};

const summarize = (toCompact: AgencyMessage[]): StandardMessage => ({
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

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/agents/transform-context.ts packages/server/src/agents/transform-context.test.ts
git commit -m "feat(agents): add transformContext with memory injection and retention pruning"
```

---

## Task 15: Protocol tools — delegation

**Files:**
- Create: `packages/server/src/tools/types.ts`
- Create: `packages/server/src/tools/delegation.ts`
- Test: `packages/server/src/tools/delegation.test.ts`

- [ ] **`packages/server/src/tools/types.ts`** (shared interfaces)

```ts
import type { AgencyDb } from "../db/index.js";

export interface ToolContext {
  db: AgencyDb;
  agentSlug: string;
  agentSessionId: string;
  delegationId?: string;
  threadId?: string;
  emit: (eventType: string, payload: Record<string, unknown>) => void;
}

export interface AgentToolDef<TInput, TOutput> {
  name: string;
  description: string;
  input: { parse: (raw: unknown) => TInput };
  execute(input: TInput, ctx: ToolContext): Promise<TOutput>;
}
```

- [ ] **Write failing test for `delegate_to_lead`**

`packages/server/src/tools/delegation.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { delegations } from "../db/schema.js";
import { delegateToLead } from "./delegation.js";

describe("delegate_to_lead", () => {
  let dir: string; let db: AgencyDb;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-tools-"));
    db = openDb(join(dir, "test.db"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("creates a delegation record with status=requested", async () => {
    const emit = vi.fn();
    const result = await delegateToLead.execute(
      { lead: "content-lead", task: "write a blog post", briefId: undefined },
      { db, agentSlug: "director", agentSessionId: randomUUID(), emit },
    );
    expect(result.delegationId).toBeDefined();
    const rows = db.select().from(delegations).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].fromAgent).toBe("director");
    expect(rows[0].toAgent).toBe("content-lead");
    expect(rows[0].status).toBe("requested");
    expect(emit).toHaveBeenCalledWith("delegation_created", expect.any(Object));
  });

  it("rejects an unknown lead slug", async () => {
    await expect(delegateToLead.execute(
      { lead: "unknown-lead", task: "x" } as never,
      { db, agentSlug: "director", agentSessionId: randomUUID(), emit: vi.fn() },
    )).rejects.toThrow(/lead/i);
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/tools/delegation.ts`**

```ts
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { delegations } from "../db/schema.js";
import type { AgentToolDef } from "./types.js";

const KNOWN_LEADS = new Set(["content-lead"]); // v0.1; extend in v0.2
const KNOWN_SPECIALISTS_BY_LEAD: Record<string, Set<string>> = {
  "content-lead": new Set(["copywriter"]),
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
  input: delegateToLeadInput,
  async execute(input, ctx) {
    if (!KNOWN_LEADS.has(input.lead)) {
      throw new Error(`Unknown lead "${input.lead}". Valid: ${[...KNOWN_LEADS].join(", ")}`);
    }
    const id = randomUUID();
    ctx.db.insert(delegations).values({
      id, briefId: input.briefId, fromAgent: ctx.agentSlug, toAgent: input.lead,
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

export const delegateToSpecialist: AgentToolDef<
  z.infer<typeof delegateToSpecialistInput>,
  { delegationId: string }
> = {
  name: "delegate_to_specialist",
  description: "Delegate a task to a Specialist agent under your supervision. Lead-only.",
  input: delegateToSpecialistInput,
  async execute(input, ctx) {
    const allowed = KNOWN_SPECIALISTS_BY_LEAD[ctx.agentSlug];
    if (!allowed) throw new Error(`${ctx.agentSlug} is not a Lead and cannot delegate to specialists`);
    if (!allowed.has(input.specialist))
      throw new Error(`${ctx.agentSlug} cannot delegate to "${input.specialist}". Allowed: ${[...allowed].join(", ")}`);
    const id = randomUUID();
    ctx.db.insert(delegations).values({
      id, parentDelegationId: ctx.delegationId, fromAgent: ctx.agentSlug, toAgent: input.specialist,
      status: "requested", payloadJson: { task: input.task, context: input.context } as never,
    }).run();
    ctx.emit("delegation_created", { delegationId: id, from: ctx.agentSlug, to: input.specialist });
    return { delegationId: id };
  },
};

const submitToDirectorInput = z.object({ summary: z.string().min(1), deliverableId: z.string().optional() });
export const submitToDirector: AgentToolDef<z.infer<typeof submitToDirectorInput>, { ok: true }> = {
  name: "submit_to_director",
  description: "Forward your synthesized output up to the Director. Lead-only.",
  input: submitToDirectorInput,
  async execute(input, ctx) {
    if (!ctx.delegationId) throw new Error("submit_to_director requires an active delegation context");
    ctx.db.update(delegations)
      .set({ status: "complete", completedAt: new Date(),
             payloadJson: { ...{ summary: input.summary, deliverableId: input.deliverableId } } as never })
      .where(/* eq */ ({ ...({} as never) }) as never)  // implement with eq below
      .run();
    ctx.emit("delegation_complete", { delegationId: ctx.delegationId });
    return { ok: true };
  },
};

// Apply correct eq import for the update predicate above:
// (Replace the placeholder predicate with: import { eq } from "drizzle-orm"; .where(eq(delegations.id, ctx.delegationId))
```

> **Implementation note:** the `submit_to_director` `.where(...)` placeholder above is a literal placeholder due to TypeScript-in-markdown limitations; in the actual file write `import { eq } from "drizzle-orm";` and use `.where(eq(delegations.id, ctx.delegationId))`. Delete the placeholder line.

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/tools/types.ts packages/server/src/tools/delegation.ts packages/server/src/tools/delegation.test.ts
git commit -m "feat(tools): add delegation tools (delegate_to_lead, delegate_to_specialist, submit_to_director)"
```

---

## Task 16: Protocol tools — deliverables

**Files:**
- Create: `packages/server/src/tools/deliverables.ts`
- Test: `packages/server/src/tools/deliverables.test.ts`

- [ ] **Write failing tests** (mirror Task 15 test structure)

```ts
// covers:
// - submit_deliverable creates a deliverable + revision file on disk + sets status='awaiting_eval'
// - submit_deliverable rejects when called outside a delegation
// - read_deliverable returns the latest revision content
// - respond_to_lead updates the delegation with a free-form message (status stays in_progress)
```

(Write the full test code in the actual file, 3 cases, ~70 lines, following Task 15 pattern.)

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/tools/deliverables.ts`**

Key behaviors:
- `submit_deliverable`: requires `ctx.delegationId`, creates `deliverables` row, creates `deliverable_revisions` row, writes file `<dataDir>/artifacts/<deliverableId>/rev_001.md`, status `awaiting_eval`, emits `deliverable_submitted`
- `read_deliverable`: takes `{deliverableId}`, reads `currentRevisionId` row, returns `{ contentMd, revisionId }` from disk
- `respond_to_lead`: appends a `delegation_resp` message row, emits `delegation_response`, does NOT close the delegation

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { deliverables, deliverableRevisions, messages } from "../db/schema.js";
import type { AgentToolDef } from "./types.js";

const submitDeliverableInput = z.object({
  type: z.string(),
  title: z.string(),
  contentMd: z.string().min(50),
});

export function makeSubmitDeliverable(dataDir: string): AgentToolDef<
  z.infer<typeof submitDeliverableInput>,
  { deliverableId: string; revisionId: string }
> {
  return {
    name: "submit_deliverable",
    description: "Submit a completed deliverable. Triggers the eval pipeline. Specialist-only.",
    input: submitDeliverableInput,
    async execute(input, ctx) {
      if (!ctx.delegationId) throw new Error("submit_deliverable requires an active delegation context");
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
      }).run();
      ctx.db.insert(deliverableRevisions).values({
        id: revisionId, deliverableId, artifactPath, createdByAgent: ctx.agentSlug,
      }).run();
      ctx.emit("deliverable_submitted", { deliverableId, revisionId });
      return { deliverableId, revisionId };
    },
  };
}

const readDeliverableInput = z.object({ deliverableId: z.string() });
export const readDeliverable: AgentToolDef<
  z.infer<typeof readDeliverableInput>,
  { revisionId: string; contentMd: string; title: string }
> = {
  name: "read_deliverable",
  description: "Read the current revision of a deliverable. Eval Judge / review use.",
  input: readDeliverableInput,
  async execute(input, ctx) {
    const d = ctx.db.select().from(deliverables).where(eq(deliverables.id, input.deliverableId)).get();
    if (!d || !d.currentRevisionId) throw new Error("deliverable not found");
    const r = ctx.db.select().from(deliverableRevisions)
      .where(eq(deliverableRevisions.id, d.currentRevisionId)).get();
    if (!r) throw new Error("current revision row missing");
    const contentMd = readFileSync(r.artifactPath, "utf8");
    return { revisionId: r.id, contentMd, title: d.title };
  },
};

const respondToLeadInput = z.object({ note: z.string().min(1) });
export const respondToLead: AgentToolDef<z.infer<typeof respondToLeadInput>, { ok: true }> = {
  name: "respond_to_lead",
  description: "Send a free-form note up to your Lead without closing the delegation.",
  input: respondToLeadInput,
  async execute(input, ctx) {
    if (!ctx.delegationId) throw new Error("respond_to_lead requires an active delegation context");
    ctx.db.insert(messages).values({
      id: randomUUID(), agentSessionId: ctx.agentSessionId, sender: ctx.agentSlug,
      type: "delegation_resp", contentJson: { note: input.note, delegationId: ctx.delegationId } as never,
    }).run();
    ctx.emit("specialist_note", { delegationId: ctx.delegationId, note: input.note });
    return { ok: true };
  },
};
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/tools/deliverables.ts packages/server/src/tools/deliverables.test.ts
git commit -m "feat(tools): add submit_deliverable, read_deliverable, respond_to_lead tools"
```

---

## Task 17: Protocol tools — proposals

**Files:**
- Create: `packages/server/src/tools/proposals.ts`
- Test: `packages/server/src/tools/proposals.test.ts`

- [ ] **Write tests** (3 cases):
  - `propose_brief` creates a `briefs` row with status=`draft` and emits `brief_proposed`
  - `propose_memory_update` creates a `memory_proposals` row with status=`pending` and emits `memory_proposed`; does NOT apply the patch yet
  - `propose_memory_update` rejects an empty patch

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/tools/proposals.ts`**

```ts
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { briefs, memoryProposals } from "../db/schema.js";
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
  description: "Propose a structured brief in the chat. The human reviews and clicks Approve to dispatch.",
  input: proposeBriefInput,
  async execute(input, ctx) {
    const id = randomUUID();
    const md = [
      `# ${input.title}`, "",
      `**Scope:** ${input.scope}`, "",
      `**Deliverables:** ${input.deliverables.join(", ")}`,
      input.deadline ? `**Deadline:** ${input.deadline}` : "",
    ].filter(Boolean).join("\n");
    ctx.db.insert(briefs).values({
      id, sourceThreadId: input.threadId, status: "draft", contentMd: md,
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

export const proposeMemoryUpdate: AgentToolDef<
  z.infer<typeof proposeMemoryUpdateInput>,
  { proposalId: string }
> = {
  name: "propose_memory_update",
  description: "Propose a unified-diff patch to a memory file. Human approves, then it's git-committed.",
  input: proposeMemoryUpdateInput,
  async execute(input, ctx) {
    const id = randomUUID();
    ctx.db.insert(memoryProposals).values({
      id, agentSessionId: ctx.agentSessionId, file: input.file, patch: input.patch, status: "pending",
    }).run();
    ctx.emit("memory_proposed", { proposalId: id, file: input.file, by: ctx.agentSlug });
    return { proposalId: id };
  },
};
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/tools/proposals.ts packages/server/src/tools/proposals.test.ts
git commit -m "feat(tools): add propose_brief and propose_memory_update tools"
```

---

## Task 18: Protocol tools — request_input + submit_eval_report

**Files:**
- Create: `packages/server/src/tools/misc.ts`
- Test: `packages/server/src/tools/misc.test.ts`

- [ ] **Write tests:**
  - `request_input` inserts a `chat` message and emits `input_requested`; returns `{ pending: true }`
  - `submit_eval_report` requires `revisionId`, creates `evals` row, transitions deliverable status `awaiting_eval` → `awaiting_approval`, emits `eval_submitted`

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/tools/misc.ts`**

```ts
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { deliverables, deliverableRevisions, evals, messages } from "../db/schema.js";
import type { AgentToolDef } from "./types.js";

const requestInputInput = z.object({
  threadId: z.string(),
  question: z.string(),
});
export const requestInput: AgentToolDef<z.infer<typeof requestInputInput>, { pending: true }> = {
  name: "request_input",
  description: "Ask the human a question and pause for their reply.",
  input: requestInputInput,
  async execute(input, ctx) {
    ctx.db.insert(messages).values({
      id: randomUUID(), threadId: input.threadId, agentSessionId: ctx.agentSessionId,
      sender: ctx.agentSlug, type: "chat",
      contentJson: { text: input.question, isQuestion: true } as never,
    }).run();
    ctx.emit("input_requested", { threadId: input.threadId, question: input.question });
    return { pending: true };
  },
};

const submitEvalReportInput = z.object({
  deliverableRevisionId: z.string(),
  scores: z.object({
    brand_voice: z.number().min(1).max(5),
    factual_accuracy: z.number().min(1).max(5),
    usp_usage: z.number().min(1).max(5),
  }),
  summary: z.string().min(10),
});

export const submitEvalReport: AgentToolDef<
  z.infer<typeof submitEvalReportInput>,
  { evalId: string }
> = {
  name: "submit_eval_report",
  description: "Submit a 3-dim evaluation. Eval Judge only. Advisory — does not block approval.",
  input: submitEvalReportInput,
  async execute(input, ctx) {
    const id = randomUUID();
    ctx.db.insert(evals).values({
      id, revisionId: input.deliverableRevisionId,
      scoresJson: input.scores as never, summaryMd: input.summary,
    }).run();
    const rev = ctx.db.select().from(deliverableRevisions)
      .where(eq(deliverableRevisions.id, input.deliverableRevisionId)).get();
    if (rev) {
      ctx.db.update(deliverables)
        .set({ status: "awaiting_approval", updatedAt: new Date() })
        .where(eq(deliverables.id, rev.deliverableId))
        .run();
    }
    ctx.emit("eval_submitted", { evalId: id, revisionId: input.deliverableRevisionId });
    return { evalId: id };
  },
};
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/tools/misc.ts packages/server/src/tools/misc.test.ts
git commit -m "feat(tools): add request_input and submit_eval_report tools"
```

---

## Task 19: Integration tools — read_memory, web_fetch

**Files:**
- Create: `packages/server/src/tools/integration.ts`
- Test: `packages/server/src/tools/integration.test.ts`

- [ ] **Write tests:**
  - `read_memory` returns `{ frontmatter, body }` from a memory file
  - `read_memory` rejects unknown files
  - `web_fetch` happy path with a stubbed `fetch` returns text content

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/tools/integration.ts`**

```ts
import { z } from "zod";
import { readMemoryFile } from "../memory/read.js";
import type { AgentToolDef } from "./types.js";

const ALLOWED_MEMORY = new Set([
  "client_profile", "brand_guidelines", "ongoing_campaigns", "content_history",
]);

const readMemoryInput = z.object({ file: z.string() });
export function makeReadMemory(dataDir: string): AgentToolDef<
  z.infer<typeof readMemoryInput>,
  { frontmatter: Record<string, unknown>; body: string }
> {
  return {
    name: "read_memory",
    description: "Read the current contents of a memory file. Returns parsed frontmatter and body.",
    input: readMemoryInput,
    async execute(input) {
      if (!ALLOWED_MEMORY.has(input.file))
        throw new Error(`memory file "${input.file}" not allowed. Allowed: ${[...ALLOWED_MEMORY].join(", ")}`);
      const m = readMemoryFile(dataDir, input.file);
      return { frontmatter: m.frontmatter, body: m.body };
    },
  };
}

const webFetchInput = z.object({ url: z.string().url() });
export const webFetch: AgentToolDef<
  z.infer<typeof webFetchInput>,
  { status: number; text: string; contentType: string | null }
> = {
  name: "web_fetch",
  description: "GET a URL and return its text content. Use sparingly.",
  input: webFetchInput,
  async execute(input) {
    const res = await fetch(input.url, {
      headers: { "User-Agent": "agency-orchestrator/0.1" },
    });
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 200_000), contentType: res.headers.get("content-type") };
  },
};
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/tools/integration.ts packages/server/src/tools/integration.test.ts
git commit -m "feat(tools): add read_memory and web_fetch integration tools"
```

---

## Task 20: Tool registry — per-role curated tool sets (hierarchy enforcement)

**Files:**
- Create: `packages/server/src/tools/registry.ts`
- Test: `packages/server/src/tools/registry.test.ts`

- [ ] **Write failing test — strukturális enforcement: Specialist NEM kap delegate toolt, soha**

```ts
import { describe, expect, it } from "vitest";
import { toolsForRole } from "./registry";

describe("tool registry — hierarchy enforcement", () => {
  it("director gets delegate_to_lead but NOT delegate_to_specialist", () => {
    const names = toolsForRole("director", "/tmp").map((t) => t.name);
    expect(names).toContain("delegate_to_lead");
    expect(names).not.toContain("delegate_to_specialist");
    expect(names).toContain("propose_brief");
  });

  it("content-lead gets delegate_to_specialist but NOT delegate_to_lead", () => {
    const names = toolsForRole("content-lead", "/tmp").map((t) => t.name);
    expect(names).toContain("delegate_to_specialist");
    expect(names).not.toContain("delegate_to_lead");
    expect(names).toContain("submit_to_director");
  });

  it("copywriter (specialist) has NO delegate tools and NO submit_to_director", () => {
    const names = toolsForRole("copywriter", "/tmp").map((t) => t.name);
    expect(names).not.toContain("delegate_to_lead");
    expect(names).not.toContain("delegate_to_specialist");
    expect(names).not.toContain("submit_to_director");
    expect(names).toContain("submit_deliverable");
    expect(names).toContain("respond_to_lead");
  });

  it("eval-judge has read_deliverable but NOT submit_deliverable", () => {
    const names = toolsForRole("eval-judge", "/tmp").map((t) => t.name);
    expect(names).toContain("submit_eval_report");
    expect(names).toContain("read_deliverable");
    expect(names).not.toContain("submit_deliverable");
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/tools/registry.ts`**

```ts
import { delegateToLead, delegateToSpecialist, submitToDirector } from "./delegation.js";
import { makeSubmitDeliverable, readDeliverable, respondToLead } from "./deliverables.js";
import { proposeBrief, proposeMemoryUpdate } from "./proposals.js";
import { requestInput, submitEvalReport } from "./misc.js";
import { makeReadMemory, webFetch } from "./integration.js";
import type { AgentToolDef } from "./types.js";

export function toolsForRole(role: string, dataDir: string): AgentToolDef<unknown, unknown>[] {
  const readMemory = makeReadMemory(dataDir);
  const submitDeliverable = makeSubmitDeliverable(dataDir);
  switch (role) {
    case "director":
      return [delegateToLead, proposeBrief, proposeMemoryUpdate, readMemory, webFetch, requestInput] as never;
    case "content-lead":
      return [delegateToSpecialist, submitToDirector, readMemory, requestInput] as never;
    case "copywriter":
      return [submitDeliverable, respondToLead, readMemory, proposeMemoryUpdate, webFetch] as never;
    case "eval-judge":
      return [submitEvalReport, readMemory, readDeliverable] as never;
    default:
      throw new Error(`unknown role: ${role}`);
  }
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/tools/registry.ts packages/server/src/tools/registry.test.ts
git commit -m "feat(tools): add per-role tool registry with structural hierarchy enforcement"
```

---

## Task 21: Agent factory + role registry

**Files:**
- Create: `packages/server/src/agents/factory.ts`
- Test: `packages/server/src/agents/factory.test.ts`

- [ ] **Write failing test**

The factory wraps `pi-agent-core`'s `Agent` class. It returns an Agent configured with: model (per role), system prompt (skill recipes assembled), tools (per registry), `transformContext` (memory injection + retention), `convertToLlm`. The test uses a mocked `streamFn` to avoid LLM calls.

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { makeAgent } from "./factory.js";

describe("agent factory", () => {
  let dir: string; let db: AgencyDb;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-factory-"));
    db = openDb(join(dir, "test.db"));
    mkdirSync(join(dir, "memory"));
    writeFileSync(join(dir, "memory/client_profile.md"), "---\nclient_name: T\n---\nbody");
    writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: x\n---\nb");
    mkdirSync(join(dir, "skills/copywriter"), { recursive: true });
    writeFileSync(join(dir, "skills/copywriter/blog_post_writer.md"),
      "---\nname: blog_post_writer\n---\nWrite for {{client_profile.client_name}}.");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("creates an Agent with the correct tool list for the role", () => {
    const a = makeAgent({ role: "copywriter", dataDir: dir, db, sessionId: "s1" });
    const names = a.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("submit_deliverable");
    expect(names).not.toContain("delegate_to_lead");
  });
});
```

> **Note:** the precise `pi-agent-core` API is `new Agent({ initialState: { systemPrompt, model, tools, ... } })`. Verify the tool list exposure by reading the actual Agent type after `npm install`. If `agent.tools` isn't directly exposed, assert via a different probe (e.g., snapshot the agent options object).

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/agents/factory.ts`**

```ts
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgencyDb } from "../db/index.js";
import { modelForRole } from "../providers/index.js";
import { loadSkillsForRole } from "../skills/loader.js";
import { readMemoryFile } from "../memory/read.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { toolsForRole } from "../tools/registry.js";
import type { ToolContext } from "../tools/types.js";
import { makeTransformContext } from "./transform-context.js";
import { convertToLlm } from "./convert-to-llm.js";

export interface MakeAgentOpts {
  role: string;
  dataDir: string;
  db: AgencyDb;
  sessionId: string;
  delegationId?: string;
  threadId?: string;
  emit: (eventType: string, payload: Record<string, unknown>) => void;
}

const baseSystemPrompt = (role: string, dataDir: string): string => {
  const skills = loadSkillsForRole(dataDir, role);
  const ctx: Record<string, unknown> = {};
  for (const file of ["client_profile", "brand_guidelines"]) {
    const path = join(dataDir, "memory", `${file}.md`);
    if (existsSync(path)) ctx[file] = readMemoryFile(dataDir, file).frontmatter;
  }
  const skillBlocks = skills.map((s) => `## Skill: ${s.frontmatter.name}\n\n${s.render(ctx)}`).join("\n\n");
  return [
    `You are the ${role} agent of the AI marketing agency.`,
    `Use only the tools provided. Do not attempt actions outside your toolset.`,
    `Read memory before making client-specific decisions.`,
    skillBlocks,
  ].join("\n\n");
};

export function makeAgent(opts: MakeAgentOpts) {
  const tools = toolsForRole(opts.role, opts.dataDir);
  const toolContext: ToolContext = {
    db: opts.db, agentSlug: opts.role, agentSessionId: opts.sessionId,
    delegationId: opts.delegationId, threadId: opts.threadId, emit: opts.emit,
  };
  // Adapt our AgentToolDef to pi-agent-core AgentTool shape
  const piTools = tools.map((t) => ({
    name: t.name, description: t.description,
    parameters: t.input as never, // pi-agent-core accepts JSON-schema-like; refine after install
    execute: async (raw: unknown) => {
      const parsed = (t.input as { parse: (v: unknown) => unknown }).parse(raw);
      return await (t as { execute(p: unknown, c: ToolContext): Promise<unknown> })
        .execute(parsed, toolContext);
    },
  }));
  const agent = new Agent({
    initialState: {
      systemPrompt: baseSystemPrompt(opts.role, opts.dataDir),
      model: modelForRole(opts.role),
      tools: piTools as never,
      messages: [],
    },
    convertToLlm,
    transformContext: makeTransformContext({ dataDir: opts.dataDir, role: opts.role }) as never,
    sessionId: opts.sessionId,
  });
  return agent;
}
```

> **Note:** the exact `tools` shape (Zod schema → JSON Schema conversion) depends on the installed `pi-agent-core` version. After `npm install`, look at `node_modules/@mariozechner/pi-agent-core/dist/index.d.ts` and adjust the `parameters` field. Use `zod-to-json-schema` if needed.

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/agents/factory.ts packages/server/src/agents/factory.test.ts
git commit -m "feat(agents): add agent factory wiring tools, model, transformContext, convertToLlm"
```

---

## Task 22: Broker — event bus + persistence

**Files:**
- Create: `packages/server/src/broker/event-bus.ts`
- Test: `packages/server/src/broker/event-bus.test.ts`

The broker is an `EventEmitter` wrapper that **also** persists every event to the SQLite `events` table. SSE subscribers attach to it.

- [ ] **Write failing test**

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { events } from "../db/schema.js";
import { Broker } from "./event-bus.js";

describe("Broker", () => {
  let dir: string; let db: AgencyDb;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-broker-"));
    db = openDb(join(dir, "test.db"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("persists emitted events and notifies subscribers", () => {
    const b = new Broker(db);
    const received: unknown[] = [];
    b.subscribe((e) => received.push(e));
    b.emit("delegation_created", { delegationId: "abc" }, { agentSlug: "director" });
    const rows = db.select().from(events).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("delegation_created");
    expect(received).toHaveLength(1);
  });
});
```

- [ ] **Run — FAIL**

- [ ] **Implement `packages/server/src/broker/event-bus.ts`**

```ts
import { EventEmitter } from "node:events";
import type { AgencyDb } from "../db/index.js";
import { events } from "../db/schema.js";

export interface PersistedEvent {
  id: number;
  ts: Date;
  agentSlug: string | null;
  sessionId: string | null;
  turnId: string | null;
  type: string;
  payload: Record<string, unknown>;
}

export interface EmitMeta {
  agentSlug?: string;
  sessionId?: string;
  turnId?: string;
}

export class Broker {
  private ee = new EventEmitter();
  constructor(private db: AgencyDb) { this.ee.setMaxListeners(0); }

  emit(type: string, payload: Record<string, unknown>, meta: EmitMeta = {}): PersistedEvent {
    const insert = this.db.insert(events).values({
      type, payloadJson: payload as never,
      agentSlug: meta.agentSlug, sessionId: meta.sessionId, turnId: meta.turnId,
    }).returning().get();
    const evt: PersistedEvent = {
      id: insert.id as number, ts: insert.ts as Date,
      agentSlug: insert.agentSlug ?? null, sessionId: insert.sessionId ?? null,
      turnId: insert.turnId ?? null, type, payload,
    };
    this.ee.emit("event", evt);
    return evt;
  }

  subscribe(fn: (e: PersistedEvent) => void): () => void {
    this.ee.on("event", fn);
    return () => this.ee.off("event", fn);
  }
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/broker/event-bus.ts packages/server/src/broker/event-bus.test.ts
git commit -m "feat(broker): add event bus that persists every event and notifies subscribers"
```

---

## Task 23: Broker — routing + lifecycle (warm pool + spawn-per-task)

**Files:**
- Create: `packages/server/src/broker/router.ts`
- Test: `packages/server/src/broker/router.test.ts`

The router owns the agent pool. Director / Content Lead / Eval Judge are warm; Copywriter is spawned per delegation.

- [ ] **Test scenarios:**
  1. Calling `router.dispatchBrief(briefId)` creates a delegation Director → Content Lead, broker emits `delegation_created`, Content Lead's queued prompt completes after stubbed turn (mock streamFn)
  2. Content Lead `delegate_to_specialist` for copywriter → router spawns a fresh Copywriter Agent, runs one turn, then disposes (verify `agent_sessions.endedAt` is set after turn end)
  3. Two simultaneous briefs → Director processes them sequentially (one-at-a-time)

- [ ] **Implementation skeleton (`router.ts`):**

```ts
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, briefs, delegations } from "../db/schema.js";
import { makeAgent } from "../agents/factory.js";
import { Broker } from "./event-bus.js";

const WARM_ROLES = ["director", "content-lead", "eval-judge"];

export class AgentRouter {
  private warm = new Map<string, { agent: ReturnType<typeof makeAgent>; sessionId: string }>();

  constructor(private db: AgencyDb, private broker: Broker, private dataDir: string) {}

  async start(): Promise<void> {
    for (const role of WARM_ROLES) await this.spawnWarm(role);
  }

  private async spawnWarm(role: string): Promise<void> {
    const sessionId = randomUUID();
    this.db.insert(agentSessions).values({ id: sessionId, agentSlug: role, lifecycle: "warm" }).run();
    const agent = makeAgent({
      role, dataDir: this.dataDir, db: this.db, sessionId,
      emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
    });
    this.warm.set(role, { agent, sessionId });
    this.broker.emit("agent_spawned", { role, lifecycle: "warm" }, { agentSlug: role, sessionId });
  }

  async dispatchBrief(briefId: string): Promise<void> {
    const b = this.db.select().from(briefs).where(eq(briefs.id, briefId)).get();
    if (!b) throw new Error(`brief ${briefId} not found`);
    const director = this.warm.get("director");
    if (!director) throw new Error("director not warm");
    this.db.update(briefs).set({ status: "dispatched", dispatchedAt: new Date() })
      .where(eq(briefs.id, briefId)).run();
    await director.agent.prompt(`<human_brief id="${briefId}"/>`);
  }

  async runDelegation(delegationId: string): Promise<void> {
    const d = this.db.select().from(delegations).where(eq(delegations.id, delegationId)).get();
    if (!d) throw new Error(`delegation ${delegationId} not found`);
    this.db.update(delegations).set({ status: "in_progress" }).where(eq(delegations.id, delegationId)).run();

    if (WARM_ROLES.includes(d.toAgent)) {
      const w = this.warm.get(d.toAgent);
      if (!w) throw new Error(`${d.toAgent} not warm`);
      await w.agent.prompt(this.delegationToPrompt(d));
      return;
    }
    // Spawn-per-task
    const sessionId = randomUUID();
    this.db.insert(agentSessions).values({
      id: sessionId, agentSlug: d.toAgent, lifecycle: "transient", parentDelegationId: delegationId,
    }).run();
    const agent = makeAgent({
      role: d.toAgent, dataDir: this.dataDir, db: this.db, sessionId,
      delegationId,
      emit: (type, payload) =>
        this.broker.emit(type, payload, { agentSlug: d.toAgent, sessionId }),
    });
    this.broker.emit("agent_spawned", { role: d.toAgent, lifecycle: "transient" },
      { agentSlug: d.toAgent, sessionId });
    try {
      await agent.prompt(this.delegationToPrompt(d));
    } finally {
      this.db.update(agentSessions).set({ endedAt: new Date() }).where(eq(agentSessions.id, sessionId)).run();
      this.broker.emit("agent_ended", { role: d.toAgent }, { agentSlug: d.toAgent, sessionId });
    }
  }

  private delegationToPrompt(d: { payloadJson: unknown }): string {
    const p = d.payloadJson as { task?: string; context?: string };
    return `<delegation>\ntask: ${p.task}\n${p.context ? `context: ${p.context}` : ""}\n</delegation>`;
  }
}
```

- [ ] **Wire up: when broker emits `delegation_created`, router.runDelegation(...) is invoked.** Add a subscriber inside the router.

```ts
// In start():
this.broker.subscribe((e) => {
  if (e.type === "delegation_created") {
    void this.runDelegation((e.payload as { delegationId: string }).delegationId);
  }
});
```

- [ ] **Run tests — PASS** (with mocked Agent that resolves immediately)

- [ ] **Commit**

```bash
git add packages/server/src/broker/router.ts packages/server/src/broker/router.test.ts
git commit -m "feat(broker): add router with warm agent pool and spawn-per-task lifecycle"
```

---

## Task 24: Broker — boot recovery

**Files:**
- Create: `packages/server/src/broker/recovery.ts`
- Test: `packages/server/src/broker/recovery.test.ts`

- [ ] **Write tests** for the 3 recovery cases from spec §8.3:
  - Warm session with `endedAt IS NULL` → rehydrated, kept running
  - Transient session with `endedAt IS NULL` → marked failed, parent delegation set to `blocked`
  - Delegation with `status='requested'` → re-enqueued (router.runDelegation called)

- [ ] **Implementation skeleton `packages/server/src/broker/recovery.ts`**

```ts
import { eq, isNull } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, delegations } from "../db/schema.js";
import { Broker } from "./event-bus.js";

export async function runBootRecovery(
  db: AgencyDb,
  broker: Broker,
  enqueueDelegation: (id: string) => void,
): Promise<void> {
  // 1) Mark transient orphans as failed
  const orphanTransient = db
    .select()
    .from(agentSessions)
    .where(isNull(agentSessions.endedAt))
    .all()
    .filter((s) => s.lifecycle === "transient");
  for (const s of orphanTransient) {
    db.update(agentSessions).set({ endedAt: new Date() }).where(eq(agentSessions.id, s.id)).run();
    if (s.parentDelegationId) {
      db.update(delegations).set({ status: "blocked" }).where(eq(delegations.id, s.parentDelegationId)).run();
    }
    broker.emit("recovery_orphan_killed", { sessionId: s.id, role: s.agentSlug });
  }
  // 2) Re-enqueue requested delegations
  const pending = db.select().from(delegations).where(eq(delegations.status, "requested")).all();
  for (const d of pending) enqueueDelegation(d.id);
  broker.emit("recovery_complete", { transientKilled: orphanTransient.length, requeued: pending.length });
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/broker/recovery.ts packages/server/src/broker/recovery.test.ts
git commit -m "feat(broker): add boot recovery (orphan transient cleanup, requested delegation requeue)"
```

---

## Task 25: Telemetry + budget guard

**Files:**
- Create: `packages/server/src/telemetry/index.ts`
- Test: `packages/server/src/telemetry/index.test.ts`

- [ ] **Tests:**
  1. `recordTurnEnd({ sessionId, model, promptTokens, completionTokens, latencyMs })` writes a `turns` row with cost calculated from a price table
  2. `isBudgetExceeded(threshold)` returns true when today's spend ≥ threshold
  3. `beforeToolCallBudgetGuard` returns `{ block: true, reason }` when role is non-Director and hard limit hit

- [ ] **Implementation `packages/server/src/telemetry/index.ts`**

```ts
import { randomUUID } from "node:crypto";
import { gte, sum } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { turns } from "../db/schema.js";

const FLAT_PRICE_PER_1K_USD: Record<string, { input: number; output: number }> = {
  "kimi-k2.6": { input: 0.0, output: 0.0 }, // OpenCode Go is flat — no per-token cost
  "deepseek-v4-pro": { input: 0.0, output: 0.0 },
  "minimax-m2.7": { input: 0.0, output: 0.0 },
};
const API_PRICE_PER_1K_USD: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-4-7": { input: 0.003, output: 0.015 },
  "anthropic/claude-haiku-4-5": { input: 0.0008, output: 0.004 },
};

export function priceCents(model: string, promptTokens: number, completionTokens: number): number {
  const tbl = API_PRICE_PER_1K_USD[model] ?? FLAT_PRICE_PER_1K_USD[model] ?? { input: 0, output: 0 };
  const usd = (promptTokens / 1000) * tbl.input + (completionTokens / 1000) * tbl.output;
  return Math.round(usd * 100);
}

export interface TurnEndArgs {
  sessionId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  startedAt: Date;
  endedAt?: Date;
}
export function recordTurnEnd(db: AgencyDb, args: TurnEndArgs): { id: string; costCents: number } {
  const id = randomUUID();
  const costCents = priceCents(args.model, args.promptTokens, args.completionTokens);
  db.insert(turns).values({
    id, sessionId: args.sessionId, model: args.model,
    promptTokens: args.promptTokens, completionTokens: args.completionTokens,
    costUsdCents: costCents, latencyMs: args.latencyMs,
    startedAt: args.startedAt, endedAt: args.endedAt ?? new Date(),
  }).run();
  return { id, costCents };
}

export function todaysSpendCents(db: AgencyDb): number {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const r = db.select({ total: sum(turns.costUsdCents).mapWith(Number) })
    .from(turns).where(gte(turns.startedAt, dayStart)).all();
  return r[0]?.total ?? 0;
}

export function makeBudgetGuard(db: AgencyDb, dailyLimitCents: number) {
  return (role: string): { block: boolean; reason?: string } => {
    if (role === "director") return { block: false };
    const spent = todaysSpendCents(db);
    if (spent >= dailyLimitCents) {
      return { block: true, reason: `Daily budget ${dailyLimitCents}¢ reached. Director-only mode.` };
    }
    return { block: false };
  };
}
```

- [ ] **Modify `packages/server/src/agents/factory.ts`** — after creating the Agent, subscribe to its events and record turns:

```ts
import { recordTurnEnd } from "../telemetry/index.js";

// Inside makeAgent, after creating `agent`:
let turnStart: Date | null = null;
let promptTokens = 0;
let completionTokens = 0;
agent.subscribe((evt: { type: string; usage?: { promptTokens: number; completionTokens: number } }) => {
  if (evt.type === "turn_start") turnStart = new Date();
  if (evt.type === "message_update" && evt.usage) {
    promptTokens = evt.usage.promptTokens;
    completionTokens = evt.usage.completionTokens;
  }
  if (evt.type === "turn_end") {
    const startedAt = turnStart ?? new Date();
    const endedAt = new Date();
    const { id: turnId, costCents } = recordTurnEnd(opts.db, {
      sessionId: opts.sessionId,
      model: modelForRole(opts.role).id,
      promptTokens, completionTokens,
      latencyMs: endedAt.getTime() - startedAt.getTime(),
      startedAt, endedAt,
    });
    opts.emit("turn_recorded", { turnId, costCents, model: modelForRole(opts.role).id });
    turnStart = null; promptTokens = 0; completionTokens = 0;
  }
});
```

> **Note:** the actual pi-agent-core event shape (where `usage` lives, exact field names) needs verification after `npm install`. Adjust the destructuring to match the installed types.

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/telemetry/ packages/server/src/agents/factory.ts
git commit -m "feat(telemetry): record turn cost from pi-agent-core, add budget guard"
```

---

## Task 26: Eval Judge auto-trigger

**Files:**
- Create: `packages/server/src/broker/eval-trigger.ts`
- Test: `packages/server/src/broker/eval-trigger.test.ts`

- [ ] **Test:** when broker emits `deliverable_submitted`, the trigger runs the Eval Judge against the new revision (mocked Agent). After eval completes, `submit_eval_report` flips the deliverable to `awaiting_approval`.

- [ ] **Implementation**

```ts
import { Broker } from "./event-bus.js";
import type { AgentRouter } from "./router.js";

export function attachEvalTrigger(broker: Broker, router: AgentRouter) {
  broker.subscribe((e) => {
    if (e.type !== "deliverable_submitted") return;
    const { deliverableId, revisionId } = e.payload as { deliverableId: string; revisionId: string };
    void router.runEvalForRevision(deliverableId, revisionId);
  });
}
```

- [ ] Add `runEvalForRevision` method to `AgentRouter`:

```ts
async runEvalForRevision(deliverableId: string, revisionId: string): Promise<void> {
  const judge = this.warm.get("eval-judge");
  if (!judge) throw new Error("eval-judge not warm");
  const prompt = `<eval_request deliverableId="${deliverableId}" revisionId="${revisionId}"/>`;
  await judge.agent.prompt(prompt);
}
```

- [ ] **Run tests — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/broker/eval-trigger.ts packages/server/src/broker/router.ts
git commit -m "feat(broker): auto-trigger Eval Judge on deliverable_submitted events"
```

---

## Task 27: Fastify HTTP server + REST routes

**Files:**
- Create: `packages/server/src/server/index.ts`
- Create: `packages/server/src/server/routes/{briefs,messages,approvals,memory,deliverables,threads}.ts`
- Test: `packages/server/src/server/routes.test.ts`

- [ ] **Tests** (with `app.inject`, no real network):
  1. `POST /api/threads` with `{ title }` creates a `chat_threads` row, returns id
  2. `POST /api/messages` with `{ threadId, text }` writes a `chat` message and triggers Director.prompt (mocked)
  3. `POST /api/approvals/:deliverableId` with `{ decision: "approved" }` sets deliverable status to `shipped`, writes `approvals` row
  4. `POST /api/briefs/:id/dispatch` calls `router.dispatchBrief(...)` and the brief moves to `dispatched`
  5. `POST /api/memory-proposals/:id/approve` calls `applyMemoryPatch`; on success the proposal status flips to `approved`

- [ ] **Implementation skeleton `packages/server/src/server/index.ts`**

```ts
import Fastify from "fastify";
import { fastifyStatic } from "@fastify/static";
import { join } from "node:path";
import type { AgencyDb } from "../db/index.js";
import { Broker } from "../broker/event-bus.js";
import { AgentRouter } from "../broker/router.js";
import { registerBriefRoutes } from "./routes/briefs.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerApprovalRoutes } from "./routes/approvals.js";
import { registerMemoryRoutes } from "./routes/memory.js";
import { registerDeliverableRoutes } from "./routes/deliverables.js";
import { registerThreadRoutes } from "./routes/threads.js";
// SSE route is registered in Task 28; do not import here yet.

export async function buildServer(opts: {
  db: AgencyDb; broker: Broker; router: AgentRouter; dataDir: string; webRoot: string;
}) {
  const app = Fastify({ logger: { level: "info" } });
  app.register(fastifyStatic, { root: opts.webRoot, prefix: "/", wildcard: true });
  registerBriefRoutes(app, opts);
  registerMessageRoutes(app, opts);
  registerApprovalRoutes(app, opts);
  registerMemoryRoutes(app, opts);
  registerDeliverableRoutes(app, opts);
  registerThreadRoutes(app, opts);
  return app;
}
```

- [ ] **Implement each route file**. Example `packages/server/src/server/routes/briefs.ts`:

```ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { briefs } from "../../db/schema.js";
import type { AgencyDb } from "../../db/index.js";
import type { AgentRouter } from "../../broker/router.js";

export function registerBriefRoutes(
  app: FastifyInstance,
  opts: { db: AgencyDb; router: AgentRouter },
) {
  app.get("/api/briefs", async () => opts.db.select().from(briefs).all());
  app.post<{ Params: { id: string } }>("/api/briefs/:id/dispatch", async (req, reply) => {
    await opts.router.dispatchBrief(req.params.id);
    return { ok: true };
  });
}
```

(Write the other 5 route files similarly. Each is ~30-50 lines.)

- [ ] **Replace `src/index.ts` with the boot wiring**

```ts
import "dotenv/config";
import { homedir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db/index.js";
import { Broker } from "./broker/event-bus.js";
import { AgentRouter } from "./broker/router.js";
import { runBootRecovery } from "./broker/recovery.js";
import { attachEvalTrigger } from "./broker/eval-trigger.js";
import { initMemoryRepo } from "./memory/write.js";
import { buildServer } from "./server/index.js";

const NAME = process.env.MARQUEE_NAME ?? "marquee";
const dataDir = process.env.DATA_DIR ?? join(homedir(), `.${NAME}`);
const port = Number(process.env.PORT ?? 7892);

async function main() {
  const db = openDb(join(dataDir, "state.db"));
  await initMemoryRepo(dataDir);
  const broker = new Broker(db);
  const router = new AgentRouter(db, broker, dataDir);
  await router.start();
  await runBootRecovery(db, broker, (id) => router.runDelegation(id));
  attachEvalTrigger(broker, router);
  const app = await buildServer({
    db, broker, router, dataDir,
    webRoot: process.env.WEB_ROOT ?? join(import.meta.dirname, "../../web/dist"),
  });
  await app.listen({ host: "0.0.0.0", port });
  console.log(`agency server listening on :${port}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Run tests + smoke build**

```bash
npm test
npm run build
```

- [ ] **Commit**

```bash
git add packages/server/src/server/ packages/server/src/index.ts
git commit -m "feat(server): add Fastify HTTP server with REST routes for chat, briefs, approvals, memory"
```

---

## Task 28: SSE endpoint + snapshot

**Files:**
- Create: `packages/server/src/server/sse.ts`
- Test: `packages/server/src/server/sse.test.ts`

- [ ] **Tests:**
  1. `GET /api/events` upgrades to SSE; emitting an event from the broker pushes a `data:` line to the connected client (use `app.inject` with `payloadAsStream: true`)
  2. `Last-Event-ID` header replays events from `events.id > N` first, then continues with live
  3. `GET /api/state/snapshot` returns approvals, pipeline counts, active sessions, recent messages — single payload

- [ ] **Modify `packages/server/src/server/index.ts`** to import and register the SSE route. Add the import:

```ts
import { registerSseRoute } from "./sse.js";
```

And inside `buildServer` before the `return app;` line:

```ts
  registerSseRoute(app, opts);
```

- [ ] **Implementation `packages/server/src/server/sse.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { eventsAfter, recentEvents } from "../db/queries.js";
import type { AgencyDb } from "../db/index.js";
import type { Broker } from "../broker/event-bus.js";
import { activeAgents, approvalsQueue, pipelineCounts } from "../db/queries.js";
import { chatThreads } from "../db/schema.js";

export function registerSseRoute(
  app: FastifyInstance,
  opts: { db: AgencyDb; broker: Broker },
) {
  app.get("/api/events", (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const lastIdHeader = req.headers["last-event-id"];
    const lastId = lastIdHeader ? Number.parseInt(String(lastIdHeader), 10) : 0;

    if (lastId > 0) {
      for (const e of eventsAfter(opts.db, lastId)) {
        reply.raw.write(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e.payloadJson)}\n\n`);
      }
    } else {
      // Initial backfill: most recent 100
      for (const e of recentEvents(opts.db, 100).reverse()) {
        reply.raw.write(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e.payloadJson)}\n\n`);
      }
    }

    const heartbeat = setInterval(() => reply.raw.write(`: keepalive\n\n`), 15_000);
    const unsub = opts.broker.subscribe((e) => {
      reply.raw.write(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e.payload)}\n\n`);
    });
    req.raw.on("close", () => { clearInterval(heartbeat); unsub(); });
  });

  app.get("/api/state/snapshot", async (_req) => ({
    approvals: approvalsQueue(opts.db),
    pipeline: pipelineCounts(opts.db),
    activeAgents: activeAgents(opts.db),
    threads: opts.db.select().from(chatThreads).where(/* archived_at IS NULL */ undefined as never).all(),
  }));
}
```

- [ ] **Run — PASS**

- [ ] **Commit**

```bash
git add packages/server/src/server/sse.ts packages/server/src/server/sse.test.ts
git commit -m "feat(server): add SSE event endpoint with Last-Event-ID resume + snapshot endpoint"
```

---

## Task 29: Smoke test script

**Files:**
- Create: `packages/server/scripts/smoke.ts`

- [ ] **Implement** — boots the server in-process, posts a brief via REST, polls the deliverable until `awaiting_approval`, asserts within 60s, prints token cost. Uses Haiku 4.5 in api mode to keep predictable.

```ts
import "dotenv/config";
process.env.HERMES_PROVIDER_MODE = "api";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../src/db/index.js";
import { Broker } from "../src/broker/event-bus.js";
import { AgentRouter } from "../src/broker/router.js";
import { initMemoryRepo } from "../src/memory/write.js";
import { briefs, deliverables } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const dataDir = mkdtempSync(join(tmpdir(), "agency-smoke-"));
console.log(`data dir: ${dataDir}`);

(async () => {
  const db = openDb(join(dataDir, "state.db"));
  await initMemoryRepo(dataDir);
  const broker = new Broker(db);
  const router = new AgentRouter(db, broker, dataDir);
  await router.start();

  const briefId = randomUUID();
  db.insert(briefs).values({
    id: briefId, status: "draft",
    contentMd: "# Test\n\n**Scope:** write a 200-word blog post about PLG metrics\n\n**Deliverables:** blog_post",
  }).run();

  const start = Date.now();
  await router.dispatchBrief(briefId);

  while (Date.now() - start < 90_000) {
    await new Promise((r) => setTimeout(r, 2000));
    const ds = db.select().from(deliverables).all();
    if (ds.some((d) => d.status === "awaiting_approval")) {
      console.log("✓ deliverable reached awaiting_approval in", Math.round((Date.now() - start) / 1000), "s");
      process.exit(0);
    }
  }
  console.error("✗ smoke test timed out");
  process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Run**

```bash
export OPENROUTER_API_KEY=...
npm run smoke
```

Expected: `✓ deliverable reached awaiting_approval in <60s`. Cost ~$0.30.

- [ ] **Commit**

```bash
git add packages/server/scripts/smoke.ts
git commit -m "test: add manual smoke test script (Haiku 4.5, ~60s end-to-end)"
```

---

## Task 30: Frontend bootstrap (Vite + React + Tailwind + shadcn/ui)

**Files:**
- Create: `packages/web/package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`
- Create: `packages/web/src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Init package**

```bash
cd packages/web
npm init -y
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom \
  tailwindcss postcss autoprefixer @tanstack/react-query @tanstack/react-router \
  zustand class-variance-authority clsx tailwind-merge lucide-react react-markdown \
  vitest @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

- [ ] **`packages/web/package.json` scripts**

```json
{ "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview --port 5173",
    "test": "vitest run"
} }
```

- [ ] **`vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:7892" } },
  build: { outDir: "dist" },
});
```

- [ ] **`tailwind.config.js`** — content paths to `src/**/*.{ts,tsx}`, plus extend the theme with the design tokens parsed from `~/Projects/Homelab/marquee/DESIGN.md` YAML frontmatter:

```js
import { readFileSync } from "node:fs";
import matter from "gray-matter";
const design = matter(readFileSync("../../DESIGN.md", "utf8")).data;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: design.colors,                    // primary, secondary, ink, cream, ...
      fontFamily: {
        serif: [design.typography["headline-md"].fontFamily, "serif"],
        sans:  [design.typography["body-md"].fontFamily, "sans-serif"],
        mono:  [design.typography["mono-md"].fontFamily, "monospace"],
      },
      fontSize: Object.fromEntries(
        Object.entries(design.typography).map(([k, v]) => [k, [v.fontSize, {
          lineHeight: String(v.lineHeight),
          letterSpacing: v.letterSpacing,
          fontWeight: String(v.fontWeight),
        }]]),
      ),
      borderRadius: design.rounded,             // sm, md, lg, xl, full
      spacing: design.spacing,                  // xs, sm, md, lg, xl, ...
    },
  },
  plugins: [],
};
```

This means a single source of truth: editing `DESIGN.md` reflows Tailwind, no duplicate config.

- [ ] **Add fonts via `index.html`** — Source Serif 4, Inter, JetBrains Mono from Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- [ ] **Initialize shadcn/ui**

```bash
npx shadcn@latest init
# Choose: TypeScript, default style, neutral base, src/components/ui
```

After init, override `src/index.css` CSS variables to map shadcn's semantic tokens (`--background`, `--foreground`, `--primary`, `--card`, `--border`, etc.) to the marquee tokens. Example:

```css
@layer base {
  :root {
    --background: 41 32% 95%;        /* cream */
    --foreground: 240 8% 11%;        /* ink */
    --card: 0 0% 100%;               /* surface-white */
    --card-foreground: 240 8% 11%;   /* ink */
    --primary: 6 63% 47%;            /* primary / Marquee Red */
    --primary-foreground: 0 0% 100%; /* on-primary */
    --secondary: 41 76% 55%;         /* secondary / Bulb Amber */
    --muted: 36 18% 92%;             /* parchment-ish */
    --border: 36 30% 87%;            /* divider */
    --ring: 6 63% 47%;               /* primary for focus rings */
    --radius: 0.25rem;               /* rounded.md = 4px = 0.25rem */
  }
}
```

(Convert the hex values from DESIGN.md to HSL components for shadcn's CSS variable convention. Verify each by visual inspection in the browser after.)

- [ ] **Add baseline shadcn components used in v0.1**

```bash
npx shadcn@latest add button card input textarea dialog scroll-area badge avatar separator tabs sonner
```

- [ ] **`packages/web/src/main.tsx` + `App.tsx`** — minimal app shell that renders "marquee" using `headline-lg` typography and `cream` background to verify the design tokens flow end-to-end.

- [ ] **Build smoke**

```bash
npm run build
```

Expected: clean build to `dist/`.

- [ ] **Commit**

```bash
git add packages/web/
git commit -m "feat(web): bootstrap Vite + React + Tailwind + shadcn/ui frontend"
```

---

## Task 31: Frontend — API client + SSE client + state store

**Files:**
- Create: `packages/web/src/lib/api.ts`
- Create: `packages/web/src/lib/sse.ts`
- Create: `packages/web/src/store/useAgencyStore.ts`
- Test: `packages/web/src/lib/sse.test.ts`

- [ ] **`api.ts`** — fetch wrappers for the 6 REST groups (threads, messages, briefs, approvals, deliverables, memory). Use TanStack Query in components for caching.

```ts
const json = (r: Response) => r.json();
export const api = {
  threads: {
    list: () => fetch("/api/threads").then(json),
    create: (title: string) => fetch("/api/threads", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    }).then(json),
  },
  messages: {
    post: (threadId: string, text: string) => fetch("/api/messages", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId, text }),
    }).then(json),
  },
  briefs: {
    list: () => fetch("/api/briefs").then(json),
    dispatch: (id: string) => fetch(`/api/briefs/${id}/dispatch`, { method: "POST" }).then(json),
  },
  approvals: {
    decide: (deliverableId: string, decision: "approved" | "rejected" | "requested_changes", note?: string) =>
      fetch(`/api/approvals/${deliverableId}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note }),
      }).then(json),
  },
  deliverables: {
    list: () => fetch("/api/deliverables").then(json),
    get: (id: string) => fetch(`/api/deliverables/${id}`).then(json),
    revision: (id: string, revId: string) =>
      fetch(`/api/deliverables/${id}/revisions/${revId}`).then(json),
  },
  memory: {
    proposals: () => fetch("/api/memory-proposals").then(json),
    approve: (id: string) => fetch(`/api/memory-proposals/${id}/approve`, { method: "POST" }).then(json),
    reject: (id: string) => fetch(`/api/memory-proposals/${id}/reject`, { method: "POST" }).then(json),
  },
  snapshot: () => fetch("/api/state/snapshot").then(json),
};
```

- [ ] **`sse.ts`** — `EventSource` wrapper that calls subscribers per event type, persists `lastEventId` in localStorage, exponential reconnect.

```ts
type Handler = (payload: unknown, id: number) => void;
export class AgencyEvents {
  private es: EventSource | null = null;
  private subs = new Map<string, Set<Handler>>();
  start() {
    const lastId = localStorage.getItem("agency:lastEventId");
    const url = lastId ? `/api/events?lastEventId=${lastId}` : "/api/events";
    this.es = new EventSource(url);
    this.es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        const id = Number(msg.lastEventId);
        if (id) localStorage.setItem("agency:lastEventId", String(id));
        for (const h of this.subs.get(msg.type) ?? []) h(payload, id);
      } catch {}
    };
    this.es.onerror = () => {
      this.es?.close();
      setTimeout(() => this.start(), 2000);
    };
  }
  on(type: string, h: Handler) {
    let s = this.subs.get(type);
    if (!s) { s = new Set(); this.subs.set(type, s); }
    s.add(h);
    return () => s!.delete(h);
  }
}
```

- [ ] **`useAgencyStore.ts`** — Zustand store for active threads, current view, draft message, etc.

- [ ] **Test SSE** with a mocked EventSource (`vitest` + jsdom).

- [ ] **Commit**

```bash
git add packages/web/src/lib/ packages/web/src/store/
git commit -m "feat(web): add REST API client, SSE client with reconnect, Zustand state store"
```

---

## Task 32: Frontend — Onboarding chat (full-screen, first-run)

**Files:**
- Create: `packages/web/src/views/onboarding.tsx`
- Create: `packages/web/src/components/chat/{MessageList,ChatInput,BriefProposalCard,MemoryProposalCard}.tsx`

- [ ] **Detection logic** — call `/api/onboarding/status` (a new server route returning `{ isFirstRun: boolean }`); if true, show this view. (Add the route to Task 27 if you haven't.)

- [ ] **Layout**: full-screen with centered chat (max-w-3xl), message list scrollable, sticky input at bottom.

- [ ] **`MessageList.tsx`** — renders `chat`, `brief_proposal`, `memory_proposal`, `tool_call` message types differently. Brief and memory proposals render as cards with action buttons.

- [ ] **`BriefProposalCard.tsx`** — title + scope + deliverables + Approve/Edit/Discard buttons. Approve calls `api.briefs.dispatch(id)`.

- [ ] **`MemoryProposalCard.tsx`** — file name + diff render + Approve/Reject buttons.

- [ ] **`ChatInput.tsx`** — textarea with Cmd-Enter to submit; calls `api.messages.post(threadId, text)`.

- [ ] **Wire SSE** — subscribe to `chat`, `brief_proposed`, `memory_proposed`, `tool_call`, refetch the thread messages via TanStack Query on each.

- [ ] **Commit**

```bash
git add packages/web/src/views/onboarding.tsx packages/web/src/components/chat/
git commit -m "feat(web): add onboarding chat view with brief and memory proposal cards"
```

---

## Task 33: Frontend — Home dashboard (4 widgets)

**Files:**
- Create: `packages/web/src/views/home.tsx`
- Create: `packages/web/src/components/widgets/{ApprovalsWidget,LiveAgentFeed,PipelineWidget,ActiveConversations}.tsx`

- [ ] **Layout** — 2×2 grid in a `<main>`, chat drawer right side.

- [ ] **`ApprovalsWidget`** — list of pending deliverables (`api.snapshot().approvals`); each row clickable → deliverable detail view; "Approve" button inline.

- [ ] **`LiveAgentFeed`** — scrollable list of recent events (subscribe to all event types); each row: timestamp, agent slug badge, event type, short payload summary. Auto-scroll to top on new events. Show "spawn", "tool call", "delegation", "eval" with distinct badges.

- [ ] **`PipelineWidget`** — list of statuses (Drafting / Awaiting Eval / Awaiting Approval / Shipped) with counts, click to filter the deliverable list view (v0.2 will replace with kanban drag-drop).

- [ ] **`ActiveConversations`** — list of open chat threads with last message preview, click → opens the chat drawer to that thread.

- [ ] **Commit**

```bash
git add packages/web/src/views/home.tsx packages/web/src/components/widgets/
git commit -m "feat(web): add home dashboard with 4 widgets (approvals, agent feed, pipeline, conversations)"
```

---

## Task 34: Frontend — Chat drawer + dedicated full view

**Files:**
- Create: `packages/web/src/components/chat/ChatDrawer.tsx`
- Create: `packages/web/src/views/chat-full.tsx`
- Modify: `packages/web/src/App.tsx` (always-mounted drawer)

- [ ] **`ChatDrawer.tsx`** — uses shadcn `Sheet` or custom slide-in component. Right side, `w-96`, collapsible via header button. Tabs along top for active threads (max 3 visible, overflow → menu). Per-tab message list + input.

- [ ] **`chat-full.tsx`** — same components but `max-w-4xl` centered, no other widgets. Routed at `/chat/:threadId`.

- [ ] **`@-mention autocomplete`** — when user types `@`, show dropdown of agent slugs (`director`, `content-lead`, `copywriter`, `eval-judge`). On select, insert the slug.

- [ ] **Commit**

```bash
git add packages/web/src/components/chat/ChatDrawer.tsx packages/web/src/views/chat-full.tsx packages/web/src/App.tsx
git commit -m "feat(web): add chat drawer and full chat view with @-mention autocomplete"
```

---

## Task 35: Frontend — Deliverable detail view

**Files:**
- Create: `packages/web/src/views/deliverable.tsx`
- Create: `packages/web/src/components/deliverable/{MarkdownPreview,EvalHistory,RevisionDiff}.tsx`

- [ ] **Layout** — 3-column: markdown preview (60% w), thread + eval history side panel (40% w). Top bar: deliverable title, status badge, agent owner, "Approve" / "Request changes" buttons.

- [ ] **`MarkdownPreview`** — `react-markdown` with `remark-gfm` and Tailwind typography classes for prose.

- [ ] **`EvalHistory`** — chronological list of eval reports for the deliverable (multiple revisions = multiple evals); each shows the 3 dim scores as horizontal bars + the summary.

- [ ] **`RevisionDiff`** — when more than 1 revision exists, dropdown to compare; render diff with `react-diff-viewer` or similar.

- [ ] **Commit**

```bash
git add packages/web/src/views/deliverable.tsx packages/web/src/components/deliverable/
git commit -m "feat(web): add deliverable detail view (md preview + eval history + revision diff)"
```

---

## Task 36: Frontend — Memory editor

**Files:**
- Create: `packages/web/src/views/memory.tsx`
- Create: `packages/web/src/components/memory/{FileList,Editor,ProposalQueue}.tsx`

- [ ] **`FileList`** — sidebar list of memory files (`client_profile.md`, `brand_guidelines.md`, ...); click selects.

- [ ] **`Editor`** — read-only markdown view by default (with `react-markdown`). Above content: `git log` history dropdown showing last 10 commits. v0.1 does NOT include direct edit (memory is changed via agent proposals); deferred to v0.2 if useful.

- [ ] **`ProposalQueue`** — list of pending `memory_proposals`; each row: agent slug, file, diff preview, Approve/Reject buttons. Approve calls `api.memory.approve(id)` → server runs `applyMemoryPatch`.

- [ ] **Commit**

```bash
git add packages/web/src/views/memory.tsx packages/web/src/components/memory/
git commit -m "feat(web): add memory editor view (file list, read-only editor, proposal queue)"
```

---

## Task 37: systemd unit + deploy script + smoke test in production

**Files:**
- Create: `infra/marquee.service`
- Create: `scripts/deploy.sh`
- Create: `scripts/install-on-vm.sh`

- [ ] **`infra/marquee.service`**

```ini
[Unit]
Description=Agency orchestration UI
After=network.target

[Service]
Type=simple
User=balazs
WorkingDirectory=/opt/marquee
EnvironmentFile=/opt/marquee/.env
ExecStart=/usr/bin/node /opt/marquee/packages/server/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **`scripts/deploy.sh`** (run from monorepo root on dev machine)

```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="balazs@192.168.2.60"
KEY="$HOME/.ssh/id_ed25519"

echo "→ build"
npm run build

echo "→ rsync to VM"
ssh -i "$KEY" "$HOST" "sudo mkdir -p /opt/marquee && sudo chown balazs:balazs /opt/marquee"
rsync -e "ssh -i $KEY" -az --delete \
  --include 'packages/server/dist/***' \
  --include 'packages/server/drizzle/***' \
  --include 'packages/server/package.json' \
  --include 'packages/web/dist/***' \
  --include 'packages/*/' \
  --include 'infra/***' \
  --include 'package.json' \
  --include 'package-lock.json' \
  --exclude '*' \
  ./ "$HOST:/opt/marquee/"

echo "→ npm install on VM"
ssh -i "$KEY" "$HOST" "cd /opt/marquee && npm install --omit=dev"

echo "→ install systemd unit"
ssh -i "$KEY" "$HOST" "sudo cp /opt/marquee/infra/marquee.service /etc/systemd/system/marquee.service && sudo systemctl daemon-reload"

echo "→ disable old wuphf service if running"
ssh -i "$KEY" "$HOST" "sudo systemctl disable --now wuphf || true"

echo "→ restart marquee"
ssh -i "$KEY" "$HOST" "sudo systemctl restart marquee && sudo systemctl status marquee --no-pager"
```

- [ ] **First-run install on VM 260** (manual, once)

```bash
ssh -i ~/.ssh/id_ed25519 balazs@192.168.2.60 \
  "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"
```

- [ ] **NPM proxy + DNS** — on infra-edge (192.168.2.10):

```bash
# DNS: edit /opt/infra-edge/coredns/zones/lab2.home.arpa.zone, add (or rename old wuphf line):
#   marquee     IN A    192.168.2.60
# bump serial; docker compose restart coredns

# NPM: add proxy host marquee.lab2.home.arpa → 192.168.2.60:7892
```

- [ ] **Run deploy + production smoke**

```bash
bash scripts/deploy.sh
ssh balazs@192.168.2.60 "sudo journalctl -u marquee -n 50 --no-pager"
curl -s http://marquee.lab2.home.arpa | head
```

Expected: HTTP 200, HTML containing "marquee".

- [ ] **Final smoke test against production** — open `http://marquee.lab2.home.arpa` in browser, complete onboarding chat, post a brief, verify deliverable reaches `awaiting_approval` within ~2 min, click Approve, verify `shipped`.

- [ ] **Commit**

```bash
git add infra/ scripts/
git commit -m "feat(deploy): add systemd unit and deploy script for VM 260"
```

---

## Self-review checklist

Before declaring v0.1 done, run this against the spec:

- [ ] **Spec §3 decisions covered**: pi-agent runtime (Task 21), no Hermes (Task 1+), Hybrid Y lifecycle (Task 23), SQLite + git memory (Tasks 3-5, 9-11), React stack (Task 30), SSE+REST (Tasks 27-28), tool hierarchy (Task 20), chat first-class + onboarding (Task 32)
- [ ] **Spec §4 architecture diagram**: matches modules in Tasks 22-26 (broker), Tasks 27-28 (server), Task 30 (frontend), Task 37 (deploy)
- [ ] **Spec §5 schema**: every table in Task 3; every dashboard query in Task 5
- [ ] **Spec §6.2 tool sets**: enforced in Task 20 test
- [ ] **Spec §7 onboarding**: Task 32 detects first-run, shows full-screen chat
- [ ] **Spec §8 hibakezelés**:
  - 8.1 (LLM provider): pi-ai built-in retries (no extra task), provider_fallback mechanism deferred to v0.2 (not in v0.1 scope)
  - 8.2 (turn crash): pi-agent-core handles natively; auto-retry deferred to v0.2
  - 8.3 (boot recovery): Task 24
  - 8.4 (memory git rollback): Task 11
  - 8.5 (SSE reconnect): Task 28 with Last-Event-ID
  - 8.6 (budget guard): Task 25
- [ ] **Spec §9 testing**: vitest unit tests in every code task; replay fixtures and `npm run smoke` in Task 29; production telemetry quality widget deferred to v0.2

If any task is missing, add it before declaring v0.1 complete.

---

## Out of scope for v0.1 (referenced in spec, deferred)

- Pipeline kanban drag-and-drop → v0.2
- Budget widget + Quality trend mini-widget → v0.2
- 4 additional roles (Distribution Lead, Insights Lead, Social Manager, SEO Analyst) → v0.2
- `query_matomo`, `serpapi_search`, repurposing loop, manual approval gate, brand voice RAG, cron routines, Telegram gateway → v0.3
- Provider fallback (Kimi → DeepSeek on rate limit) → v0.2
- Auto-retry on transient agent crash → v0.2 (1× retry per spec)
- Memory auto-commit cron → v0.3
