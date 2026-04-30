# Marquee Plan v1 — Kampánytervezési réteg implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kampánytervezési domain-réteg bevezetése (`campaign_plans` + `campaign_calendar_items`), Director-vezetett tervezési chat-flow, és brief származtatás calendar item-ből. A spec részletes hivatkozása: `docs/superpowers/specs/2026-04-30-marquee-campaign-plan-design.md`.

**Architecture:**

- DB-ben két új tábla + 2 új mező (`briefs.calendar_item_id`, `chat_threads.campaign_id`).
- 4 új Director tool (`propose_campaign_plan`, `update_campaign_plan`, `propose_calendar_item`, `get_campaign_plan`) + 2 meglévő bővítés (`propose_brief`, `get_campaign_status`).
- Új broker modul: `calendar-state-machine.ts` az item státusz-átmenetekhez.
- Új REST endpoint-ok és SSE event-család (`plan.*`, `calendar_item.*`).
- 2 új Director skill recipe + 2 meglévő bővítés.
- Új frontend nézet: `CampaignDetail.tsx` (Plan tab + Plan-chat tab) + új komponensek (`PlanEditor`, `CalendarItemCard`, `PlanProposalCard`, `CalendarItemProposalCard`).

**Tech Stack:** Node.js 22, TypeScript, Fastify 5, better-sqlite3 + Drizzle, React 19, Vite, Zustand, Tailwind 3, `@mariozechner/pi-agent-core`

**CWD a vitest-hez:** `cd packages/server` mindig (CLAUDE.md gotcha: `migrationsFolder: 'drizzle'` relatív path).

**Branch:** `master`. Worktree nincs.

---

## Fájltérkép

### Új fájlok

| Fájl | Miért |
|---|---|
| `packages/server/drizzle/0007_campaign_plans.sql` | Migration: `campaign_plans` + `campaign_calendar_items` táblák, `briefs.calendar_item_id`, `chat_threads.campaign_id` |
| `packages/server/src/tools/get-campaign-plan.ts` | Read-only lookup tool a Director-nak |
| `packages/server/src/tools/get-campaign-plan.test.ts` | Tool teszt |
| `packages/server/src/tools/propose-campaign-plan.ts` | Director összegző javaslat-tool |
| `packages/server/src/tools/propose-campaign-plan.test.ts` | Tool teszt |
| `packages/server/src/tools/update-campaign-plan.ts` | Tervmódosítás-javaslat tool |
| `packages/server/src/tools/update-campaign-plan.test.ts` | Tool teszt |
| `packages/server/src/tools/propose-calendar-item.ts` | Egyetlen calendar item javaslat tool |
| `packages/server/src/tools/propose-calendar-item.test.ts` | Tool teszt |
| `packages/server/src/broker/calendar-state-machine.ts` | Item státusz event-driven átmenetei |
| `packages/server/src/broker/calendar-state-machine.test.ts` | State machine unit teszt |
| `packages/server/src/server/routes/plans.ts` | Plan + Calendar item REST endpoint-ok |
| `packages/server/src/server/routes/plans.test.ts` | Route teszt |
| `packages/server/seed/skills/director/kampany_tervezes.md` | Új Director skill recipe (top-down tervezés) |
| `packages/server/seed/skills/director/terv_kontextusu_brief.md` | Új Director skill recipe (item → brief) |
| `packages/web/src/views/CampaignDetail.tsx` | Új detail nézet két tab-bal |
| `packages/web/src/components/PlanEditor.tsx` | Plan editor form |
| `packages/web/src/components/CalendarItemCard.tsx` | Calendar item kártya |
| `packages/web/src/components/CalendarItemEditModal.tsx` | Új / szerkesztő modal item-hez |
| `packages/web/src/components/PlanProposalCard.tsx` | Director plan javaslat kártya |
| `packages/web/src/components/CalendarItemProposalCard.tsx` | Director item javaslat kártya |

### Módosított fájlok

| Fájl | Mit változtat |
|---|---|
| `packages/server/src/db/schema.ts` | `campaignPlans`, `campaignCalendarItems` táblák; `briefs.calendarItemId`, `chatThreads.campaignId` mezők |
| `packages/server/src/db/schema.test.ts` | Új táblák jelenlétét és mezőit ellenőrzi |
| `packages/server/src/db/queries.ts` | Plan + calendar item CRUD függvények, thread `campaign_id` filter, brief `calendarItemId` propagálás |
| `packages/server/src/db/queries.test.ts` | Új query tesztek |
| `packages/server/src/db/index.ts` | Migration applier — 0007 hash + auto-apply (csak ha új DB) |
| `packages/server/src/agents/config.ts` | Director tools list bővítés 4 új tool-lal |
| `packages/server/src/agents/config.test.ts` | Director tools assertion frissítés |
| `packages/server/src/agents/factory.ts` | 4 új tool registry-be felvétel |
| `packages/server/src/tools/get-campaign-status.ts` | Output kibővítés `plan` blokkal |
| `packages/server/src/tools/propose-brief.ts` | Opcionális `calendar_item_id` input + validáció |
| `packages/server/src/tools/propose-brief.test.ts` | Új validációs esetek |
| `packages/server/src/server/routes/threads.ts` | `campaign_id` query filter + body átvétel POST-on |
| `packages/server/src/server/routes/threads.test.ts` | Új filter teszt |
| `packages/server/src/server/routes/briefs.ts` | Brief listázás `calendar_item_id` filter, response kibővítés |
| `packages/server/src/server/routes/campaigns.ts` | Kampány-detail response: plan summary embed |
| `packages/server/src/server/index.ts` | `plansRoutes` regisztráció |
| `packages/server/src/server/sse.ts` | Új SSE event-ek: `plan.*`, `calendar_item.*` |
| `packages/server/src/server/sse.test.ts` | Új event tesztek |
| `packages/server/src/broker/router.ts` | `dispatchBrief` átadja a `calendar_item_id`-t a brief létrejöttkor |
| `packages/server/src/broker/event-bus.ts` | Új event-ek emit-elése (calendar state machine integráció) |
| `packages/server/seed/skills/director/delegate.md` | Plan-aware bővítés (get_campaign_plan first) |
| `packages/server/seed/skills/director/brief_intake.md` | Plan-aware: ha thread campaign_id-vel scope-olva, jelezze ad-hoc brief tényét |
| `packages/server/src/scripts/smoke.ts` | Új smoke step: kampány-tervezési flow + brief származtatás |
| `packages/web/src/lib/api.ts` | `plansApi`, `threadsApi.list({ campaignId })`, `calendarApi` |
| `packages/web/src/lib/sse.ts` | Plan + calendar item event-ek bekapcsolása |
| `packages/web/src/store/useMarqueeStore.ts` | `plans` slice + új SSE handler-ek |
| `packages/web/src/views/Campaigns.tsx` | Kampány-kártyára plan progress, klikk → `/campaigns/:id` |
| `packages/web/src/components/BriefProposalCard.tsx` | Calendar item chip megjelenítése, ha brief.calendarItemId van |
| `packages/web/src/views/Workshop.tsx` | Plan-chat thread mode érzékelés (campaign_id-s thread-eken) |
| `packages/web/src/App.tsx` | Új route: `/campaigns/:id` → `CampaignDetail` |

---

## Task 1: Spec-olvasás és preflight ellenőrzés

**Files:** csak ellenőrzés.

- [ ] **Lépés 1: Olvasd át a specet**

