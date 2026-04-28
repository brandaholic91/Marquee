# Marquee — Campaigns Design

**Dátum:** 2026-04-28
**Státusz:** jóváhagyva (brainstorm)

---

## Goal

Kampány entitás bevezetése mint legmagasabb rendező elv a brief-ek, deliverable-ök, taskokés memory proposal-ok felett. 1 brief = 1 kampány. A jövőbeli projekt-szint (`projectId` FK) hozzáadása egyetlen migrációs lépés marad.

## Architecture

Külön `campaigns` tábla (B opció). A `campaignId` FK-ként jelenik meg a `briefs`, `delegations`, `deliverables`, `tasks` és `memory_proposals` táblákon — nullable, hogy a régi adatok és a cron-generált rekordok ne törjenek. A propagáció a backend router/tool layer-ben történik automatikusan, az agenteknek nem kell tudni a campaign fogalmáról. A Director `proposeBrief` toolja kapja meg a `campaignTitle` mezőt — az agent tölti ki a brief tartalmából következtetve.

## Tech Stack

Node.js 22, TypeScript, SQLite/Drizzle ORM, React 19, Fastify 5. Drizzle Kit migrációk.

---

## 1. Adatmodell

### Új tábla: `campaigns`

```typescript
export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["active", "completed", "archived"] }).notNull().default("active"),
  createdAt: ts("created_at"),
});
```

Jövőbeli bővítés (nem part of this spec): `projectId: text("project_id").references(() => projects.id)` — egyetlen sor migrációval hozzáadható.

### Módosított meglévő táblák

Minden módosítás nullable FK `campaigns.id`-re, hogy régi adatok és cron-rekordok ne törjenek.

**`briefs`:**
```typescript
campaignId: text("campaign_id").references(() => campaigns.id)
```

**`delegations`:**
```typescript
campaignId: text("campaign_id").references(() => campaigns.id)
```

**`deliverables`:**
```typescript
campaignId: text("campaign_id").references(() => campaigns.id)
```

**`tasks`:**
```typescript
campaignId: text("campaign_id").references(() => campaigns.id)
```

**`memory_proposals`:**
```typescript
campaignId: text("campaign_id").references(() => campaigns.id)
```

---

## 2. Propagáció

A `campaignId` automatikusan öröklődik a delegációs láncon — az agenteknek nem kell kezelni.

### Lépések

1. **Brief dispatch** — Director `proposeBrief(campaignTitle, contentMd)` → backend egyszerre INSERT campaigns + briefs (briefs.campaignId = campaigns.id)
2. **Első delegáció** (Director → Lead) — router a `brief.campaignId`-t átmásolja az új delegációra
3. **Al-delegáció** (Lead → Specialist) — router a `parentDelegationId` alapján kiolvassa a szülő `campaignId`-jét, és örökíti az új delegációra
4. **Deliverable submit** — `submitDeliverable` tool handler: `campaignId = delegation.campaignId`
5. **Task létrehozás** — task insert: `campaignId = delegation.campaignId`
6. **Memory proposal** — agent session → `parentDelegationId` → `delegation.campaignId` (nullable ha nincs kontextus, pl. cron)

### Speciális esetek

- **Cron-generált delegációk** (`weekly_report`, `monthly_review`): `campaignId = null` — helyes, ezek nem kampány-specifikusak
- **Repurpose flow**: az új deliverable örökli a source deliverable `campaignId`-jét (a `POST /api/deliverables/:id/repurpose` endpoint kezeli)
- **Régi adatok**: minden meglévő rekord `campaignId = null` — a UI "All / No campaign" szűrővel kezeli

---

## 3. API

### Új endpoints

```
GET  /api/campaigns         → lista: [{ id, title, status, deliverableCount, taskCount, pendingApprovals }]
GET  /api/campaigns/:id     → részletek + összesített stats
PATCH /api/campaigns/:id    → { title?, description?, status? }
```

A `GET /api/campaigns` válasza joinolja a számlálókat — nem tárolt mező, lekérdezés-idejű aggregáció.

### Módosított meglévő endpoints

| Endpoint | Változás |
|---|---|
| `GET /api/deliverables` | `?campaignId=` szűrő támogatás |
| `GET /api/tasks` | `?campaignId=` szűrő támogatás |
| `GET /api/memory/proposals` | `?campaignId=` szűrő támogatás |
| `POST /api/briefs` | változatlan — csak `contentMd` (raw human input), auto-campaign generálás (ld. lent) |

### `proposeBrief` tool változás

A `propose_brief` toolnak már van `title` mezője — ezt használjuk kampánynévként, nincs szükség új mezőre.

```typescript
// Jelenlegi schema: { threadId, title, scope, deliverables, deadline? }
// Változás: execute() hozza létre a campaign rekordot a meglévő title alapján

// execute() új logika:
// 1. INSERT campaigns (title = input.title)
// 2. INSERT briefs (campaignId = campaign.id)
```

### `POST /api/briefs` — auto-campaign generálás

Ez az endpoint a nyers human inputot fogadja (csak `contentMd`). Kampánynév: `contentMd` első sora (ha van), egyébként `"Brief YYYY-MM-DD"` fallback. Campaign automatikusan INSERT-elődik a brief mellé.

---

## 4. UI

### Új nav item

`packages/web/src/components/layout/Sidebar.tsx` — a `NAV` tömbhöz `{ id: "campaigns", label: "Campaigns" }` a Calendar elé. A `NavId` type és az `useAgencyStore` view-kezelése kiegészül.

### Campaigns view (`packages/web/src/views/campaigns.tsx`)

Kétoszlopos elrendezés (Pipeline mintájára):
- **Bal oldal:** kampánylista — cím, státusz badge (active/completed/archived), deliverable szám, pending approvals szám
- **Jobb oldal:** kiválasztott kampány részletei — deliverable-ök listája (státusz szerint csoportosítva), taskjainak száma, createdAt
- **Mobil:** lista → detail navigáció (agents.tsx mintájára)

### Meglévő nézetek kiegészítése

- **Pipeline view:** kampány-szűrő dropdown a fejlécben — "All campaigns" + aktív kampányok listája (`GET /api/campaigns` alapján)
- **Tasks view:** ugyanilyen kampány-szűrő dropdown
- **Memory view (proposals fül):** ugyanilyen szűrő, ha van proposals lista megjelenítve

### Deliverable card badge

A deliverable kártyán megjelenik a kampány neve kis `CampaignBadge` komponensként (ha `campaignId` nem null) — hasonlóan a meglévő `CampaignBriefBadge` mintájához.

---

## 5. Testing

- `campaigns.test.ts` (új): CRUD operations, `GET /api/campaigns` számláló aggregáció
- `propagation.test.ts` (új) vagy a meglévő delegation/deliverable tesztek kiegészítése: campaignId öröklés ellenőrzése al-delegációkon át
- `repurpose` teszt kiegészítése: campaignId öröklés source deliverable-ről
- Meglévő `briefs` tesztek kiegészítése: `campaignTitle` → campaign + brief létrehozás

---

## 6. Jövőbeli bővítés (out of scope)

- `projects` tábla + `campaigns.projectId` FK — egyetlen migrációs lépés
- Kampány szintű budget tracking
- Kampány szintű analytics összesítő
