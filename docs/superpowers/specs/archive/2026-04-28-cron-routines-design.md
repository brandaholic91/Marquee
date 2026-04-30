# Marquee — Cron Routines Design

**Dátum:** 2026-04-28
**Státusz:** jóváhagyva (brainstorm)
**Kapcsolódó:** `2026-04-27-orchestration-ui-design.md` (v0.3 deferred items)

---

## Goal

Négy cron rutin implementálása: (1) memory auto-commit a meglévő daily summary fájlokhoz, (2) reggeli ügynökségi briefing a Director chat-en keresztül, (3) heti teljesítményjelentés az Analytics Analyst pipeline-on át, (4) havi stratégiai review Director → memory proposals formájában.

## Architecture

Minden cron a meglévő `CronManager`-ben regisztrál. A broker-alapú triggerelést alkalmazzuk: a cron funkciók `broker.emit("human_message", ...)` vagy `broker.emit("delegation_created", ...)` eventeket bocsátanak ki — a router meglévő `onEvent` handlere kezeli őket. A cron funkciók nem függenek az `AgentRouter`-től, csak a `Broker`-től, az `AgencyDb`-től és a `dataDir`-től.

**Context-rich approach (B):** minden cron függvény előre lekérdezi a releváns DB adatokat és azokat injektálja az agent promptjába, minimalizálva az extra tool call körök számát.

## Tech Stack

Node.js 22, TypeScript, SQLite/Drizzle ORM, simple-git, node-cron (már telepítve).

---

## 1. Memory Auto-Commit

**Fájl:** `packages/server/src/cron/daily-summary.ts` (kiegészítés)

A `runDailySummary` végén, a `writeFileSync` után:

```typescript
try {
  const git = simpleGit(dataDir);
  if (await git.checkIsRepo()) {
    await git.add(filePath);
    await git.commit(`memory: daily summary ${today}`);
  }
} catch { /* best effort — file written, git optional */ }
```

Az import `simpleGit` hozzáadása szükséges. Ugyanaz a minta mint `packages/server/src/memory/seed.ts` és `packages/server/src/server/routes/memory.ts`.

---

## 2. morning_brief

**Új fájl:** `packages/server/src/cron/morning-brief.ts`

**Szignatúra:**
```typescript
export async function runMorningBrief(
  db: AgencyDb,
  dataDir: string,
  broker: Broker,
): Promise<void>
```

**Folyamat:**
1. Tegnapi `daily_notes/YYYY-MM-DD.md` beolvasása (ha létezik)
2. Pending deliverables lekérdezése (`awaiting_approval`, `awaiting_eval` státuszok)
3. Aktív delegációk lekérdezése (`requested`, `in_progress` státuszok)
4. Új `consultative` típusú chat thread létrehozása: `"Morning Brief — YYYY-MM-DD"`
5. `messages` táblába `human` sender típusú üzenet írása
6. `broker.emit("human_message", { threadId, text })` → router `handleChatMessage` → Director válaszol

**Prompt struktúra:**
```
Good morning. Here is today's context:

## Yesterday's activity
[yesterday's daily_notes content — or "No activity recorded." if file missing]

## Pending work
- N deliverable(s) awaiting approval
- N deliverable(s) awaiting eval
- N delegation(s) in progress

Based on this, what should the agency focus on today?
Summarize in 3-5 bullet points and suggest one concrete next action.
```

**DB lekérdezések:**
```typescript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const notesPath = join(dataDir, "memory", "daily_notes",
  `${yesterday.toISOString().slice(0, 10)}.md`);

const pendingDeliverables = db.select().from(deliverables)
  .where(inArray(deliverables.status, ["awaiting_approval", "awaiting_eval"])).all();

const activeDelegations = db.select().from(delegations)
  .where(inArray(delegations.status, ["requested", "in_progress"])).all();
```

**Thread kezelés:** Minden reggel új thread jön létre. A Director amúgy is kapja az utolsó 3 nap `daily_notes`-át automatikusan a `transform-context.ts`-en keresztül, ezért nincs szükség a korábbi Morning Brief thread-ek kontextusára.

**Kimenet:** `agent_message` SSE event → megjelenik a chat UI-ban a Morning Brief thread-ben.

**CronManager regisztráció:**
```typescript
{ id: "morning_brief", name: "Morning Brief", expression: "0 7 * * *",
  description: "Napi ügynökségi briefing a Director chat-en", enabled: true }
```

---

## 3. weekly_performance_report

**Új fájl:** `packages/server/src/cron/weekly-report.ts`

**Szignatúra:**
```typescript
export async function runWeeklyReport(
  db: AgencyDb,
  dataDir: string,
  broker: Broker,
): Promise<void>
```

**Folyamat:**
1. Elmúlt 7 nap statisztikák lekérdezése (sessions, delegations, deliverables, evals)
2. Összefoglaló kontextus string építése
3. Delegáció létrehozása: `fromAgent: "cron"`, `toAgent: "insights-lead"`, `status: "requested"`
4. `broker.emit("delegation_created", { delegationId, from: "cron", to: "insights-lead" })` → router → insights-lead → `delegate_to_specialist("analytics-analyst", ...)` → `performance_report` deliverable

**Context a delegáció payloadjában:**
```
Weekly performance report — week of YYYY-MM-DD

## Activity this week
- Sessions: N (director: X turns, content-lead: Y turns, ...)
- Delegations: N completed, N in progress, N blocked
- Deliverables shipped: N | Awaiting approval: N
- Eval scores (avg): brand_voice: X.X, factual_accuracy: X.X, usp_usage: X.X

Delegate this to analytics-analyst to produce a full performance_report deliverable.
The analyst should use query_matomo and serpapi_search for live data if available.
```