A teljes spec: `docs/superpowers/specs/2026-04-30-marquee-campaign-plan-design.md`. A 3., 4., 5., 8. szakaszok a leginkább task-szempontból kötöttek (domain modell, DB schema, tool API, skill-ek). A 9. szakasz (Implementációs sorrend) és a 10. (Kockázatok) ad kontextust a sorrendre.

- [ ] **Lépés 2: Baseline TS és vitest zöld**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run build --workspaces
cd packages/server && npx tsc --noEmit && npx vitest run
cd ../web && npx tsc --noEmit
```

Expected: minden zöld. Ha nem, FIX először, csak utána haladj. Ne kezdj a Plan v1-en, ha a master már piros.

- [ ] **Lépés 3: Dev DATA_DIR állapot**

```bash
ls /home/brandaholic/.marquee-dev/
sqlite3 /home/brandaholic/.marquee-dev/state.db ".tables"
sqlite3 /home/brandaholic/.marquee-dev/state.db "SELECT * FROM __drizzle_migrations;"
```

Jegyezd fel, milyen migrációk vannak alkalmazva. A 0001–0006 hash-okat látnod kell. Ha valamelyik hiányzik, alkalmazd manuálisan a CLAUDE.md gotcha alapján, **mielőtt** a 0007-et alkalmaznád.

---

## Task 2: Drizzle schema kiegészítés (failing tests first)

**Files:**

- Modify: `packages/server/src/db/schema.test.ts`

- [ ] **Lépés 1: Bővítsd a schema.test.ts-t — várj `campaign_plans` és `campaign_calendar_items` jelenlétét**

```typescript
// packages/server/src/db/schema.test.ts — új blokk:

describe('campaignPlans schema', () => {
  it('campaignPlans table exists with required columns', () => {
    // Drizzle table column lookup pattern (a meglévő tesztek mintáját kövesd)
    expect(campaignPlans).toBeDefined();
    expect(campaignPlans.campaignId).toBeDefined();
    expect(campaignPlans.goal).toBeDefined();
    expect(campaignPlans.goalType).toBeDefined();
    expect(campaignPlans.audience).toBeDefined();
    expect(campaignPlans.keyMessages).toBeDefined();
    expect(campaignPlans.channelMix).toBeDefined();
    expect(campaignPlans.timelineStart).toBeDefined();
    expect(campaignPlans.timelineEnd).toBeDefined();
    expect(campaignPlans.kpi).toBeDefined();
  });
});

describe('campaignCalendarItems schema', () => {
  it('campaignCalendarItems table exists with required columns', () => {
    expect(campaignCalendarItems).toBeDefined();
    expect(campaignCalendarItems.planId).toBeDefined();
    expect(campaignCalendarItems.channel).toBeDefined();
    expect(campaignCalendarItems.targetDate).toBeDefined();
    expect(campaignCalendarItems.intent).toBeDefined();
    expect(campaignCalendarItems.status).toBeDefined();
  });
});

describe('briefs and chatThreads new fields', () => {
  it('briefs has calendarItemId field', () => {
    expect(briefs.calendarItemId).toBeDefined();
  });
  it('chatThreads has campaignId field', () => {
    expect(chatThreads.campaignId).toBeDefined();
  });
});
```

- [ ] **Lépés 2: Futtasd a tesztet — failel-e**

```bash
cd packages/server && npx vitest run src/db/schema.test.ts
```

Expected: FAIL — `campaignPlans is not defined`.

---

## Task 3: Drizzle schema implementáció

**Files:**

- Modify: `packages/server/src/db/schema.ts`

- [ ] **Lépés 1: Add a két új táblát a schema.ts végére (a `deliverableReviews` után)**

```typescript
// packages/server/src/db/schema.ts — fájl végéhez hozzáadás:

export const campaignPlans = sqliteTable(
  'campaign_plans',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id').notNull().references(() => campaigns.id),
    clientSlug: text('client_slug').notNull().references(() => clients.slug),
    goal: text('goal').notNull().default(''),
    goalType: text('goal_type', {
      enum: ['lead-gen', 'awareness', 'nurture', 'activation', 'retention', 'other'],
    }).notNull().default('other'),
    audience: text('audience').notNull().default(''),
    keyMessages: text('key_messages', { mode: 'json' })
      .$type<Array<{ id: string; text: string }>>()
      .notNull()
      .default([]),
    channelMix: text('channel_mix', { mode: 'json' })
      .$type<Array<{ channel: string; weight: number; note?: string }>>()
      .notNull()
      .default([]),
    timelineStart: integer('timeline_start'),
    timelineEnd: integer('timeline_end'),
    kpi: text('kpi').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqueCampaign: uniqueIndex('uq_campaign_plans_campaign').on(t.campaignId),
  }),
);

export const campaignCalendarItems = sqliteTable(
  'campaign_calendar_items',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id').notNull().references(() => campaignPlans.id),
    campaignId: text('campaign_id').notNull().references(() => campaigns.id),
    clientSlug: text('client_slug').notNull().references(() => clients.slug),
    channel: text('channel', {
      enum: ['linkedin', 'email', 'blog', 'landing', 'ad', 'other'],
    }).notNull(),
    deliverableType: text('deliverable_type', {
      enum: ['social_post', 'email', 'blog_post', 'ad_copy', 'content_brief_seo', 'seo_report'],
    }),
    targetDate: integer('target_date').notNull(),
    intent: text('intent').notNull().default(''),
    keyMessageRef: text('key_message_ref'),
    status: text('status', {
      enum: ['planned', 'brief_created', 'delivered', 'cancelled'],
    }).notNull().default('planned'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    byPlanStatus: index('idx_calendar_plan_status').on(t.planId, t.status, t.targetDate),
    byCampaign: index('idx_calendar_campaign').on(t.campaignId, t.targetDate),
  }),
);
```

- [ ] **Lépés 2: A `briefs` tábla definícióját bővítsd `calendarItemId` mezővel**

```typescript
// A meglévő briefs definíció kibővül:
calendarItemId: text('calendar_item_id').references(() => campaignCalendarItems.id),
```

(A FK önreferenciás körkörös típus miatt forward-deklaráció szükséges — a Drizzle TypeScript-szempontból elnézi, hogy a `campaignCalendarItems` később jön a fájlban; ha mégis hibát ad, áthelyezhető a `campaign*` táblák a `briefs` elé.)

- [ ] **Lépés 3: A `chatThreads` tábla definícióját bővítsd `campaignId` mezővel**

```typescript
campaignId: text('campaign_id').references(() => campaigns.id),
```

- [ ] **Lépés 4: TS check + Vitest**

```bash
cd packages/server && npx tsc --noEmit && npx vitest run src/db/schema.test.ts
```

Expected: zöld.

---

## Task 4: Migration SQL fájl

**Files:**

- Create: `packages/server/drizzle/0007_campaign_plans.sql`

- [ ] **Lépés 1: Hozd létre a migration fájlt** (a spec 4.1 szakaszában a teljes SQL található; másold be)

- [ ] **Lépés 2: Snapshot json frissítés (`drizzle/meta/_journal.json`)**

A meglévő pattern szerint a Drizzle CLI-vel kéne, de a 0.36.0-s tracking bug miatt itt kézi journal-bővítés is működik. Egyszerűsített megoldás: futtasd a `drizzle-kit generate` parancsot, ha a meta journal-t szinkronizálnia kell. Ha hibát ad, manuálisan adj hozzá egy bejegyzést a `0007_campaign_plans` migration-höz a snapshot-ba.

```bash
cd packages/server && npx drizzle-kit generate --name=campaign_plans
```

(Ha a generate command új migrationt csinálna, töröld az auto-generálttal és tartsd meg a kézi 0007-et — azonos tartalommal.)

- [ ] **Lépés 3: Manuális alkalmazás dev DB-re**

```bash
sqlite3 /home/brandaholic/.marquee-dev/state.db < packages/server/drizzle/0007_campaign_plans.sql
HASH=$(sha256sum packages/server/drizzle/0007_campaign_plans.sql | awk '{print $1}')
sqlite3 /home/brandaholic/.marquee-dev/state.db "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('$HASH', $(date +%s%3N));"
sqlite3 /home/brandaholic/.marquee-dev/state.db ".tables"
```

Expected: kimenet tartalmazza a `campaign_plans` és `campaign_calendar_items` táblákat.

- [ ] **Lépés 4: Briefek + chat_threads sémaellenőrzés**

```bash
sqlite3 /home/brandaholic/.marquee-dev/state.db "PRAGMA table_info(briefs);"
sqlite3 /home/brandaholic/.marquee-dev/state.db "PRAGMA table_info(chat_threads);"
```

Expected: `briefs` tartalmazza a `calendar_item_id` oszlopot, `chat_threads` a `campaign_id` oszlopot.

---

## Task 5: Queries — Plan + Calendar item CRUD

**Files:**

- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/src/db/queries.test.ts`

