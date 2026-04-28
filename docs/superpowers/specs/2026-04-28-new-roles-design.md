# Marquee — New Agent Roles: Paid Specialist, Repurposer, Analytics Analyst

**Dátum:** 2026-04-28  
**Státusz:** jóváhagyva (brainstorm)  
**Kapcsolódó:** `2026-04-27-orchestration-ui-design.md` (v0.3 deferred items)

---

## Goal

Három új transient specialist role hozzáadása a meglévő hierarchiába: Paid Specialist (kampánydossziék), Repurposer (tartalom-adaptáció csatornákra), Analytics Analyst (teljesítményjelentés). Pluggable adatforrás-integráció az Analytics Analyst alá (Matomo, SerpAPI) — most stub toolok, later csak env var kell.

## Architecture

Mind a három role a meglévő spawn-per-task pattern-t követi. A Repurposer egy új UI trigger-t kap (Repurpose gomb shipped deliverable-eken). A Campaign Brief deliverable-ek vizuális warning badge-et kapnak az approval queue-ban. Az Analytics Analyst tooljai env var alapján döntenek stub vs. live között.

## Tech Stack

Node.js 22, TypeScript, SQLite/Drizzle ORM, Fastify 5, React 19, Zustand. Matomo REST API + SerpAPI REST API (opcionális, env var vezérelt).

---

## 1. Agent Hierarchia

```
Director
├── Content Lead      → Copywriter (meglévő)
│                     → Repurposer (ÚJ)
├── Distribution Lead → Social Manager (meglévő)
│                     → SEO Analyst (meglévő)
│                     → Paid Specialist (ÚJ)
└── Insights Lead     → SEO Analyst (meglévő)
                      → Analytics Analyst (ÚJ)
```

### 1.1 Paid Specialist — `paid-specialist`

- **Feladat:** kampánydossziét készít (ad copy + targeting brief + headline/body copy variánsok platform-specifikusan)
- **Deliverable típus:** `campaign_brief`
- **Tools:** `submit_deliverable`, `read_memory`, `request_input`
- **Skill file:** `~/.marquee/skills/paid-specialist/campaign_brief_writer.md`
- **Lifecycle:** transient (spawn-per-task, Distribution Lead delegálja)
- **Approval gate:** `campaign_brief` típusú deliverable-ek sárga warning badge-et kapnak az approval queue-ban: *"Paid campaign — review before approving"*

Kampánydossziék struktúrája (skill recipe írja elő):
- Campaign Goal
- Target Audience
- Platform (Facebook Ads / Google Ads / LinkedIn Ads / etc.)
- Ad Formats
- Budget Recommendation
- Headline Variants (3–5)
- Body Copy Variants (3–5)
- CTA Options
- Landing Page Recommendation

**Future (explicit user request):** Meta Ads API + Google Ads API integráció (OAuth, kampánystruktúra push) — külön fejlesztési fázis, az API kulcsok meglétekor.

### 1.2 Repurposer — `repurposer`

- **Feladat:** egy meglévő shipped deliverable tartalmát adaptálja a Content Lead által meghatározott célcsatornákra; csatornánként 1 deliverable
- **Deliverable típusok:** a célcsatornától függően `linkedin_post`, `twitter_thread`, `email_snippet`, `instagram_caption` (ezek kerülnek a meglévő enum-ba)
- **Tools:** `submit_deliverable`, `read_memory`
- **Skill file:** `~/.marquee/skills/repurposer/content_repurposer.md`
- **Lifecycle:** transient (Content Lead delegálja, egy repurposing kérésen belül csatornánként 1 Repurposer spawnoló)

### 1.3 Analytics Analyst — `analytics-analyst`

