# Cron Routines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four cron routines — memory auto-commit on the existing daily summary, a daily morning briefing via Director chat, a weekly performance report via Analytics Analyst, and a monthly strategy review via Director memory proposals.

**Architecture:** All cron functions receive `(db, dataDir, broker)` — no dependency on `AgentRouter`. `morning_brief` and `monthly_review` emit `human_message` broker events (picked up by the router's existing `handleChatMessage`). `weekly_report` emits `delegation_created` (same as the repurpose endpoint pattern). Memory auto-commit is a `simpleGit` addition to the existing `runDailySummary`.

**Tech Stack:** Node.js 22, TypeScript, SQLite/Drizzle ORM, simple-git (already installed), node-cron (already installed).

---

## File Map

**Modified files**
- `packages/server/src/cron/daily-summary.ts` — add simpleGit import + git commit after writeFileSync
- `packages/server/src/cron/daily-summary.test.ts` — add git commit verification test
- `packages/server/src/index.ts` — add 3 new cron imports + registrations

**New files**
- `packages/server/src/cron/morning-brief.ts` — `runMorningBrief(db, dataDir, broker)`
- `packages/server/src/cron/morning-brief.test.ts`
- `packages/server/src/cron/weekly-report.ts` — `runWeeklyReport(db, dataDir, broker)`
- `packages/server/src/cron/weekly-report.test.ts`
- `packages/server/src/cron/monthly-review.ts` — `runMonthlyReview(db, dataDir, broker)`
- `packages/server/src/cron/monthly-review.test.ts`

---

### Task 1: Memory auto-commit — extend runDailySummary with git commit

**Files:**
- Modify: `packages/server/src/cron/daily-summary.ts`
- Modify: `packages/server/src/cron/daily-summary.test.ts`

- [ ] **Step 1: Add failing test**

Open `packages/server/src/cron/daily-summary.test.ts`. First add `execSync` to the existing `node:child_process` import at the top of the file (add the import line after the other imports if it doesn't exist yet):

```typescript
import { execSync } from "node:child_process";
```

Then add a new `describe` block after the existing ones:

```typescript
describe("runDailySummary — git commit", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cron-git-test-"));
    execSync("git init", { cwd: dir });
    execSync("git config user.email test@test.com", { cwd: dir });
    execSync("git config user.name Test", { cwd: dir });
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("commits the daily notes file to git", async () => {
    await runDailySummary(db, dir);
    const log = execSync("git log --oneline", { cwd: dir }).toString();
    expect(log).toContain("memory: daily summary");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/server && npx vitest run src/cron/daily-summary.test.ts
```

Expected: FAIL — "your branch has no commits" or git log empty.

- [ ] **Step 3: Add simpleGit import and git commit to daily-summary.ts**

In `packages/server/src/cron/daily-summary.ts`, add the import at the top:

```typescript
import { simpleGit } from "simple-git";
```

At the end of `runDailySummary`, after `writeFileSync(join(dir, `${today}.md`), md, "utf8")`, add:

```typescript
try {
  const git = simpleGit(dataDir);
  if (await git.checkIsRepo()) {
    await git.add(filePath);
    await git.commit(`memory: daily summary ${today}`);
  }
} catch { /* best effort — file is written, git is optional */ }
```

Where `filePath` is `join(dir, `${today}.md`)` — rename the variable in the function if needed. The full updated end of `runDailySummary` should be:

```typescript
const dir = join(dataDir, "memory", "daily_notes");
mkdirSync(dir, { recursive: true });
const filePath = join(dir, `${today}.md`);
writeFileSync(filePath, md, "utf8");

try {
  const git = simpleGit(dataDir);
  if (await git.checkIsRepo()) {
    await git.add(filePath);
    await git.commit(`memory: daily summary ${today}`);
  }
} catch { /* best effort */ }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/server && npx vitest run src/cron/daily-summary.test.ts
```

Expected: all tests PASS (3 tests).

- [ ] **Step 5: Run full suite**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/cron/daily-summary.ts packages/server/src/cron/daily-summary.test.ts
git commit -m "feat: git commit daily notes file after daily summary is written"
```

---

### Task 2: morning-brief cron

**Files:**
- Create: `packages/server/src/cron/morning-brief.ts`
- Create: `packages/server/src/cron/morning-brief.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/cron/morning-brief.test.ts`:

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { Broker } from "../broker/event-bus.js";
import { runMorningBrief } from "./morning-brief.js";
import { chatThreads, messages } from "../db/schema.js";

describe("runMorningBrief", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;
  let broker: Broker;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "morning-brief-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    broker = new Broker(db);
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("creates a consultative chat thread titled Morning Brief", async () => {
    await runMorningBrief(db, dir, broker);
    const threads = db.select().from(chatThreads).all();
    expect(threads).toHaveLength(1);
    expect(threads[0].type).toBe("consultative");
    expect(threads[0].title).toContain("Morning Brief");
  });

  it("inserts a human chat message into the thread", async () => {
    await runMorningBrief(db, dir, broker);
    const msgs = db.select().from(messages).all();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sender).toBe("human");
    expect(msgs[0].type).toBe("chat");
  });

  it("emits human_message broker event with threadId and text", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runMorningBrief(db, dir, broker);
    const event = emitted.find((e) => e.type === "human_message");
    expect(event).toBeDefined();
    expect(event!.payload.threadId).toBeTruthy();
    expect(typeof event!.payload.text).toBe("string");
  });

  it("includes 'Good morning' in the prompt text", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runMorningBrief(db, dir, broker);
    const event = emitted.find((e) => e.type === "human_message");
    expect(event!.payload.text as string).toContain("Good morning");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/server && npx vitest run src/cron/morning-brief.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create morning-brief.ts**

Create `packages/server/src/cron/morning-brief.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { chatThreads, messages, deliverables, delegations } from "../db/schema.js";
import type { Broker } from "../broker/event-bus.js";

export async function runMorningBrief(
  db: AgencyDb,
  dataDir: string,
  broker: Broker,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const notesPath = join(dataDir, "memory", "daily_notes", `${yesterdayStr}.md`);
  const notesContent = existsSync(notesPath)
    ? readFileSync(notesPath, "utf8").trim()
    : "No activity recorded.";

  const pending = db.select().from(deliverables)
    .where(inArray(deliverables.status, ["awaiting_approval", "awaiting_eval"])).all();
  const awaitingApproval = pending.filter((d) => d.status === "awaiting_approval").length;
  const awaitingEval = pending.filter((d) => d.status === "awaiting_eval").length;

  const active = db.select().from(delegations)
    .where(inArray(delegations.status, ["requested", "in_progress"])).all();

  const text = [
    "Good morning. Here is today's context:",
    "",
    "## Yesterday's activity",
    notesContent,
    "",
    "## Pending work",
    `- ${awaitingApproval} deliverable(s) awaiting approval`,
    `- ${awaitingEval} deliverable(s) awaiting eval`,
    `- ${active.length} delegation(s) in progress`,
    "",
    "Based on this, what should the agency focus on today?",
    "Summarize in 3-5 bullet points and suggest one concrete next action.",
  ].join("\n");

  const threadId = randomUUID();
  db.insert(chatThreads).values({
    id: threadId,
    type: "consultative",
    title: `Morning Brief — ${today}`,
  }).run();

  db.insert(messages).values({
    id: randomUUID(),
    threadId,
    sender: "human",
    type: "chat",
    contentJson: { text } as never,
  }).run();

  broker.emit("human_message", { threadId, text });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/server && npx vitest run src/cron/morning-brief.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/cron/morning-brief.ts packages/server/src/cron/morning-brief.test.ts
git commit -m "feat: add morning_brief cron — daily Director briefing via chat thread"
```

---

### Task 3: weekly-report cron

**Files:**
- Create: `packages/server/src/cron/weekly-report.ts`
- Create: `packages/server/src/cron/weekly-report.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/cron/weekly-report.test.ts`:

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { Broker } from "../broker/event-bus.js";
import { runWeeklyReport } from "./weekly-report.js";
import { delegations } from "../db/schema.js";
import { eq } from "drizzle-orm";

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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/server && npx vitest run src/cron/weekly-report.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create weekly-report.ts**

Create `packages/server/src/cron/weekly-report.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { gte } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, delegations, deliverables, evals } from "../db/schema.js";
import type { Broker } from "../broker/event-bus.js";

export async function runWeeklyReport(
  db: AgencyDb,
  _dataDir: string,
  broker: Broker,
): Promise<void> {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const sessions = db.select().from(agentSessions)
    .where(gte(agentSessions.startedAt, weekStart)).all();
  const weekDelegations = db.select().from(delegations)
    .where(gte(delegations.requestedAt, weekStart)).all();
  const weekDeliverables = db.select().from(deliverables)
    .where(gte(deliverables.updatedAt, weekStart)).all();
  const weekEvals = db.select().from(evals)
    .where(gte(evals.createdAt, weekStart)).all();

  const sessionsByAgent = new Map<string, number>();
  for (const s of sessions) {
    sessionsByAgent.set(s.agentSlug, (sessionsByAgent.get(s.agentSlug) ?? 0) + 1);
  }
  const sessionSummary = [...sessionsByAgent.entries()]
    .map(([slug, count]) => `${slug}: ${count}`)
    .join(", ") || "none";

  const shipped = weekDeliverables.filter((d) => d.status === "shipped").length;
  const awaitingApproval = weekDeliverables.filter((d) => d.status === "awaiting_approval").length;
  const completed = weekDelegations.filter((d) => d.status === "complete").length;
  const inProgress = weekDelegations.filter((d) => d.status === "in_progress").length;
  const blocked = weekDelegations.filter((d) => d.status === "blocked").length;

  let avgScores = "no evals this week";
  if (weekEvals.length > 0) {
    const scores = weekEvals.map(
      (e) => e.scoresJson as { brand_voice?: number; factual_accuracy?: number; usp_usage?: number },
    );
    const avg = (key: "brand_voice" | "factual_accuracy" | "usp_usage"): string => {
      const vals = scores.map((s) => s[key]).filter((v): v is number => v != null);
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "n/a";
    };
    avgScores = `brand_voice: ${avg("brand_voice")}, factual_accuracy: ${avg("factual_accuracy")}, usp_usage: ${avg("usp_usage")}`;
  }

  const task = [
    `Weekly performance report — week of ${weekStartStr}`,
    "",
    "## Activity this week",
    `- Sessions: ${sessions.length} (${sessionSummary})`,
    `- Delegations: ${completed} completed, ${inProgress} in progress, ${blocked} blocked`,
    `- Deliverables shipped: ${shipped} | Awaiting approval: ${awaitingApproval}`,
    `- Eval scores (avg): ${avgScores}`,
    "",
    "Delegate this to analytics-analyst to produce a full performance_report deliverable.",
    "The analyst should use query_matomo and serpapi_search for live data if available.",
  ].join("\n");

  const delegationId = randomUUID();
  db.insert(delegations).values({
    id: delegationId,
    fromAgent: "cron",
    toAgent: "insights-lead",
    status: "requested",
    payloadJson: { task } as never,
  }).run();

  broker.emit("delegation_created", { delegationId, from: "cron", to: "insights-lead" });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/server && npx vitest run src/cron/weekly-report.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/cron/weekly-report.ts packages/server/src/cron/weekly-report.test.ts
git commit -m "feat: add weekly_report cron — delegates to insights-lead for performance_report"
```

---

### Task 4: monthly-review cron

**Files:**
- Create: `packages/server/src/cron/monthly-review.ts`
- Create: `packages/server/src/cron/monthly-review.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/cron/monthly-review.test.ts`:

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { Broker } from "../broker/event-bus.js";
import { runMonthlyReview } from "./monthly-review.js";
import { chatThreads, messages } from "../db/schema.js";

describe("runMonthlyReview", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;
  let broker: Broker;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "monthly-review-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    broker = new Broker(db);
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("creates a consultative thread titled Monthly Strategy Review", async () => {
    await runMonthlyReview(db, dir, broker);
    const threads = db.select().from(chatThreads).all();
    expect(threads).toHaveLength(1);
    expect(threads[0].type).toBe("consultative");
    expect(threads[0].title).toContain("Monthly Strategy Review");
  });

  it("inserts a human chat message", async () => {
    await runMonthlyReview(db, dir, broker);
    const msgs = db.select().from(messages).all();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sender).toBe("human");
    expect(msgs[0].type).toBe("chat");
  });

  it("emits human_message event with threadId and text", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runMonthlyReview(db, dir, broker);
    const event = emitted.find((e) => e.type === "human_message");
    expect(event).toBeDefined();
    expect(event!.payload.threadId).toBeTruthy();
  });

  it("includes propose_memory_update instructions in prompt", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runMonthlyReview(db, dir, broker);
    const event = emitted.find((e) => e.type === "human_message");
    expect(event!.payload.text as string).toContain("propose_memory_update");
    expect(event!.payload.text as string).toContain("ongoing_campaigns");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/server && npx vitest run src/cron/monthly-review.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create monthly-review.ts**

Create `packages/server/src/cron/monthly-review.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { and, gte, lt } from "drizzle-orm";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, chatThreads, deliverables, evals, messages, turns } from "../db/schema.js";
import type { Broker } from "../broker/event-bus.js";

export async function runMonthlyReview(
  db: AgencyDb,
  dataDir: string,
  broker: Broker,
): Promise<void> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = monthStart.toISOString().slice(0, 7); // "YYYY-MM"

  const monthSessions = db.select().from(agentSessions)
    .where(and(gte(agentSessions.startedAt, monthStart), lt(agentSessions.startedAt, monthEnd))).all();
  const monthDeliverables = db.select().from(deliverables)
    .where(and(gte(deliverables.updatedAt, monthStart), lt(deliverables.updatedAt, monthEnd))).all();
  const monthEvals = db.select().from(evals)
    .where(and(gte(evals.createdAt, monthStart), lt(evals.createdAt, monthEnd))).all();
  const monthTurns = db.select().from(turns)
    .where(and(gte(turns.startedAt, monthStart), lt(turns.startedAt, monthEnd))).all();

  const shipped = monthDeliverables.filter((d) => d.status === "shipped").length;
  const totalCostCents = monthTurns.reduce((sum, t) => sum + t.costUsd, 0);

  let avgEval = "n/a";
  if (monthEvals.length > 0) {
    const allScores = monthEvals.flatMap((e) => {
      const s = e.scoresJson as { brand_voice?: number; factual_accuracy?: number; usp_usage?: number };
      return [s.brand_voice, s.factual_accuracy, s.usp_usage].filter((v): v is number => v != null);
    });
    if (allScores.length > 0) {
      avgEval = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
    }
  }

  const notesDir = join(dataDir, "memory", "daily_notes");
  const noteFiles = existsSync(notesDir)
    ? readdirSync(notesDir)
        .filter((f) => f.startsWith(monthLabel) && f.endsWith(".md"))
        .sort()
        .map((f) => `daily_notes/${f.replace(/\.md$/, "")}`)
    : [];

  const lines = [
    `Monthly strategy review — ${monthLabel} (previous month)`,
    "",
    "## Activity this month",
    `- Total sessions: ${monthSessions.length} | Total turns: ${monthTurns.length} | Estimated cost: ${totalCostCents}c`,
    `- Deliverables shipped: ${shipped} | Avg eval score: ${avgEval}/5`,
    "",
  ];

  if (noteFiles.length > 0) {
    lines.push(
      "## Daily notes available",
      noteFiles.join(", "),
      "(Use read_memory to read specific days if needed.)",
      "",
    );
  }

  lines.push(
    "## Your task",
    "Review this month's performance. Then propose updates using propose_memory_update:",
    "1. ongoing_campaigns.md — what worked, what to continue, what to drop",
    "2. client_profile.md — update ICP or positioning if it has evolved",
  );

  const text = lines.join("\n");

  const threadId = randomUUID();
  db.insert(chatThreads).values({
    id: threadId,
    type: "consultative",
    title: `Monthly Strategy Review — ${monthLabel}`,
  }).run();

  db.insert(messages).values({
    id: randomUUID(),
    threadId,
    sender: "human",
    type: "chat",
    contentJson: { text } as never,
  }).run();

  broker.emit("human_message", { threadId, text });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/server && npx vitest run src/cron/monthly-review.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/cron/monthly-review.ts packages/server/src/cron/monthly-review.test.ts
git commit -m "feat: add monthly_review cron — Director chat thread with memory update instructions"
```

---

### Task 5: Wire all crons in index.ts

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Add imports**

In `packages/server/src/index.ts`, after the existing `import { runDailySummary }` line, add:

```typescript
import { runMorningBrief } from "./cron/morning-brief.js";
import { runWeeklyReport } from "./cron/weekly-report.js";
import { runMonthlyReview } from "./cron/monthly-review.js";
```

- [ ] **Step 2: Register new crons**

In `packages/server/src/index.ts`, after the existing `cronManager.register({ id: "daily_summary", ... })` block and before `cronManager.start()`, add:

```typescript
cronManager.register(
  {
    id: "morning_brief",
    name: "Morning Brief",
    expression: "0 7 * * *",
    description: "Napi ügynökségi briefing a Director chat-en",
    enabled: true,
  },
  () => runMorningBrief(db, dataDir, broker).catch(console.error),
);
cronManager.register(
  {
    id: "weekly_report",
    name: "Weekly Performance Report",
    expression: "0 8 * * 1",
    description: "Heti teljesítményjelentés Analytics Analyst-on keresztül",
    enabled: true,
  },
  () => runWeeklyReport(db, dataDir, broker).catch(console.error),
);
cronManager.register(
  {
    id: "monthly_review",
    name: "Monthly Strategy Review",
    expression: "0 9 1 * *",
    description: "Havi stratégiai review Director → memory proposals",
    enabled: true,
  },
  () => runMonthlyReview(db, dataDir, broker).catch(console.error),
);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass (previous + 11 new).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat: register morning_brief, weekly_report, monthly_review crons in index.ts"
```