- [ ] **Lépés 1: Először a tesztek**

```typescript
// packages/server/src/db/queries.test.ts — új blokk:

describe('campaign plan queries', () => {
  let dbHelper;
  beforeEach(async () => { dbHelper = await openTestDb(); });

  it('createPlan inserts and returns the plan', async () => {
    const planId = await createPlan(dbHelper.db, {
      campaignId: 'c1', clientSlug: 'default',
      goal: 'Lead-gen Q2', goalType: 'lead-gen', audience: 'magyar B2B SaaS',
      keyMessages: [{ id: 'tracking', text: 'Tracking az alap' }],
      channelMix: [{ channel: 'linkedin', weight: 60 }, { channel: 'email', weight: 40 }],
      timelineStart: 1714521600, timelineEnd: 1719792000, kpi: '50 audit kitöltés',
    });
    const fetched = await getPlanByCampaignId(dbHelper.db, 'c1');
    expect(fetched).not.toBeNull();
    expect(fetched.id).toBe(planId);
    expect(fetched.keyMessages).toEqual([{ id: 'tracking', text: 'Tracking az alap' }]);
  });

  it('updatePlan partial patch', async () => { /* ... */ });
  it('createCalendarItem and listByPlan', async () => { /* ... */ });
  it('updateCalendarItemStatus state machine call', async () => { /* ... */ });
  it('cancelCalendarItem soft cancel only', async () => { /* ... */ });
});

describe('thread campaign filter', () => {
  it('listThreads filters by campaignId', async () => { /* ... */ });
});

describe('brief calendarItemId', () => {
  it('createBrief with calendarItemId persists the FK', async () => { /* ... */ });
});
```

- [ ] **Lépés 2: Implementálás (queries.ts)**

A meglévő pattern (createCampaign, getCampaignById, listCampaigns) mintáját követjük:

- `createPlan(db, input): Promise<string>` — id generálás `crypto.randomUUID()`-vel, `INSERT OR IGNORE` a unique constraint-ra (1 plan per campaign).
- `getPlanByCampaignId(db, campaignId): Promise<CampaignPlanRow | null>` — JOIN-mentes egyszerű SELECT.
- `getPlanById(db, planId)` — calendar items külön query-vel.
- `updatePlan(db, planId, patch)` — Drizzle `.update().set({ ... }).where(...)` — JSON mezők at-rest serializálva, `updatedAt` mindig új epoch.
- `listCalendarItems(db, planId, filter?: { status?, fromDate?, toDate? })` — index-aware sort `targetDate` szerint.
- `createCalendarItem(db, input): Promise<string>`
- `updateCalendarItem(db, itemId, patch)`
- `deleteCalendarItem(db, itemId)` — csak ha `status === 'planned'` és nincs hivatkozó brief; egyébként hibát dob ("Use cancel instead").
- `cancelCalendarItem(db, itemId)` — soft-cancel (`status = 'cancelled'`).
- `setCalendarItemStatus(db, itemId, newStatus)` — internal, csak a state machine hívja (ld. Task 11).
- `listThreadsByCampaign(db, clientSlug, campaignId): Promise<ChatThreadRow[]>` — bővíti a `listThreads`-et opcionális `campaignId` paraméterrel.
- `createBrief` kibővítése `calendarItemId?` paraméterrel.

- [ ] **Lépés 3: Vitest zöld**

```bash
cd packages/server && npx vitest run src/db/queries.test.ts
```

---

## Task 6: db/index.ts migration applier ellenőrzés

**Files:**

- Modify (ha kell): `packages/server/src/db/index.ts`

A `openDb` mostani logikája Drizzle migration-eket alkalmaz a `drizzle/` mappából. Új DB-n (pl. VM 260) a 0007 automatikusan beolvasztásra kerül. Itt csak validáljuk, hogy a fájl-felfedezés rendben fut.

- [ ] **Lépés 1: Friss DB teszt**

```bash
mkdir -p /tmp/marquee-fresh-test
DATA_DIR=/tmp/marquee-fresh-test cd packages/server && npx tsx -e "import { openDb } from './src/db/index.js'; const db = openDb('/tmp/marquee-fresh-test'); console.log('OK');"
sqlite3 /tmp/marquee-fresh-test/state.db ".tables"
```

Expected: tartalmazza a `campaign_plans` és `campaign_calendar_items` táblákat. Ha nem, a `drizzle-kit` snapshot-ot frissíteni kell (Task 4 / Lépés 2).

- [ ] **Lépés 2: Cleanup**

```bash
rm -rf /tmp/marquee-fresh-test
```

---

## Task 7: get_campaign_plan tool

**Files:**

- Create: `packages/server/src/tools/get-campaign-plan.ts`
- Create: `packages/server/src/tools/get-campaign-plan.test.ts`

- [ ] **Lépés 1: Először a teszt**

```typescript
// get-campaign-plan.test.ts
describe('get_campaign_plan', () => {
  it('returns null plan if campaign has no plan yet', async () => { /* ... */ });
  it('returns plan summary + calendar progress', async () => { /* ... */ });
  it('groups calendar items by status', async () => { /* ... */ });
});
```

- [ ] **Lépés 2: Implementáció**

A `get-campaign-status.ts` mintáját követjük. Tool input: `{ campaign_id: string }`. Output:

```typescript
{
  has_plan: boolean,
  plan?: {
    id, goal, goal_type, audience, key_messages, channel_mix,
    timeline_start, timeline_end, kpi,
    calendar_progress: { planned: number, brief_created: number, delivered: number, cancelled: number },
    upcoming_items: Array<{ id, channel, type, target_date, intent, key_message_ref, status }>  // legfrissebb 10 planned + brief_created
  }
}
```

A tool-handler `dataDir` és `clientSlug`-ot kap (mint a többi), `campaign_id`-vel `getPlanByCampaignId` hívás + `listCalendarItems`.

- [ ] **Lépés 3: Vitest zöld**

```bash
cd packages/server && npx vitest run src/tools/get-campaign-plan.test.ts
```

---

## Task 8: propose_campaign_plan tool

**Files:**