- **Feladat:** teljesítményjelentést készít (`performance_report` deliverable) Matomo + SerpAPI adatok alapján
- **Tools:** `submit_deliverable`, `read_memory`, `query_matomo`, `serpapi_search`
- **Skill file:** `~/.marquee/skills/analytics-analyst/performance_report.md`
- **Lifecycle:** transient (Insights Lead delegálja)
- **Pluggable adatforrások:** env var hiányában stub módban fut (ld. 3. szekció)

---

## 2. DB Schema Változások

### 2.1 `deliverables` tábla — új mező

```typescript
// packages/server/src/db/schema.ts
sourceDeliverableId: text("source_deliverable_id")
  .references(() => deliverables.id)  // nullable FK, csak repurposed deliverable-eknél van
```

### 2.2 Deliverable type enum kiegészítés

Meglévő típusok: `blog_post`, `linkedin_post`, `landing_page`, `seo_report`

Új típusok:
```typescript
"campaign_brief" | "performance_report" | "twitter_thread" | "email_snippet" | "instagram_caption"
```

### 2.3 Migration

```bash
npm run db:generate && npm run db:migrate
```

---

## 3. Új Toolok

### 3.1 `query_matomo`

Fájl: `packages/server/src/tools/integration.ts` (kiegészítés)

```typescript
input: {
  site_id: number,
  period: "day" | "week" | "month",
  date: string  // "today" | "yesterday" | "YYYY-MM-DD"
}
output: {
  visits: { date: string; count: number }[],
  pageviews: number | null,
  bounceRate: number | null,
  topPages: { url: string; views: number }[],
  _stub: boolean  // true ha env var hiányzik
}
```

Logika:
- Ha `MATOMO_URL` vagy `MATOMO_TOKEN` env var nincs beállítva → `_stub: true`, üres adatstruktúra
- Ha mindkettő megvan → `GET {MATOMO_URL}/index.php?module=API&method=VisitsSummary.get&...`

### 3.2 `serpapi_search`

Fájl: `packages/server/src/tools/integration.ts` (kiegészítés)

```typescript
input: {
  query: string,
  num?: number  // default 10
}
output: {
  results: { title: string; url: string; snippet: string }[],
  _stub: boolean
}
```

Logika:
- Ha `SERPAPI_KEY` env var nincs beállítva → `_stub: true`, üres lista
- Ha megvan → `https://serpapi.com/search.json?q=...&api_key=...`

### 3.3 `submit_deliverable` tool kiegészítés

A meglévő `submit_deliverable` tool opcionális `source_deliverable_id` paramétert kap:

```typescript
input: {
  type: DeliverableType,
  title: string,
  contentMd: string,
  source_deliverable_id?: string  // csak Repurposer tölti ki
}
```

A Repurposer a delegation payload-ból olvassa ki a `sourceDeliverableId` értékét (a Content Lead beleteszi a delegation `payloadJson`-jébe), és átadja a `submit_deliverable` hívásban.

### 3.4 Analytics Analyst skill instrukció (stub kezelés)

A `performance_report.md` skill file tartalmaz egy instrukciót:  
*"If `_stub: true` in any tool response, note in the report that live data is unavailable and use a placeholder structure with clearly labeled empty sections."*

---

## 4. Tool Registry Változások

`packages/server/src/tools/registry.ts`:

```typescript
// Meglévő Lead-ek: delegate_to_specialist allowed targets bővítése
content-lead:      [...existing, "repurposer"]
distribution-lead: [...existing, "paid-specialist"]
insights-lead:     [...existing, "analytics-analyst"]

// Új specialist role-ok tool-készlete
"paid-specialist":    [submitDeliverable, readMemory, requestInput]
"repurposer":         [submitDeliverable, readMemory]
"analytics-analyst":  [submitDeliverable, readMemory, queryMatomo, serpApiSearch]
```

---

## 5. Repurpose Trigger Flow

### 5.1 Frontend

- **"Repurpose" gomb** — Deliverable detail view-ban, csak `shipped` státusznál látható
- **Channel selection modal** — checkbox lista:
  - LinkedIn Post
  - Twitter Thread
  - Email Snippet
  - Instagram Caption
  - (szabad szöveges "Other: ..." mező)