**DB lekérdezések (elmúlt 7 nap):**
```typescript
const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const sessions = db.select().from(agentSessions)
  .where(gte(agentSessions.startedAt, weekStart)).all();
const weekDelegations = db.select().from(delegations)
  .where(gte(delegations.requestedAt, weekStart)).all();
const weekDeliverables = db.select().from(deliverables)
  .where(gte(deliverables.updatedAt, weekStart)).all();
const weekEvals = db.select().from(evals)
  .where(gte(evals.createdAt, weekStart)).all();
```

**Kimenet:** `performance_report` típusú deliverable az approval queue-ban; eval-judge automatikusan kiértékeli.

**CronManager regisztráció:**
```typescript
{ id: "weekly_report", name: "Weekly Performance Report", expression: "0 8 * * 1",
  description: "Heti teljesítményjelentés Analytics Analyst-on keresztül", enabled: true }
```

---

## 4. monthly_strategy_review

**Új fájl:** `packages/server/src/cron/monthly-review.ts`

**Szignatúra:**
```typescript
export async function runMonthlyReview(
  db: AgencyDb,
  dataDir: string,
  broker: Broker,
): Promise<void>
```

**Folyamat:**
1. Aktuális hónap első napjától számított statisztikák lekérdezése
2. Meglévő `daily_notes` fájlok felsorolása (dátum lista)
3. Új `consultative` chat thread + `human_message` emit → Director válaszol
4. Director `propose_memory_update` toollal javaslatokat tesz → pending memory proposals
5. Human jóváhagyja/elutasítja a Memory nézetben

**Prompt struktúra:**
```
Monthly strategy review — YYYY-MM (previous month)

## Activity this month
- Total sessions: N | Total turns: N | Estimated cost: Xc
- Deliverables shipped: N | Avg eval score: X.X/5
- Top performing: "[title]" (eval: X.X) — if any
- Blocked delegations: N

## Daily notes available
daily_notes/YYYY-MM-01, daily_notes/YYYY-MM-02, ... (only existing files listed)
(Use read_memory to read specific days if needed.)

## Your task
Review this month's performance. Then propose updates using propose_memory_update:
1. ongoing_campaigns.md — what worked, what to continue, what to drop
2. client_profile.md — update ICP or positioning if it has evolved
```

**DB lekérdezések (előző hónap — a cron 1-jén fut, ezért az előző hónap adatait kell lekérdezni):**
```typescript
const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // előző hónap 1.
const monthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);     // aktuális hónap 1. (exclusive)

const monthSessions = db.select().from(agentSessions)
  .where(and(gte(agentSessions.startedAt, monthStart), lt(agentSessions.startedAt, monthEnd))).all();
const monthDeliverables = db.select().from(deliverables)
  .where(and(gte(deliverables.updatedAt, monthStart), lt(deliverables.updatedAt, monthEnd))).all();
const monthEvals = db.select().from(evals)
  .where(and(gte(evals.createdAt, monthStart), lt(evals.createdAt, monthEnd))).all();
const monthTurns = db.select().from(turns)
  .where(and(gte(turns.startedAt, monthStart), lt(turns.startedAt, monthEnd))).all();
```

**Daily notes lista:** `readdirSync(join(dataDir, "memory", "daily_notes"))` — csak az előző hónapra szűrve (`YYYY-MM-` prefix alapján).

**Kimenet:** Pending memory proposals (`ongoing_campaigns.md`, esetleg `client_profile.md`) a Memory nézetben.

**CronManager regisztráció:**
```typescript
{ id: "monthly_review", name: "Monthly Strategy Review", expression: "0 9 1 * *",
  description: "Havi stratégiai review Director → memory proposals", enabled: true }
```

---

## 5. Index.ts változások

`packages/server/src/index.ts`-ben a meglévő `cronManager.register` blokk kiegészítése:

```typescript
import { runMorningBrief } from "./cron/morning-brief.js";
import { runWeeklyReport } from "./cron/weekly-report.js";
import { runMonthlyReview } from "./cron/monthly-review.js";

cronManager.register(
  { id: "morning_brief", name: "Morning Brief", expression: "0 7 * * *",
    description: "Napi ügynökségi briefing a Director chat-en", enabled: true },
  () => runMorningBrief(db, dataDir, broker).catch(console.error),
);
cronManager.register(
  { id: "weekly_report", name: "Weekly Performance Report", expression: "0 8 * * 1",
    description: "Heti teljesítményjelentés Analytics Analyst-on keresztül", enabled: true },
  () => runWeeklyReport(db, dataDir, broker).catch(console.error),
);
cronManager.register(
  { id: "monthly_review", name: "Monthly Strategy Review", expression: "0 9 1 * *",
    description: "Havi stratégiai review Director → memory proposals", enabled: true },
  () => runMonthlyReview(db, dataDir, broker).catch(console.error),
);
```

---

## 6. Testing

- `cron/daily-summary.test.ts` (meglévő) — kiegészítés: git commit hívás ellenőrzése
- `cron/morning-brief.test.ts` (új): prompt felépítése mock adatokkal, thread létrehozás, `human_message` event emittálása
- `cron/weekly-report.test.ts` (új): delegation létrehozás, payload tartalom, `delegation_created` event
- `cron/monthly-review.test.ts` (új): prompt felépítése, thread létrehozás, daily notes lista

---

## 7. Error Handling

Minden cron `.catch(console.error)` wrapper-rel fut — hiba esetén logol, nem crashel. A git commit a daily summary-ban `best effort` — ha a git nem elérhető, a fájl megmarad. Az agent timeout/error a meglévő broker event error handling-en keresztül kezelt.