- Create: `packages/server/src/tools/propose-campaign-plan.ts`
- Create: `packages/server/src/tools/propose-campaign-plan.test.ts`

- [ ] **Lépés 1: Először a teszt — input validáció + message insert**

A `propose-brief.ts` mintát követi: a tool **nem** ír közvetlenül a `campaign_plans` táblába, hanem egy `messages` rekordot hoz létre `type: 'plan_proposal'` típussal a thread-be. Az approve flow operátor-felelősség (Task 17 — REST `POST /api/plans/proposals/:id/accept`).

```typescript
describe('propose_campaign_plan', () => {
  it('inserts a plan_proposal message into the thread', async () => { /* ... */ });
  it('rejects payload with missing required fields', async () => { /* ... */ });
  it('validates calendar_items items individually', async () => { /* ... */ });
  it('rejects key_message_ref pointing to nonexistent key_messages.id', async () => { /* ... */ });
});
```

- [ ] **Lépés 2: Implementáció**

Input schema (TypeScript) — ld. spec 5.1. Validációk:

- `campaign_id` létezik a DB-ben és `clientSlug` egyezik
- `goal` non-empty, `goal_type` enum-érték
- `key_messages` minden item-jén egyedi `id` és nem üres `text`
- `channel_mix.weight` összesen 0–100 közötti (warning, ha != 100, error ha > 100)
- `calendar_items` lehet üres tömb; ha kitöltött, minden item-en `key_message_ref` ha kitöltött, mutasson a `key_messages[].id`-re
- `rationale` non-empty

Backend a `messages` táblába egy `content_json`-t ír, ami a teljes javaslatot tartalmazza: `{ proposal: <Input>, status: 'pending' }`. A frontend ezt rendereli `PlanProposalCard`-ként.

- [ ] **Lépés 3: Vitest zöld**

---

## Task 9: update_campaign_plan tool

**Files:**

- Create: `packages/server/src/tools/update-campaign-plan.ts`
- Create: `packages/server/src/tools/update-campaign-plan.test.ts`

- [ ] **Lépés 1: Teszt — patch validáció**

A `propose_campaign_plan`-hez hasonló javaslat-flow, csak meglévő tervre. Tool input: `{ plan_id, patch, rationale }`. A `messages` rekord típus: `'plan_update_proposal'`.

- [ ] **Lépés 2: Implementáció**

`patch` minden mezője opcionális, de legalább 1 mezőnek kitöltöttnek kell lennie. A `key_messages` és `channel_mix` patch-elésnél **teljes csere** (nem mély merge) — egyszerűbb a UI-nak is.

- [ ] **Lépés 3: Vitest zöld**

---

## Task 10: propose_calendar_item tool

**Files:**

- Create: `packages/server/src/tools/propose-calendar-item.ts`
- Create: `packages/server/src/tools/propose-calendar-item.test.ts`

- [ ] **Lépés 1: Teszt + implementáció**

Egyetlen calendar item javaslata meglévő tervhez. Input: spec 5.3 szerint. Message típus: `'calendar_item_proposal'`. A `key_message_ref` validáció: a target plan `key_messages`-jében léteznie kell, ha kitöltött.

- [ ] **Lépés 2: Vitest zöld**

---

## Task 11: Calendar state machine

**Files:**

- Create: `packages/server/src/broker/calendar-state-machine.ts`
- Create: `packages/server/src/broker/calendar-state-machine.test.ts`

A spec 10.3 kockázat: ez a réteg gondoskodik arról, hogy a status-átmenetek konzisztensek maradjanak, a UI ne írhassa direkt módon (csak a `cancel` action).

- [ ] **Lépés 1: Először a teszt**

```typescript
describe('calendar state machine', () => {
  it('brief.created with calendar_item_id transitions item to brief_created', async () => { /* ... */ });
  it('brief.discarded transitions back to planned', async () => { /* ... */ });
  it('deliverable.approved (linked via brief.calendarItemId) transitions to delivered', async () => { /* ... */ });
  it('cancel action transitions any non-delivered status to cancelled', async () => { /* ... */ });
  it('does NOT transition delivered items', async () => { /* ... */ });
  it('emits calendar_item.status_changed SSE event', async () => { /* ... */ });
});
```

- [ ] **Lépés 2: Implementáció**

A modul exportál egy `applyEvent(event)` függvényt, amit az `event-bus.ts`-ből hívunk. Esetek:

- `brief.created` (payload tartalmazza a `calendar_item_id`-t, ha van) → `setCalendarItemStatus(item.id, 'brief_created')`
- `brief.discarded` (payload `calendar_item_id`) → `setCalendarItemStatus(item.id, 'planned')`
- `deliverable.approved` (payload-ból visszafejtjük a brief-en keresztül) → `setCalendarItemStatus(item.id, 'delivered')`
- `calendar_item.cancel_requested` (operátor explicit action) → `setCalendarItemStatus(item.id, 'cancelled')`, kivéve ha már `delivered`

Az `applyEvent` minden státusz-átmenet után emit-eli a `calendar_item.status_changed` SSE event-et a `prev_status` és `new_status` payloaddal.

- [ ] **Lépés 3: Integráció event-bus.ts-be**

A meglévő `event-bus.ts` brief és deliverable lifecycle event-eket emit-el. A `calendar-state-machine.applyEvent` itt kerül beillesztésre subscriber-ként.

- [ ] **Lépés 4: Vitest zöld**

---

## Task 12: get_campaign_status tool kibővítés

**Files:**

- Modify: `packages/server/src/tools/get-campaign-status.ts`

- [ ] **Lépés 1: Plan blokk a kimenethez**

A meglévő tool kimenet kibővül egy `plan` mezővel (spec 5.6):

```typescript
{
  // ... meglévő mezők
  plan: {
    has_plan: boolean,
    summary?: string,  // pl. "B2B SaaS lead-gen, Q2, 4 fő üzenet"
    calendar_progress?: { planned, brief_created, delivered, cancelled }
  }
}
```

A `summary` 1 mondatos, generált a backend-ben (`{goalType} {audience}, {keyMessages.length} fő üzenet, {timeline}`). A teljes terv nem kerül a status output-ba — ahhoz külön `get_campaign_plan` van.

- [ ] **Lépés 2: Tool teszt**

Frissítsd a meglévő (vagy ha nincs) `get-campaign-status.test.ts`-t az új mezőre.

- [ ] **Lépés 3: Vitest zöld**

---

## Task 13: propose_brief tool kibővítés

**Files:**

- Modify: `packages/server/src/tools/propose-brief.ts`
- Modify: `packages/server/src/tools/propose-brief.test.ts`

- [ ] **Lépés 1: Tool input bővítés**

```typescript
calendar_item_id?: string;
```

Validáció:

- Ha kitöltött: az item létezik és `status === 'planned'`
- Az item `plan.campaign_id` egyezik az input `campaign_id`-vel
- Egy item-hez egy aktív (`status !== 'discarded'`) brief tartozhat egyszerre

- [ ] **Lépés 2: Backend áthuzalozás**

A `messages` brief proposal `content_json`-jébe is kerüljön `calendar_item_id`. Approve flow-n (router-ben, ld. Task 14) a brief létrejöttkor a `briefs.calendar_item_id` mező kitöltődik, és emit-elődik a `brief.created` event a `calendar_item_id` payloaddal — ezt a state machine látja.

- [ ] **Lépés 3: Tool teszt — új validációs esetek**