- **"Repurposed from" badge** — ha `sourceDeliverableId` be van állítva → kis badge a deliverable headerjén: *"Repurposed from: [original title]"*

### 5.2 Backend

Új endpoint: `POST /api/deliverables/:id/repurpose`

```typescript
body: { channels: string[] }  // min 1, max 5

// Validáció:
// - deliverable létezik és status === "shipped"
// - channels legalább 1 elemet tartalmaz

// Logika:
// 1. Kiolvassa az eredeti deliverable tartalmát (artifact fájl)
// 2. Delegationt hoz létre Content Lead felé:
//    "Repurpose this content for: {channels}.
//     Source content: [tartalom]
//     Delegate one repurposer per channel using delegate_to_specialist."
// 3. Visszaad: { delegationId: string }
```

Nincs új Brief — a delegation direktben Content Leadnek megy (repurposing = content feladat, Director bypass).

### 5.3 Flow diagram

```
User kattint "Repurpose" → Channel modal → POST /api/deliverables/:id/repurpose
  → Server: delegation_created (to: content-lead)
  → Content Lead: N× delegate_to_specialist("repurposer", channel)
  → N× Repurposer spawn (sourceDeliverableId beállítva)
  → submit_deliverable (típus = célcsatorna)
  → Eval Judge auto-kiértékeli (meglévő flow)
  → Approval queue-ban megjelennek
```

---

## 6. Approval Queue — Campaign Brief Warning

A Deliverable approval card-on, ha `deliverable.type === "campaign_brief"`:

```
┌─────────────────────────────────────────┐
│ ⚠ Paid campaign — review before approving│
│ Campaign Brief: "Q2 Facebook Ads — ICP"  │
│ [Approve] [Request Changes] [Reject]     │
└─────────────────────────────────────────┘
```

Sárga háttér (`amber-50`), figyelmeztető ikon. Nincs külön approval flow, az existing `awaiting_approval` → `shipped` átmenet.

---

## 7. Seed Skill Files

A meglévő `seedDefaultSkills()` kiterjesztve (`packages/server/src/memory/seed.ts`):

```
~/.marquee/skills/paid-specialist/campaign_brief_writer.md
~/.marquee/skills/repurposer/content_repurposer.md
~/.marquee/skills/analytics-analyst/performance_report.md
```

Mindhárom fájl:
- YAML frontmatter: `role`, `version`, `description`
- Markdown instrukciók az adott feladathoz
- Seed idempotens (nem írja felül ha már létezik)

---

## 8. Error Handling

- `POST /api/deliverables/:id/repurpose`: `deliverable.status !== "shipped"` → HTTP 400
- `POST /api/deliverables/:id/repurpose`: `channels` üres → HTTP 400
- `POST /api/deliverables/:id/repurpose`: deliverable nem létezik → HTTP 404
- `query_matomo` live módban: hálózati hiba → `{ error: string, _stub: false }` (agent saját belátása szerint kezeli)
- `serpapi_search` live módban: hálózati hiba → `{ error: string, _stub: false }`

---

## 9. Testing

- `tools/integration.test.ts`: `query_matomo` stub mód (env var nélkül), `serpapi_search` stub mód
- `server/routes/deliverables.test.ts`: `POST /api/deliverables/:id/repurpose` happy path, 400 ha nem shipped, 400 ha channels üres, 404 ha nem létezik
- `agents/factory.test.ts` (tool registry snapshot): `paid-specialist`, `repurposer`, `analytics-analyst` kapnak tool-készletet; `content-lead` includes `repurposer` in delegate targets; `distribution-lead` includes `paid-specialist`; `insights-lead` includes `analytics-analyst`
- `db/schema.test.ts`: `sourceDeliverableId` mező + új deliverable típusok exportálva
- Minden meglévő teszt átmegy változatlanul
