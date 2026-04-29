# Marquee — Brief Orchestrator (Workflow Engine)

**Dátum:** 2026-04-29
**Státusz:** jóváhagyva

---

## Cél

Egy generikus, kódban definiált workflow engine a brief pipeline-ok vezérlésére. Az agensek nem orchestrálják egymást — a szerver oldali orchestrátor irányítja a lépéseket, az agensek egyszerű, egylépéses feladatokat hajtanak végre.

## Probléma amit megold

A jelenlegi eseményvezérelt architektúrában:
- A lead agensek (insights-lead) a workflow közepén re-delegálnak ahelyett hogy szintetizálnának
- Nincs explicit fáziskövetés — a rendszer "elfelejti" hol tart egy brief
- Jóváhagyás után a pipeline folytatása ad-hoc, megbízhatatlan
- Szerver újraindítás után elakadt delegálások maradnak

---

## Architektúra

### Workflow definíció formátum

```typescript
interface WorkflowStep {
  id: string;
  agent: string;
  taskFn: (ctx: WorkflowContext) => string;
  condition?: (ctx: WorkflowContext) => boolean; // ha false, skip
  requiresApproval?: boolean;
  extractOutput?: (deliverable: DeliverableRow) => Partial<WorkflowState>;
}

interface WorkflowDef {
  id: string;
  deliverableTypes: string[];  // mikor aktiválódik
  steps: WorkflowStep[];
}

interface WorkflowContext {
  brief: { id: string; contentMd: string; topic?: string };
  campaign?: { id: string; title: string };
  state: WorkflowState;  // akkumulált adatok az előző lépésekből
}

interface WorkflowState {
  keywords?: string;         // SEO lépés kimenete
  deliverableId?: string;    // az aktív deliverable
  [key: string]: unknown;    // lépésspecifikus adatok
}
```

### Workflow definíciók (fájlonként)

```
packages/server/src/workflows/
  index.ts               // registry: deliverableType → WorkflowDef
  blog_post.ts           // SEO → write → approval
  linkedin_post.ts       // write → approval
  landing_page.ts        // SEO → write → approval
  twitter_thread.ts      // write → approval
  seo_report.ts          // research → approval
  case_study.ts          // research → write → approval
  ad_copy.ts             // write → approval
  email.ts               // write → approval
```

### `workflow_runs` tábla

```sql
CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL REFERENCES briefs(id),
  campaign_id TEXT REFERENCES campaigns(id),
  workflow_id TEXT NOT NULL,
  current_step_id TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running',
    -- 'running' | 'awaiting_approval' | 'complete' | 'failed'
  active_delegation_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### `BriefOrchestrator` osztály

`packages/server/src/broker/orchestrator.ts`

```typescript
class BriefOrchestrator {
  // Lifecycle
  onBriefDispatched(briefId: string): void
  onDeliverableShipped(deliverableId: string): void
  onDeliverableReady(deliverableId: string): void  // eval kész
  onApprovalDecision(deliverableId: string, decision: string, note?: string): void

  // Belső
  private startRun(brief, workflow): WorkflowRun
  private advanceRun(run: WorkflowRun): void
  private executeStep(run, step): void   // delegálást hoz létre
  private resolveContext(run): WorkflowContext
}
```

---

## Fázisátmenetek

| Esemény | Feltétel | Következő akció |
|---|---|---|
| `brief_dispatched` | — | workflow kiválasztása → run létrehozása → 1. lépés indítása |
| `deliverable_shipped` | run.status = running, step.extractOutput van | state frissítés → `advanceRun()` |
| `deliverable_shipped` | run.status = running, step.requiresApproval | status → `awaiting_approval` |
| `approved` | run.status = awaiting_approval | `advanceRun()` (következő lépés v. complete) |
| `rejected` | run.status = awaiting_approval | status → `failed` |
| `requested_changes` | run.status = awaiting_approval | retryCount++ → ugyanaz a lépés újra |

---

## Példa workflow definíciók

### `blog_post.ts`

```typescript
export const blogPostWorkflow: WorkflowDef = {
  id: "blog_post",
  deliverableTypes: ["blog_post"],
  steps: [
    {
      id: "seo",
      agent: "insights-lead",
      condition: (ctx) => !ctx.state.keywords,
      taskFn: (ctx) => `Végezz kulcsszókutatást blog_post deliverable-hoz. Téma: ${ctx.brief.contentMd.slice(0, 200)}`,
      // Az seo_report artifact szövegéből kinyeri az "Elsődleges kulcsszó:" sort
      extractOutput: (d) => {
        const content = readArtifact(d.artifactPath);
        const match = content.match(/\*\*Elsődleges kulcsszó[^:]*\*\*[:\s]+([^\n]+)/);
        return { keywords: match?.[1]?.trim() ?? null };
      },
    },
    {
      id: "write",
      agent: "content-lead",
      taskFn: (ctx) => [
        `Írj 1 db blog_post deliverable-t.`,
        ctx.state.keywords ? `Elsődleges kulcsszó: ${ctx.state.keywords}` : "",
        `Brief: ${ctx.brief.contentMd}`,
      ].filter(Boolean).join("\n"),
      requiresApproval: true,
    }
  ]
}
```

### `linkedin_post.ts`

```typescript
export const linkedinPostWorkflow: WorkflowDef = {
  id: "linkedin_post",
  deliverableTypes: ["linkedin_post"],
  steps: [
    {
      id: "write",
      agent: "distribution-lead",
      taskFn: (ctx) => `Készíts 1 db linkedin_post deliverable-t.\nBrief: ${ctx.brief.contentMd}`,
      requiresApproval: true,
    }
  ]
}
```

---

## Integrációs pontok

### `router.ts` — egyszerűsítés

`queueBrief()` az orchestratort hívja a director promptolása helyett. A warm director megmarad chat-hez.

### `approvals.ts` — lecsupaszítás

Az összes ad-hoc re-delegálási logika kikerül. Egy hívás marad:
```typescript
opts.orchestrator.onApprovalDecision(deliverableId, decision, note);
```

### `eval-trigger.ts` — orchestrátor értesítése

```typescript
// Eval kész → orchestrátor dönt a következő lépésről
opts.orchestrator.onDeliverableReady(deliverableId);
```

### `index.ts` — orchestrátor injektálása

```typescript
const orchestrator = new BriefOrchestrator(db, broker, router);
orchestrator.boot();
```

---

## DB migráció

Új fájl: `packages/server/drizzle/0004_workflow_runs.sql`

```sql
CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  campaign_id TEXT,
  workflow_id TEXT NOT NULL,
  current_step_id TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running',
  active_delegation_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

---

## Nem változik

- Összes agent (director, content-lead, copywriter, stb.)
- Skill fájlok
- Tool registry
- UI (SSE, pipeline kanban, approvals, memory)
- Chat director
- Memory rendszer

---

## Visszafelé kompatibilitás

A jelenlegi `brief_dispatched` → director prompt flow **párhuzamosan** fut az orchestrátorral az átmeneti időszakban. Az orchestrátor csak azokra a brief típusokra aktiválódik, amelyekhez van regisztrált workflow. A többi briefnél a régi flow marad.