```typescript
it('accepts calendar_item_id pointing to a planned item', async () => { /* ... */ });
it('rejects calendar_item_id if item is not planned', async () => { /* ... */ });
it('rejects calendar_item_id from a different campaign', async () => { /* ... */ });
```

- [ ] **Lépés 4: Vitest zöld**

---

## Task 14: Router (dispatchBrief) — calendar_item_id propagálás

**Files:**

- Modify: `packages/server/src/broker/router.ts`
- Modify: `packages/server/src/broker/router.test.ts`

- [ ] **Lépés 1: Teszt — `calendar_item_id` átfut a brief-re**

```typescript
it('persists calendar_item_id from BriefPayload to briefs row', async () => { /* ... */ });
it('emits brief.created with calendar_item_id for state machine', async () => { /* ... */ });
```

- [ ] **Lépés 2: Implementáció**

A `BriefPayload` típus kiegészül `calendar_item_id?: string` mezővel. A `dispatchBrief` createBrief hívásakor átadja, és a `brief.created` event payload-jába is bekerül.

- [ ] **Lépés 3: Vitest zöld**

---

## Task 15: Tool registry frissítés

**Files:**

- Modify: `packages/server/src/agents/config.ts`
- Modify: `packages/server/src/agents/config.test.ts`
- Modify: `packages/server/src/agents/factory.ts`

- [ ] **Lépés 1: Tools list bővítés a Director-on**

```typescript
director: {
  // ...
  tools: [
    'propose_brief',
    'propose_memory_update',
    'read_memory',
    'get_campaign_status',
    'get_campaign_plan',         // ÚJ
    'propose_campaign_plan',     // ÚJ
    'update_campaign_plan',      // ÚJ
    'propose_calendar_item',     // ÚJ
  ],
  // ...
},
```

- [ ] **Lépés 2: factory.ts — 4 új tool registry-be**

A factory.ts `buildToolsForRole` függvényében bővítjük a Director-eset 4 új tool-lal. A `submit_review` minta szerint: import + tool spec létrehozás + `tools.push`.

- [ ] **Lépés 3: config.test.ts assertion frissítés**

```typescript
it('director has plan tools', () => {
  const c = getRoleConfig('director');
  expect(c.tools).toContain('get_campaign_plan');
  expect(c.tools).toContain('propose_campaign_plan');
  expect(c.tools).toContain('update_campaign_plan');
  expect(c.tools).toContain('propose_calendar_item');
});
```

- [ ] **Lépés 4: Vitest + tsc zöld**

```bash
cd packages/server && npx vitest run && npx tsc --noEmit
```

---

## Task 16: REST routes — Plan + Calendar item CRUD

**Files:**

- Create: `packages/server/src/server/routes/plans.ts`
- Create: `packages/server/src/server/routes/plans.test.ts`
- Modify: `packages/server/src/server/index.ts`

- [ ] **Lépés 1: Route teszt**

```typescript
describe('plans routes', () => {
  it('GET /api/campaigns/:id/plan returns null when no plan', async () => { /* ... */ });
  it('PUT /api/campaigns/:id/plan upserts plan', async () => { /* ... */ });
  it('POST /api/campaigns/:id/plan/calendar-items creates item and emits SSE', async () => { /* ... */ });
  it('PATCH calendar-items updates non-status fields', async () => { /* ... */ });
  it('DELETE calendar-items soft-cancels item', async () => { /* ... */ });
  it('POST proposals/:msgId/accept materializes plan to DB', async () => { /* ... */ });
  it('POST proposals/:msgId/accept (calendar_item_proposal) inserts item to DB', async () => { /* ... */ });
});
```

- [ ] **Lépés 2: Route handlerek (Fastify)**

Lista (a meglévő `campaigns.ts`, `briefs.ts` mintát követi):

- `GET /api/campaigns/:id/plan` → `getPlanByCampaignId` + items
- `PUT /api/campaigns/:id/plan` → upsert (insert ha nincs, update ha van)
- `DELETE /api/campaigns/:id/plan` → csak ha üres terv (calendar_items 0 db, key_messages 0 db)
- `GET /api/campaigns/:id/plan/calendar-items` → `listCalendarItems` filter-rel
- `POST /api/campaigns/:id/plan/calendar-items` → `createCalendarItem` → emit `calendar_item.added`
- `PATCH /api/campaigns/:id/plan/calendar-items/:itemId` → `updateCalendarItem` → emit `calendar_item.updated` (status mező itt is változtatható, de csak `cancel`-re — egyébként error: "use state machine")
- `DELETE /api/campaigns/:id/plan/calendar-items/:itemId` → `cancelCalendarItem` → emit `calendar_item.status_changed`
- `POST /api/campaigns/:id/plan/calendar-items/:itemId/derive-brief` → új üzenetet ad fel a Plan-chat thread-be ("Készíts briefet ehhez a calendar item-hez: {…}"), ami SSE-n keresztül elindítja a Director-t a normál chat-flow-n. Az endpoint **nem** hív tool-t.
- `POST /api/proposals/:msgId/accept` — generikus proposal accept (plan_proposal, plan_update_proposal, calendar_item_proposal). A message típusától függ, mit csinál: `plan_proposal` esetén materializálja a `campaign_plans` rekordot + calendar_items-eket. `plan_update_proposal` esetén `updatePlan`. `calendar_item_proposal` esetén `createCalendarItem`. Plus: a message-en `status: 'accepted'`-re vált. Emit megfelelő SSE event.
- `POST /api/proposals/:msgId/discard` — message status `'discarded'`-re. SSE: `proposal.discarded`.

- [ ] **Lépés 3: Index regisztráció**

```typescript
// packages/server/src/server/index.ts
import plansRoutes from './routes/plans.js';
// ...
await fastify.register(plansRoutes);
```

- [ ] **Lépés 4: Vitest zöld**

---

## Task 17: Threads route — campaign_id filter

**Files:**

- Modify: `packages/server/src/server/routes/threads.ts`
- Modify: `packages/server/src/server/routes/threads.test.ts`

- [ ] **Lépés 1: Teszt — filter és body**

```typescript
it('GET /api/threads?campaign_id=X filters by campaign', async () => { /* ... */ });
it('POST /api/threads accepts campaign_id in body', async () => { /* ... */ });
```

- [ ] **Lépés 2: Implementáció**

Query param parse → `listThreadsByCampaign` ha kitöltött, egyébként a meglévő `listThreads`. POST body opcionális `campaign_id` átadása `createThread`-nek.

---

## Task 18: SSE event-ek

**Files:**

- Modify: `packages/server/src/server/sse.ts`
- Modify: `packages/server/src/server/sse.test.ts`

- [ ] **Lépés 1: Új event-ek regisztrálása**

A meglévő SSE handler guard mintát követjük (CLAUDE.md). Új event típusok:

- `plan.proposed`, `plan.accepted`, `plan.updated`, `plan.discarded`
- `calendar_item.added`, `calendar_item.updated`, `calendar_item.deleted`, `calendar_item.status_changed`
- `proposal.accepted`, `proposal.discarded` (generikus)

- [ ] **Lépés 2: Handler guard preserve**

A `marqueeEvents.handlersInitialized` flag-et nem kell módosítani — az új event-ek ugyanabban a regisztrációs ciklusban kerülnek be. Validáld, hogy HMR-újraindításnál nem dupláz.

- [ ] **Lépés 3: Vitest zöld**

---

## Task 19: Briefs / Campaigns route bővítés

**Files:**

- Modify: `packages/server/src/server/routes/briefs.ts`
- Modify: `packages/server/src/server/routes/campaigns.ts`

- [ ] **Lépés 1: Briefs response — calendarItemId mező**

A brief response object kiegészül `calendar_item: { id, channel, type, target_date, intent } | null` embedded objektummal (ha létezik). A frontend `BriefProposalCard` ezt jeleníti meg chip-ként.

- [ ] **Lépés 2: Campaigns response — plan summary embed**

A `GET /api/campaigns` és `GET /api/campaigns/:id` response-ba bekerül egy `plan_summary: { has_plan, calendar_progress } | null` mező. A Kampányok listanézet ezt használja a progress chip-hez.

- [ ] **Lépés 3: Vitest zöld**

---

## Task 20: Director skill — kampany-tervezes

**Files:**

- Create: `packages/server/seed/skills/director/kampany_tervezes.md`

- [ ] **Lépés 1: Skill recipe írása**

A meglévő `delegate.md`, `brief_intake.md` skill recipe-k mintáját követi. Tartalom:

- **Mikor töltődjön be:** ha a thread `campaign_id`-vel scope-olt és a Director kampánytervezésre van kérve, vagy ha a Plan tab-ról "Tervezés Director-ral" CTA jön.
- **Top-down kérdés-szekvencia:** 5 fő szekció (cél, audience, key messages, channel mix, timeline + opcionálisan KPI). Calendar items szekció utolsó — opcionális, ha az operátor üresen hagyja, az is OK.
- **Rugalmasság:** explicit szabály — az operátor felülírhatja a sorrendet, kihagyhat szekciót. A Director a végén egyszer összesít: "ezeket fedtük le, ezekre még nem tértünk ki".
- **Tool használat:** a kérdés-szekvencia végén `propose_campaign_plan` egyszer hívódik, a teljes csomaggal. **Nem** turn-onként hív tool-t.
- **Few-shot:** 2 minta-párbeszéd. Egy "audit-promóciós kampány Q2-re", egy "Foundation onboarding sorozat". Mindegyik mutatja a kérdés-válasz íve, a végén a `propose_campaign_plan` tool-hívás output JSON-ja.
- **Brand voice:** magyarul, tegezve, közvetlen. Hivatkozni a brand voice memory-ra (a system prompt-ba `renderBrandVoiceBlock` automatikusan beilleszti).
- **Memory hivatkozás:** kötelezően olvassa a `profile.md`, `brand_voice.md`, `ongoing_campaigns.md`-et a kérdés-szekvencia előtt (read_memory tool). Plus: minden meglévő kampányhoz `get_campaign_status`-t hívhat, hogy átfedést észleljen.

- [ ] **Lépés 2: Validáció — manuális olvasásra kerül a következő smoke task-ban**

---

## Task 21: Director skill — terv-kontextusu-brief

**Files:**

- Create: `packages/server/seed/skills/director/terv_kontextusu_brief.md`

- [ ] **Lépés 1: Skill recipe írása**

- **Mikor:** ha a Plan-chat thread-be `derive-brief` üzenet jön egy konkrét calendar item adataival.
- **Folyamat:**
  1. Olvassa a calendar item mezőit (channel, type, target_date, intent, key_message_ref).
  2. Ha `key_message_ref` kitöltött: hívja a `get_campaign_plan`-t, és vegye ki az adott key message text-jét.
  3. Fogalmazza meg a brief-et 1-2 mondatos kontextussal + konkrét deliverable-elvárással. A kérdéses részeket egyszer kérdezze le az operátortól (pl. "Konkrét terméket megemlítsünk?"), aztán hívja a `propose_brief`-et `calendar_item_id`-vel.
- **Few-shot:** 2 példa: LinkedIn poszt item → brief, email item → brief.

---

## Task 22: Meglévő Director skill bővítések

**Files:**

- Modify: `packages/server/seed/skills/director/delegate.md`
- Modify: `packages/server/seed/skills/director/brief_intake.md`

- [ ] **Lépés 1: delegate.md — plan-aware**

Új szekció: "Plan-chat thread-ben (campaign_id-vel scope-olt)". Tartalom:

- A first turn-ben **mindig** hívd meg a `get_campaign_plan`-t. Ha nincs még terv, javasold, hogy kezdjük tervezéssel (`kampany-tervezes` skill).
- Ha van terv: a kontextus-építéshez elég a tool kimenete, ne kérd újra az operátortól.
- Brief javaslat előtt: ha a téma egy meglévő calendar item-mel egyezik, javasold annak származtatását ("a Q2 LinkedIn poszt #3 ezt fedi — generálsz briefet abból?"). Ad-hoc brief is megengedett, de jelezd.

- [ ] **Lépés 2: brief_intake.md — plan-aware**

Hasonló szekció hozzáadása: ha a thread `campaign_id`-vel scope-olt és nincs `calendar_item_id`, a `propose_brief` payload-jában jelezd `rationale`-ban: "Ad-hoc brief, nem kapcsolódik calendar item-hez."

---

## Task 23: smoke.ts kibővítés — kampány-tervezési flow

**Files:**

- Modify: `packages/server/src/scripts/smoke.ts`

- [ ] **Lépés 1: Új smoke step**

A meglévő smoke teszt (Workshop chat → brief → deliverable → approval) után új flow:

1. Hozz létre egy kampányt
2. Indíts Plan-chat thread-et (`campaign_id`-vel)
3. Director chat: "Tervezzünk Q2-re egy audit-promóciós kampányt." A Director a `kampany-tervezes` skill alapján végigkérdezi a 5 szekciót.
4. Approve a `plan_proposal`-t — ellenőrizd, hogy `campaign_plans` és `calendar_items` rekordok jönnek létre, és a `plan.accepted` SSE event emit-elődik.
5. "Generate brief" akció a calendar item #1-en (vagy `derive-brief` endpoint hívással). Director a `terv-kontextusu-brief` skillel propose-ol briefet `calendar_item_id`-vel.
6. Approve, dispatch, deliverable, approve. Ellenőrizd, hogy a calendar item státusza `delivered`-re vált.

- [ ] **Lépés 2: Smoke futtatás**

```bash
DATA_DIR=~/.marquee-dev npm run smoke --workspace=packages/server
```

Expected: végigfut hibamentesen. Ha a Director nem konzisztens (pl. nem hív tool-t, vagy összezavarodik az ugráláson), iterálj a skill recipe-n (Task 20).

---

## Task 24: Frontend — lib/api.ts plansApi

**Files:**

- Modify: `packages/web/src/lib/api.ts`

- [ ] **Lépés 1: plansApi**

```typescript
export const plansApi = {
  get: (campaignId: string) => fetch(`/api/campaigns/${campaignId}/plan`).then(r => r.json()),
  put: (campaignId: string, plan: CampaignPlanInput) => /* ... */,
  remove: (campaignId: string) => /* ... */,
  listCalendarItems: (campaignId: string, filter?) => /* ... */,
  createCalendarItem: (campaignId: string, item: CalendarItemInput) => /* ... */,
  updateCalendarItem: (campaignId: string, itemId: string, patch) => /* ... */,
  cancelCalendarItem: (campaignId: string, itemId: string) => /* ... */,
  deriveBrief: (campaignId: string, itemId: string) => /* ... */,
};

export const proposalsApi = {
  accept: (msgId: string) => /* ... */,
  discard: (msgId: string) => /* ... */,
};

// threadsApi bővítés
export const threadsApi = {
  // ...
  list: (filter?: { campaignId?: string }) => /* query stringgel */,
  create: (input: { campaignId?: string, title?: string }) => /* ... */,
};
```

- [ ] **Lépés 2: TS check**

```bash
cd packages/web && npx tsc --noEmit
```

---

## Task 25: Frontend — store + SSE handlers

**Files:**

- Modify: `packages/web/src/store/useMarqueeStore.ts`
- Modify: `packages/web/src/lib/sse.ts`

- [ ] **Lépés 1: Plans slice a store-ba**

```typescript
plans: {
  byCampaignId: Record<string, CampaignPlan | null>,  // null = nincs terv
  loading: Record<string, boolean>,
}
```

Setter-ek + thunk-ok: `loadPlan(campaignId)`, `savePlan(...)`, `cancelCalendarItem(...)`, `acceptProposal(msgId)`, `discardProposal(msgId)`.

- [ ] **Lépés 2: SSE handler-ek**

A meglévő SSE handler guard mintát követjük (CLAUDE.md gotcha). Új handler-ek:

- `plan.proposed` / `plan.accepted` / `plan.updated` / `plan.discarded` → store frissítés + threading message frissítés
- `calendar_item.added` / `updated` / `deleted` / `status_changed` → store frissítés
- `proposal.accepted` / `proposal.discarded` → message rekord status frissítés

- [ ] **Lépés 3: TS check**

---

## Task 26: Frontend — CampaignDetail nézet váz

**Files:**

- Create: `packages/web/src/views/CampaignDetail.tsx`
- Modify: `packages/web/src/App.tsx`

- [ ] **Lépés 1: Route**

```typescript
// App.tsx
<Route path="/campaigns/:id" element={<CampaignDetail />} />
```

- [ ] **Lépés 2: CampaignDetail komponens — két tab**

Mobile-aware (a meglévő tab-pattern szerint, mint Workshop / Approvals). Tab-ok:

- **Plan** (default) — `<PlanEditor campaignId={id} />`
- **Tervezési chat** — a meglévő `<ChatThread />` újrahasznosítva, `threadId`-vel ami a `campaign_id`-hez tartozó aktív Plan-chat thread (ha nincs még, "Tervezés indítása Director-ral" CTA)

A tab-állapot URL query param `?tab=plan|chat`, hogy refresh után megmaradjon.

- [ ] **Lépés 3: TS check + manuális vizsgálat (Vite dev)**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
DATA_DIR=~/.marquee-dev npm run dev
# nyisd meg http://localhost:5173/campaigns/<id>
```

A Plan tab placeholder szöveggel jelenjen meg, a chat tab a meglévő thread-et listázza vagy a CTA-t mutassa.

---

## Task 27: Frontend — PlanEditor komponens

**Files:**

- Create: `packages/web/src/components/PlanEditor.tsx`

- [ ] **Lépés 1: Form szekciók**

Form-szerű, mezőnként szerkeszthető. Szekciók:

1. **Cél** — `<textarea>` (3 sor) + `<select>` a `goalType`-hoz
2. **Audience** — `<textarea>` (3 sor)
3. **Key messages** — szerkeszthető lista. Minden item: drag-and-drop **nincs** (Plan v1.1-ben), csak fel/le gombok. Add new (text input → submit → új item id auto-slug a text első 20 karakteréből, kebab-case).
4. **Channel mix** — szerkeszthető lista. Minden item: dropdown (channel enum) + number input (0–100 weight) + opcionális text input (note). A weight-ek összegét a komponens kiszámolja és mutatja: ha != 100, sárga warning.
5. **Timeline** — két `<input type="date">` (start, end). Opcionális.
6. **KPI** — `<textarea>` (2 sor).
7. **Calendar** — szegmentált lista (4 szekció: Planned / Brief created / Delivered / Cancelled). Minden szekcióban a `<CalendarItemCard>` komponens (Task 28). "Új calendar item" gomb a Planned szekció tetején → `<CalendarItemEditModal>`.

A form save: piszkos állapot trackelés (`isDirty`), `Save` gomb csak akkor aktív, "Discard" visszaállítja az utolsó server-state-re. PUT endpoint hívás `plansApi.put`.

- [ ] **Lépés 2: Üres állapot**

Ha `byCampaignId[id] === null`: két CTA — "Tervezés Director-ral" (átirányít chat tab-ra + indít új thread `campaign_id`-vel) és "Üres terv létrehozása" (PUT empty plan-t).

- [ ] **Lépés 3: TS check + manuális vizsgálat**

---

## Task 28: Frontend — CalendarItemCard

**Files:**

- Create: `packages/web/src/components/CalendarItemCard.tsx`

- [ ] **Lépés 1: Kártya komponens**

Megjelenít: dátum (relative time, pl. "3 nap múlva"), channel chip (color-coded — `lib/design.ts`), deliverable_type chip (ha van), intent (1-2 sor), key_message_ref chip (ha van: a key message text első 30 karaktere). Status badge.

Akciók — status-tól függ:

- `planned`: "Generate brief" (→ deriveBrief), "Edit" (→ modal), "Cancel"
- `brief_created`: "Brief megnyitása" (→ Workshop chat brief detail), "Cancel"
- `delivered`: "Deliverable megnyitása" (→ Approvals view filter)
- `cancelled`: csak vizuális, nincs akció

- [ ] **Lépés 2: TS check**

---

## Task 29: Frontend — CalendarItemEditModal

**Files:**

- Create: `packages/web/src/components/CalendarItemEditModal.tsx`

- [ ] **Lépés 1: Modal**

A meglévő `<SendBackModal>` mintát követi. Mezők:

- Channel (dropdown enum)
- Deliverable type (dropdown, opcionális)
- Target date (date input)
- Intent (textarea, 2-3 sor)
- Key message ref (dropdown — a plan key_messages-éből)
- Mode: `create` vagy `edit` — edit-nél előre kitöltve, create-nél üres

Save: POST/PATCH endpoint, success-en bezárul + SSE-n a Plan tab frissül.

- [ ] **Lépés 2: TS check**

---

## Task 30: Frontend — PlanProposalCard

**Files:**

- Create: `packages/web/src/components/PlanProposalCard.tsx`

- [ ] **Lépés 1: Komponens**

A `<BriefProposalCard>` mintát követi. Megjeleníti:

- Cél (1-2 mondat) + goal_type chip
- Audience (rövidítve, "Részletek megtekintése" link a teljes szöveghez)
- Key messages — 3-5 listaelem chip-ként
- Channel mix — sávgrafikon (a weight-ekkel)
- Timeline — dátum range
- Calendar items count — "X tervezett item"
- Rationale (collapsible)

Gombok: Approve (→ proposalsApi.accept), Discard (→ proposalsApi.discard). Approve közben loading state, success után a kártya `accepted` státuszba megy és nem klikkelhető tovább.

A `plan_update_proposal` típushoz **ugyanaz** a komponens, de a header "Terv frissítés javaslat", és csak a `patch` mezőit jeleníti meg (kihúzott / új).

- [ ] **Lépés 2: TS check**

---

## Task 31: Frontend — CalendarItemProposalCard

**Files:**

- Create: `packages/web/src/components/CalendarItemProposalCard.tsx`

- [ ] **Lépés 1: Komponens**

Egyszerűbb mint a PlanProposalCard. Megjeleníti az item adatait (channel chip, type chip, target date, intent, key_message_ref). Gombok: Approve / Discard.

- [ ] **Lépés 2: ChatThread integráció**

A `<ChatThread>` üzenet-rendererje a `type` mező alapján választ komponenst. Új típusok:

```typescript
case 'plan_proposal': return <PlanProposalCard ... />;
case 'plan_update_proposal': return <PlanProposalCard mode='update' ... />;
case 'calendar_item_proposal': return <CalendarItemProposalCard ... />;
```

A meglévő `'brief_proposal'` és `'memory_proposal'` mintát követi.

---

## Task 32: Frontend — Kampányok listanézet kibővítés

**Files:**

- Modify: `packages/web/src/views/Campaigns.tsx`

- [ ] **Lépés 1: Plan progress chip**

A kampánykártyán új jelzés:

- Ha van terv: "📋 X tervezett, Y kész" (Y = delivered count, X = planned + brief_created count)
- Ha nincs terv: szürke "Tervezés" link

Kártya klikk → `/campaigns/:id` route.

- [ ] **Lépés 2: TS check + manuális ellenőrzés**

---

## Task 33: Frontend — BriefProposalCard kibővítés

**Files:**

- Modify: `packages/web/src/components/BriefProposalCard.tsx`

- [ ] **Lépés 1: Calendar item chip**

Ha a brief `calendar_item` embedded objektuma kitöltött, megjelenítjük chip-ként a kártya tetején: "📅 {channel} • {date} • {intent first 40 chars}". Kattintásra → `/campaigns/{campaign.id}?tab=plan` (görgetés az item-re).

---

## Task 34: Frontend — Workshop chat plan-aware jelzés

**Files:**

- Modify: `packages/web/src/views/Workshop.tsx`

- [ ] **Lépés 1: Header kontextus jelzés**

Ha a kiválasztott thread `campaign_id`-vel scope-olt (Plan-chat thread), a Workshop view header-je megváltozik:

- Header bar: "📅 Kampány tervezés: {campaign.title}" + link vissza a `/campaigns/:id` Plan tab-ra
- A composer placeholder is változzon: "Director tervezi a kampányt..."

Egyébként marad a meglévő Workshop UX (free-form ad-hoc chat).

---

## Task 35: E2E lokális teszt — kampány-tervezési flow

**Files:** csak ellenőrzés.

- [ ] **Lépés 1: Backend és frontend dev mode**

```bash
DATA_DIR=~/.marquee-dev npm run dev
```

- [ ] **Lépés 2: Manuális flow**

1. Hozz létre kampányt a Kampányok listanézetből (a meglévő flow)
2. Klikk a kampányra → CampaignDetail nézet, Plan tab
3. "Tervezés Director-ral" CTA → chat tab nyílik új thread-tel
4. Director chat: "Tervezzünk Q2-re egy audit-promóciós kampányt." Várjunk Director-választ — kérdezzen audience-t
5. Válaszolj sorrendben (vagy ugorj össze-vissza, hogy az "ugrás-tolerancia" kockázatot teszteld)
6. Director végül `propose_campaign_plan`-t hív → `<PlanProposalCard>` megjelenik a chat-ben
7. Approve → SSE-n a Plan tab azonnal frissül (terv adatai látszanak)
8. Plan tab-en kézzel adj hozzá egy új calendar item-et a modal-ból
9. Plan tab-en "Generate brief" akció egy planned item-en → chat tab-on új üzenet jelenik meg, Director propose_brief-et hív `calendar_item_id`-vel
10. Approve → brief létrejön, calendar item státusza `brief_created`. SSE-n cross-tab frissülés.
11. Workshop view-n a brief megjelenik (calendar item chip-pel)
12. Brief approve → dispatch → deliverable → approve. Calendar item `delivered`-re vált a Plan tab-en.

- [ ] **Lépés 3: Hibák jegyzetelése**

Ha bármelyik lépés hibás (pl. Director nem hív tool-t, frontend nem frissül, status drift), jegyezd a problémát és a Task 36 alatt javítsd.

---

## Task 36: Bug-fix kör (e2e jegyzetekből)

**Files:** változó.

- [ ] **Lépés 1: A Task 35 jegyzetein végigmenés**

Minden hibára: gyors gyökér-ok elemzés + lokálisan javítani. Ne ugorj át regressziót — ha pl. a Director ugráló válaszra rosszul reagál, az a `kampany_tervezes.md` skill recipe finomítása, nem broker-bug.

- [ ] **Lépés 2: Vitest + tsc zöld**

```bash
cd packages/server && npx vitest run && npx tsc --noEmit
cd ../web && npx tsc --noEmit
```

---

## Task 37: Acceptance checklist végigmenés

**Files:** csak ellenőrzés. A spec 11. szakasza alapján:

- [ ] **DB és backend:** 0007 migration alkalmazva mindkét DB-n; tsc + vitest zöld; queries / state machine / tool input validáció tesztek zöldek
- [ ] **Director-vezetett tervezés:** Plan-chat-ben "Tervezzünk..." kérésre konzisztens 5+ kérdés, `propose_campaign_plan` hívás, Plan tab-en megjelenés. Ugráló sorrenddel is működik.
- [ ] **Üres terv és manuális szerkesztés:** "Üres terv létrehozása" + Plan editor mezőnként + Új calendar item modal
- [ ] **Brief származtatás:** "Generate brief" → propose_brief calendar_item_id-vel → status auto-átmenetek
- [ ] **Ad-hoc brief lazán kötve:** Plan-chat-ben ad-hoc kérés → calendar_item_id NULL, Director jelzi
- [ ] **Frontend UX:** Plan tab és Plan-chat tab cross-szinkronizáció SSE-n. Kampányok listanézet plan progress. Brief kártyán calendar item chip.
- [ ] **Smoke (meglévő flow):** Workshop chat változatlan; régi briefek (calendar_item_id NULL) hibamentesen működnek.

- [ ] **Ha minden zöld: feature kész.** Memory frissítés: `project_marquee_state.md`-ben rögzíteni, hogy Plan v1 lokálisan kész, Phase 2 (Plan v2 auto-suggest) jöhet majd használat után.

---

## Hibakezelés / rollback

- **Migration sikertelen dev DB-n:** ha a 0007 alkalmazás közben hiba történik (pl. FK constraint), `sqlite3 ~/.marquee-dev/state.db ".dump"` backup → `ROLLBACK` SQL `DROP TABLE campaign_calendar_items; DROP TABLE campaign_plans; ALTER TABLE briefs DROP COLUMN calendar_item_id; ALTER TABLE chat_threads DROP COLUMN campaign_id;`. Az `__drizzle_migrations` 0007 hash-t is töröld. Friss DB-n nem releváns.
- **Drizzle snapshot inkonzisztencia:** ha a `drizzle/meta/_journal.json` és a SQL fájl elszakadnak, `drizzle-kit generate` regenerálja, manuálisan szinkronizálandó. Soha ne kommitelj el inkonzisztens állapotot.
- **TypeScript circular import (campaignCalendarItems → briefs):** ha a Drizzle TS-igénye túl szigorú, a táblák sorrendjét cseréld meg a `schema.ts`-ben — `campaignPlans`, `campaignCalendarItems` előzze meg a `briefs`-et.

---

## Hivatkozások

- Spec: `docs/superpowers/specs/2026-04-30-marquee-campaign-plan-design.md`
- Marquee project CLAUDE.md (gotchas): `marquee/CLAUDE.md`
- Wave 1 plan minta: `docs/superpowers/plans/2026-04-30-marquee-wave-1-agents.md`
- Repo: `~/Projects/Homelab/marquee`
- Production: `marquee.lab2.home.arpa` (VM 260) — Plan v1 deploy halasztva
