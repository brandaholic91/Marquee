# Marquee — Kampánytervezés (Plan v1)

**Dátum:** 2026-04-30
**Scope:** Kampánytervezési réteg bevezetése — domain-objektum, calendar, Director-vezetett tervezés, brief származtatás
**Státusz:** Design — review-ra vár

---

## 1. Háttér és cél

A Marquee MVP jelenlegi flow-ja: Director chat → brief → specialist → deliverable → approval. A `campaigns` tábla létezik (Wave 1 óta), de **csak névcímke**: összeköt pár briefet, nincs alatta stratégiai réteg.

**A fő fájdalompont:** nincs hosszú távú kontextus. Minden brief ad-hoc készül, a felhasználónak fejben kell tartania a kampány célját, audience-t, key messages-et, channel mix-et, ütemezést. Egy ügynökség **kampánytervből** vezeti le a feladatokat — ez most hiányzik.

**Megoldási irány:** új domain-objektum a kampányok alatt — `campaign_plans` (cél, audience, key messages, channel mix, timeline) + `campaign_calendar_items` (ütemezett munkák). A briefek származhatnak calendar item-ből (lazán kötve), és a Director-vezetett tervezési chat ezt a domain-modellt tölti fel.

**Pozicionálási döntések (korábbi brainstormingból):**

- **Nem új Strategist agent** — a Director kibővítése új tool-okkal és skill recipe-kkel. Két gondolkodó réteg felesleges absztrakció.
- **Lazán kötött calendar** — brief származhat item-ből, de ad-hoc brief is megengedett a kampányhoz.
- **Hibrid létrehozás (top-down default)** — Director-vezetett tervezés alapértelmezett, üres terv manuálisan is létrehozható.
- **Kettős thread-szervezés** — Workshop chat marad ad-hoc / cross-campaign discussion; minden kampánynak van **dedikált kampány-tervezési chat-je** saját history-val.
- **Rich calendar item** — placeholder szint, de minden item-en van `intent` (1-2 mondat) és `key_message_ref`, hogy a brief származtatás ne nullán induljon.
- **Két különálló UI (chat tab + plan tab)** — split-view nélkül; SSE szinkronizálja az állapotot a két tab között.

A Plan v2 (auto-suggest, proaktív Director nudge calendar-ból), Plan v3 (performance feedback, KPI tracking), és a `campaign_archetypes.md` memory template **későbbi spec tárgya**.

---

## 2. Scope

### 2.1 Be (Plan v1)

- Új DB tábla: `campaign_plans` (1:1 kampány-tervrekord) + `campaign_calendar_items` (1:N rich item) + új mező `briefs.calendar_item_id` (opcionális FK) + új mező `chat_threads.campaign_id` (opcionális FK, Plan-chat scope)
- Új Director tool-ok: `propose_campaign_plan`, `update_campaign_plan`, `propose_calendar_item`, `get_campaign_plan`. A meglévő `propose_brief` tool kibővítése opcionális `calendar_item_id` paraméterrel.
- Új Director skill: `kampany-tervezes`. A meglévő `delegate.md` és `brief_intake.md` plan-aware bővítése.
- Új REST route-ok: `GET/PUT /api/campaigns/:id/plan`, `GET/POST/PATCH/DELETE /api/campaigns/:id/plan/calendar-items/:itemId`, `POST /api/campaigns/:id/plan/calendar-items/:itemId/derive-brief`. Új SSE event család: `plan.*`, `calendar_item.*`.
- Új frontend nézet: Plan tab a Kampány-detail view-ban (form-szerű editor cél, audience, key messages, channel mix, timeline, KPI mezőkkel + calendar lista). Plan-chat tab dedikált thread-tel.
- `get_campaign_status` tool kibővítése: a state magában foglalja a tervet és a calendar progress-t.

### 2.2 Ki (későbbre)

- ❌ Auto-suggest a calendar-ból (Plan v2)
- ❌ Director proaktív nudge ("ezen a héten X item esedékes") (Plan v2)
- ❌ Performance feedback loop, KPI tracking (Plan v3, infra-igényes)
- ❌ `campaign_archetypes.md` memory template (Plan v1.5, ha az első éles tervezések indokolják)
- ❌ Kampányterv versioning vagy history (egyelőre szerkeszthető bármikor, az audit history a Director chat-ben él)
- ❌ Brief-Plan **kötelező** link (lazán kötött marad)
- ❌ Multi-tenant kampánytervek (single-tenant, default client)
- ❌ Plan template-ek vagy klónozás (Plan v1.5+)

---

## 3. Domain modell és architektúra

### 3.1 Új objektumok

```
Campaign (létezik)
  └── CampaignPlan (új, 1:1)
        ├── goal: text
        ├── goal_type: enum (lead-gen | awareness | nurture | activation | retention | other)
        ├── audience: text
        ├── key_messages: JSON Array<{ id, text }>
        ├── channel_mix: JSON Array<{ channel, weight, note? }>
        ├── timeline_start, timeline_end: integer (epoch sec, opcionális)
        ├── kpi: text (szabad szöveg, Plan v3-ig nincs strukturált tracking)
        └── CalendarItem[] (új, 1:N)
              ├── channel: enum (linkedin | email | blog | landing | ad | other)
              ├── deliverable_type: enum (vagy null, ha még nem ismert)
              ├── target_date: integer (epoch sec)
              ├── intent: text (1-2 mondat)
              ├── key_message_ref: string (CampaignPlan.key_messages[].id-re mutat, opcionális)
              ├── status: enum (planned | brief_created | delivered | cancelled)
              └── (opcionálisan: brief_id ← derive-ből)
```

**Kapcsolatok:**

- `briefs.calendar_item_id` (új, opcionális FK → `campaign_calendar_items.id`) — laza kötés. Ha kitöltött, a brief egy item-ből származik; ha NULL, ad-hoc brief.
- `chat_threads.campaign_id` (új, opcionális FK → `campaigns.id`) — ha kitöltött, ez a thread a kampány dedikált tervezési chat-je. Ha NULL, Workshop thread (current behavior).

### 3.2 Tervezési chat architektúra

A kampány-tervezési chat **ugyanaz a `chatThreads` tábla**, csak `campaign_id`-vel scope-olva. A meglévő thread/üzenetkezelő logika változatlan; a frontend a `campaign_id` alapján szűri.

**Egy kampánynak egy aktív Plan-chat thread-je van.** A thread létrejön az első tervezési üzenetnél, vagy explicit "Tervezési chat indítása" akcióval. Új thread csak akkor jön, ha az operátor archiválja a régit.

### 3.3 Brief származtatás flow

Két út egy briefhez egy kampányon belül:

**A) Calendar item-ből származtatott brief (preferált, kötött):**

```
CalendarItem (planned)
  ─[operátor: "Generate brief" akció a Plan tab-en]→
    backend: Plan-chat thread-be új üzenet kerül "Készíts briefet a következő calendar item-hez: {channel, type, intent, key_message_ref ref}"
  ─[Director: olvassa az item-et + plan-t (get_campaign_plan), és hívja a propose_brief tool-t calendar_item_id-vel]→
    BriefProposal kártya megjelenik a chat-ben (mint most)
  ─[operátor approve]→
    brief létrejön (calendar_item_id = item.id), CalendarItem.status = brief_created
  ─[deliverable approve]→
    CalendarItem.status = delivered
```

**B) Ad-hoc brief a kampányhoz (lazán kötött, calendar nélkül):**

```
operátor a Plan-chat-ben: "Csináljunk gyorsan egy posztot az X témáról"
Director: propose_brief (calendar_item_id = NULL, campaign_id = campaign.id)
  → brief létrejön, calendar nem érintett
```

Az ad-hoc brief utólag **opcionálisan** rögzíthető a tervbe (`POST /api/campaigns/:id/plan/calendar-items` body-ban `from_brief_id`-vel) — ez Plan v1.5-be megy, mert UI-igényes és nem kritikus.

### 3.4 SSE event család

A meglévő SSE infrastruktúrát követi (handler guard, dispatched brief filter — ld. CLAUDE.md gotchas).

| Event | Payload |
|---|---|
| `plan.proposed` | `{ plan_id, campaign_id, proposal: <CampaignPlanProposal>, thread_id }` |
| `plan.updated` | `{ plan_id, campaign_id, updated_fields: string[] }` |
| `calendar_item.added` | `{ item_id, plan_id, item: <CalendarItem> }` |
| `calendar_item.updated` | `{ item_id, plan_id, updated_fields: string[] }` |
| `calendar_item.deleted` | `{ item_id, plan_id }` |
| `calendar_item.status_changed` | `{ item_id, plan_id, prev_status, new_status, brief_id? }` |

A Plan tab és a Plan-chat tab egyaránt feliratkozik ezekre az event-ekre.

---

## 4. DB séma

### 4.1 Új migration: `0007_campaign_plans.sql`

```sql
CREATE TABLE `campaign_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `client_slug` text NOT NULL,
  `goal` text NOT NULL DEFAULT '',
  `goal_type` text NOT NULL DEFAULT 'other',
  `audience` text NOT NULL DEFAULT '',
  `key_messages` text NOT NULL DEFAULT '[]',
  `channel_mix` text NOT NULL DEFAULT '[]',
  `timeline_start` integer,
  `timeline_end` integer,
  `kpi` text NOT NULL DEFAULT '',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`),
  FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_campaign_plans_campaign` ON `campaign_plans` (`campaign_id`);
--> statement-breakpoint

CREATE TABLE `campaign_calendar_items` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL,
  `campaign_id` text NOT NULL,
  `client_slug` text NOT NULL,
  `channel` text NOT NULL,
  `deliverable_type` text,
  `target_date` integer NOT NULL,
  `intent` text NOT NULL DEFAULT '',
  `key_message_ref` text,
  `status` text NOT NULL DEFAULT 'planned',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`plan_id`) REFERENCES `campaign_plans`(`id`),
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`),
  FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`)
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_plan_status` ON `campaign_calendar_items` (`plan_id`, `status`, `target_date`);
--> statement-breakpoint
CREATE INDEX `idx_calendar_campaign` ON `campaign_calendar_items` (`campaign_id`, `target_date`);
--> statement-breakpoint

ALTER TABLE `briefs` ADD COLUMN `calendar_item_id` text REFERENCES `campaign_calendar_items`(`id`);
--> statement-breakpoint
ALTER TABLE `chat_threads` ADD COLUMN `campaign_id` text REFERENCES `campaigns`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_threads_campaign` ON `chat_threads` (`campaign_id`);
```

**Megjegyzések:**

- `key_messages` és `channel_mix` JSON-tárolás (SQLite-ban TEXT-ként). Drizzle séma típusát `text({ mode: 'json' }).$type<...>()` mintával adjuk meg.
- `goal_type`, `channel`, `status` enum-ok TS oldalon kötöttek; SQLite szinten szabad szöveg, validáció kódban.
- A "no cascade" policy (CLAUDE.md) érvényes: törlés nincs, status-mezővel kezeljük a cancelled-et.
- A Drizzle migration tracking bug (CLAUDE.md gotcha) a meglévő dev DB-n kézi alkalmazást igényel — VM 260-ra friss DB-vel deployoljuk, ott automatikus.

### 4.2 Drizzle schema kiegészítés (`packages/server/src/db/schema.ts`)

```typescript
export const campaignPlans = sqliteTable(
  "campaign_plans",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull().references(() => campaigns.id),
    clientSlug: text("client_slug").notNull().references(() => clients.slug),
    goal: text("goal").notNull().default(""),
    goalType: text("goal_type", {
      enum: ["lead-gen", "awareness", "nurture", "activation", "retention", "other"],
    }).notNull().default("other"),
    audience: text("audience").notNull().default(""),
    keyMessages: text("key_messages", { mode: "json" })
      .$type<Array<{ id: string; text: string }>>()
      .notNull()
      .default([]),
    channelMix: text("channel_mix", { mode: "json" })
      .$type<Array<{ channel: string; weight: number; note?: string }>>()
      .notNull()
      .default([]),
    timelineStart: integer("timeline_start"),
    timelineEnd: integer("timeline_end"),
    kpi: text("kpi").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    uniqueCampaign: uniqueIndex("uq_campaign_plans_campaign").on(t.campaignId),
  }),
);

export const campaignCalendarItems = sqliteTable(
  "campaign_calendar_items",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull().references(() => campaignPlans.id),
    campaignId: text("campaign_id").notNull().references(() => campaigns.id),
    clientSlug: text("client_slug").notNull().references(() => clients.slug),
    channel: text("channel", {
      enum: ["linkedin", "email", "blog", "landing", "ad", "other"],
    }).notNull(),
    deliverableType: text("deliverable_type", {
      enum: ["social_post", "email", "blog_post", "ad_copy", "content_brief_seo", "seo_report"],
    }),
    targetDate: integer("target_date").notNull(),
    intent: text("intent").notNull().default(""),
    keyMessageRef: text("key_message_ref"),
    status: text("status", {
      enum: ["planned", "brief_created", "delivered", "cancelled"],
    }).notNull().default("planned"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    byPlanStatus: index("idx_calendar_plan_status").on(t.planId, t.status, t.targetDate),
    byCampaign: index("idx_calendar_campaign").on(t.campaignId, t.targetDate),
  }),
);
```

A `briefs` tábla kibővül `calendarItemId: text("calendar_item_id").references(() => campaignCalendarItems.id)` mezővel; a `chatThreads` tábla `campaignId: text("campaign_id").references(() => campaigns.id)` mezővel.

---

## 5. Tool API

### 5.1 Új tool: `propose_campaign_plan`

A Director-vezetett tervezési flow összegző hívása. A Director több turn-ön keresztül kérdez (cél, audience, key msg, channel, timeline, calendar items), és a végén egy `propose_campaign_plan` hívással javasol egy tervet. Az operátor approve-olja a teljes csomagot.

**Input schema (TypeScript):**

```typescript
{
  campaign_id: string,
  goal: string,
  goal_type: "lead-gen" | "awareness" | "nurture" | "activation" | "retention" | "other",
  audience: string,
  key_messages: Array<{ id: string, text: string }>,  // id = slug-szerű, pl. "tracking-foundation-value"
  channel_mix: Array<{ channel: string, weight: number, note?: string }>,
  timeline_start?: number,  // epoch sec
  timeline_end?: number,
  kpi?: string,
  calendar_items: Array<{
    channel: "linkedin" | "email" | "blog" | "landing" | "ad" | "other",
    deliverable_type?: "social_post" | "email" | "blog_post" | "ad_copy" | "content_brief_seo" | "seo_report",
    target_date: number,
    intent: string,
    key_message_ref?: string,  // egy key_messages[].id-re mutat
  }>,  // lehet üres tömb is — a calendar utólag tölthető
  rationale: string,  // 1-2 mondat: miért így javasolja a Director
}
```

**Tool kimenet:** `{ proposal_id: string, plan_id: null }` — a tool a `messages` táblába ír egy `type: 'plan_proposal'` üzenetet (mint a brief proposal). Az operátor approve-olja a UI-ban → akkor jön létre az aktuális `campaign_plans` rekord és a calendar items-ek.

**Megjegyzés:** a `propose_brief` mintát követjük: a Director **javasol**, nem közvetlenül ír DB-be. Az approve flow operátor-felelősség.

### 5.2 Új tool: `update_campaign_plan`

Meglévő tervekre. A Director kisebb módosításokat javasolhat (pl. új key message, channel mix átsúlyozás, timeline tolás). Approval mintája megegyezik a `propose_campaign_plan`-nel: javaslat kerül a chat-be.

**Input:**

```typescript
{
  plan_id: string,
  patch: Partial<{
    goal: string, goal_type: string, audience: string,
    key_messages: Array<{ id, text }>,  // teljes csere
    channel_mix: Array<{ channel, weight, note? }>,
    timeline_start: number, timeline_end: number, kpi: string,
  }>,
  rationale: string,
}
```

### 5.3 Új tool: `propose_calendar_item`

Egyetlen calendar item javaslata meglévő tervhez. Mint a `propose_brief`, ez is operátor approve-ot igényel.

**Input:**

```typescript
{
  plan_id: string,
  channel: "linkedin" | "email" | "blog" | "landing" | "ad" | "other",
  deliverable_type?: string,
  target_date: number,
  intent: string,
  key_message_ref?: string,
  rationale: string,
}
```

### 5.4 Új tool: `get_campaign_plan`

Read-only lookup. A Director hívja, ha egy kampány tervére hivatkozik a chat-ben (Plan-chat-ben default tool, Workshop chat-ben campaign_id explicit megadva).

**Input:** `{ campaign_id: string }`

**Output:** A teljes `CampaignPlan` + calendar items (status szerint csoportosítva: planned / brief_created / delivered / cancelled count + active items list). Ha nincs még terv: `{ plan: null }`.

### 5.5 Bővített tool: `propose_brief`

A meglévő `propose_brief` tool-ban opcionális mező:

```typescript
{
  // ... meglévő mezők
  calendar_item_id?: string,  // ha kitöltött, a brief egy item-ből származik
}
```

Backend: ha `calendar_item_id` kitöltött, validál (item létezik, status = `planned`, plan→campaign egyezik). Approve után az item.status `brief_created`-re vált.

### 5.6 Bővített tool: `get_campaign_status`

A meglévő tool kimenete kibővül a Plan-tudattal:

```typescript
{
  // ... meglévő mezők (név, status, briefs count, deliverables count)
  plan: {
    has_plan: boolean,
    summary?: string,  // "B2B SaaS lead-gen, Q2, 4 fő üzenet"
    calendar_progress?: { planned: number, brief_created: number, delivered: number, cancelled: number },
  }
}
```

A Director skill recipe-jeit ennek megfelelően frissítjük (ld. 8. szakasz).

---

## 6. REST endpoint-ok

### 6.1 Plan CRUD

| Method | Path | Leírás |
|---|---|---|
| `GET` | `/api/campaigns/:id/plan` | Lehúzza a tervet (vagy `{ plan: null }`) |
| `PUT` | `/api/campaigns/:id/plan` | Teljes plan upsert (frontend Plan editor save-jére) |
| `DELETE` | `/api/campaigns/:id/plan` | (Csak ha üres terv volt) — soft-delete nincs, csak ha az operátor explicit visszavon |

A `PUT` body szerkezete megfelel a `CampaignPlan` típusnak (lásd 4.2). Auth: nincs token-védelem (default Marquee-konvenció — csak `POST /api/briefs` van védve).

### 6.2 Calendar item CRUD

| Method | Path | Leírás |
|---|---|---|
| `GET` | `/api/campaigns/:id/plan/calendar-items` | Listáz (status, range filter) |
| `POST` | `/api/campaigns/:id/plan/calendar-items` | Új item létrehozása (frontend Plan editor manuális hozzáadás) |
| `PATCH` | `/api/campaigns/:id/plan/calendar-items/:itemId` | Item módosítás |
| `DELETE` | `/api/campaigns/:id/plan/calendar-items/:itemId` | Soft-cancel (status → `cancelled`); fizikai törlés csak akkor, ha még semmi nem hivatkozik rá és a status=planned |
| `POST` | `/api/campaigns/:id/plan/calendar-items/:itemId/derive-brief` | Kiváltja a Plan-chat-ben "Készíts briefet ehhez az item-hez: {…}" üzenetet, ami triggereli a Director-t. Az endpoint tehát egy thread-üzenetet ad fel, nem közvetlenül hív tool-t. |

### 6.3 Plan-chat thread

A meglévő `/api/threads` endpoint-okat használjuk, kiegészítve a `campaign_id` query paraméterrel (`GET /api/threads?campaign_id=...`). Új thread létrehozásánál opcionális `campaign_id` body-ban.

A "Tervezési chat indítása" akció a Plan tab-en `POST /api/threads { campaign_id, title: "Kampány tervezés — {campaign.title}" }` — utána a frontend átirányít a chat tab-ra ezzel a thread_id-vel.

---

## 7. Frontend változások

### 7.1 Új nézet: Kampány-detail

A meglévő Kampányok lista nézet után egy detail view jön (router: `/campaigns/:id`). Két tab:

**Tab 1: Plan editor (default)**

Form-szerű, mezőnként szerkeszthető:

- **Cél** — text area (1-3 mondat) + dropdown a `goal_type`-hoz
- **Audience** — text area
- **Key messages** — szerkeszthető lista (add / remove / reorder), minden item: `id` (auto-slug a text-ből) + `text`
- **Channel mix** — szerkeszthető lista, minden item: dropdown channel + slider/number weight (0–100, összegzés mutatva) + opcionális megjegyzés
- **Timeline** — két dátum-picker (start, end), opcionális
- **KPI** — szabad szöveg (Plan v3-ig)
- **Calendar** — szegmentált lista (Planned / Brief created / Delivered / Cancelled), minden item-en kártya: dátum + channel chip + típus chip + intent + key_message_ref chip + status badge + akciók ("Generate brief" csak `planned` státuszon, "Edit", "Cancel")
- **"Új calendar item" akció** — modal a hat mezővel
- **Save / Discard** gombok a form-on (PUT `/api/campaigns/:id/plan`)

**Üres állapot:** ha még nincs terv, két CTA: "Tervezés Director-ral" (átirányít a Plan-chat tab-ra) vagy "Üres terv létrehozása" (létrehoz egy üres `campaign_plans` rekordot).

**Tab 2: Plan-chat**

A meglévő thread / üzenet komponensek újrahasznosítva, csak `campaign_id` scope-pal. A thread első üzenete egy system-szöveg: "Ez a {campaign.title} kampány tervezési chat-je. A Director itt kérdez, javasol terveket és calendar item-eket. A javaslatok kártyaként jelennek meg, jóváhagyás után bekerülnek a Plan tab-ra."

Új komponens: **`PlanProposalCard`** — a `BriefProposalCard` mintáját követi. Megjeleníti a javasolt tervet (cél, audience, 3-5 key message preview, channel mix sávgrafikon, timeline, calendar items count) + Approve / Vissza / Discard gombok.

Új komponens: **`CalendarItemProposalCard`** — egyetlen item kártya az add javaslathoz.

### 7.2 Kampányok listanézet kibővítés

A meglévő Kampányok nézet kártyáin új jelzés:

- Ha van terv: Plan szekció kis ikonnal + "X tervezett, Y kész" calendar progress
- Ha nincs terv: szürke "Tervezés" link

### 7.3 Brief kártya kibővítés

Ha a brief `calendar_item_id` kitöltött, a `BriefProposalCard`-on és a Brief detail-en kis chip: "📅 {channel} • {date} • {intent}". Ez segít az operátornak átlátni, honnan származik a brief.

### 7.4 Lib bővítés

`lib/api.ts`: új `plansApi` (CRUD plan + calendar items), `threadsApi` kibővítés `campaign_id` szűréssel.

`lib/design.ts`: új színek a calendar status-okhoz (planned: szürke, brief_created: kék, delivered: zöld, cancelled: piros — a meglévő `border-rule` / `text-ink-2` token-konvenciót követve).

`store/useMarqueeStore.ts`: új `plans` slice (cache plan + calendar items per campaign), SSE handler-ek a `plan.*` és `calendar_item.*` event-ekre. A meglévő SSE handler guard mintát követjük.

---

## 8. Director skill recipe-k

### 8.1 Új skill: `kampany-tervezes`

`packages/server/seed/skills/director/kampany-tervezes.md`

A skill recipe-ben:

- **Mikor töltődjön be:** ha az operátor kampánytervezést kér, vagy a Plan-chat thread első üzenete jön (a backend a thread `campaign_id`-je alapján auto-loadolhatja).
- **Top-down kérdés-szekvencia (lazán követhető):** cél → audience → key messages → channel mix → timeline → calendar items. Az operátor felülírhatja a sorrendet ("kezdjük a calendar-ral") — explicit szabály, hogy a Director rugalmasan reagál, csak a végén egyszer összesít: "ezeket fedtük le, ezekre még nem tértünk ki".
- **Few-shot példák:** 2 GrowthFrame-tipikus kampány-tervezési párbeszéd (audit-promóciós kampány, Foundation-onboarding sorozat). Mindegyik mutatja a kérdés-válasz íve, és a végén a `propose_campaign_plan` tool-hívás output struktúráját.
- **Brand voice-konzisztens** — magyarul, tegezve, közvetlen.
- **Memory hivatkozás:** kötelezően olvassa a `profile.md` (kinek készül), `brand_voice.md` (hogyan kommunikál), `ongoing_campaigns.md` (van-e átfedés más kampánnyal). Az új `kampany-tervezes` skill recipe-ben hivatkozzunk arra, hogy a `get_campaign_status` tool minden meglévő kampányhoz lekérhető — átfedési szempont.

### 8.2 Új skill: `terv-kontextusu-brief`

`packages/server/seed/skills/director/terv-kontextusu-brief.md`

- **Mikor:** ha a Director egy calendar item-ből kell briefet derive-oljon (a Plan-chat-ben `derive-brief` üzenetre).
- **Tartalom:** olvassa a calendar item-et (`channel`, `deliverable_type`, `target_date`, `intent`, `key_message_ref` → key message text), majd hívja a `propose_brief` tool-t a `calendar_item_id`-vel kitöltve. A briefben hivatkozzon a key message-re, és vegye figyelembe a target_date-t (deadline kontextusként).
- **Few-shot:** 2 példa — egy LinkedIn poszt item → brief, egy email item → brief.

### 8.3 Meglévő skill bővítés: `delegate.md` és `brief_intake.md`

Apró frissítés: ha aktív Plan-chat thread-ben vagyunk (a backend a thread context-jéből tudja), a Director **először** hívja meg a `get_campaign_plan`-t, és csak utána javasoljon briefet. Ad-hoc brief is megengedett, de a Director **explicit** jelezze: "Ez a brief a {campaign} kampányhoz tartozik, de nincs calendar item-je — utólag rögzítsük a tervbe?"

### 8.4 Nem érintett skill recipe-k

A specialist role-ok skill recipe-i (Copywriter, Social Manager, Paid Specialist, Email Marketer, SEO Specialist, Brand Voice Guardian) **változatlanok**. A specialist agent a brief tartalmát olvassa, a Plan kontextus már a brief szövegében tükröződik — nem kell újabb tool-bővítés.

---

## 9. Implementációs sorrend

| Fázis | Tartalom | Becsült idő |
|---|---|---|
| **1. DB és backend alapok** | Migration 0007, Drizzle schema, queries (CRUD plan + calendar items), `chat_threads.campaign_id` mező és thread-listázás scope-pal | ~1 nap |
| **2. Tool-ok és REST route-ok** | 4 új tool + `propose_brief` / `get_campaign_status` bővítés. Routes (Plan CRUD, Calendar item CRUD, derive-brief endpoint). SSE event család. Tool unit teszt. | ~1.5 nap |
| **3. Director skill-ek és kalibráció** | `kampany-tervezes`, `terv-kontextusu-brief` skill recipe-k few-shot-tal. `delegate.md` / `brief_intake.md` bővítés. Lokális smoke a Director chat-tel — megnézzük, követi-e a kérdés-szekvenciát, és helyesen tölti-e a tool-okat. | ~1 nap |
| **4. Frontend Plan tab** | Kampány-detail view, Plan editor form, Calendar lista + kártyák, Új calendar item modal. PUT save flow + SSE handler. | ~1.5 nap |
| **5. Frontend Plan-chat tab** | Thread scope `campaign_id`-vel, `PlanProposalCard`, `CalendarItemProposalCard`, "Tervezés Director-ral" CTA flow. | ~1 nap |
| **6. Brief származtatás flow E2E** | "Generate brief" gomb a Plan tab-en → derive-brief endpoint → Plan-chat üzenet → Director propose_brief calendar_item_id-vel → approve → status frissítés. Cross-tab SSE szinkronizáció ellenőrzése. | ~0.5 nap |

**Összesen:** ~6-7 nap valós munka. Egy iteratív körre 5-7 napos tartomány reális; ha váratlan UX-súrlódás jön a Plan editor-ral, +1 nap.

**Indok a sorrendre:** alulról építkezünk (DB → tool → skill → UI), hogy minden réteg lokálisan teszteltesse magát mielőtt az UI-ig jutnánk. A Plan tab a Plan-chat előtt van, mert az approve flow szerkezete (`PlanProposalCard`) gyorsabban összerakható, ha a Plan editor adatmodellje már stabil.

---

## 10. Kockázatok és mitigáció

| # | Kockázat | Mitigáció |
|---|---|---|
| 1 | **Director kontextus-overhead a Plan-chat-ben.** Ha minden turn-be beégetjük a teljes tervet és calendar-t, a context elszáll (különösen `gpt-5.4` warm agent esetén, sok turn után). | A thread initial system promptjába csak compact summary kerül (kampány név, cél 1 mondatban, calendar count by status). Részletes terv csak `get_campaign_plan` tool-hívásra. A `kampany-tervezes` skill recipe-ben explicit szabály: "ha új információ kell, hívj tool-t, ne kérdezd újra". |
| 2 | **Top-down chat ugrálási tolerancia.** Az operátor közbeszól ("kezdjük a calendar-ral, a többit utólag"), és a Director vagy összezavarodik, vagy túl szolgaian visszaugrik a sorrendre. | Skill recipe-ben explicit szabály: bármelyik szekció kihagyható vagy felcserélhető, csak a végén egyszer összesítse mit nem fedtünk le. Few-shot az "ugráló" párbeszédből. Smoke teszt egy "ki nem tartott" sorrenddel. |
| 3 | **Calendar item status drift.** Ha brief törlődik / újragenerálódik, vagy ad-hoc brief kötődik utólag az item-hez, a status könnyen rossz állapotba kerülhet. | Egyetlen igazságforrás: a calendar item status-átmenetei event-driven állapotgép a backend-ben. `brief.created (with calendar_item_id)` → `brief_created`; `brief.approved` → `delivered`; `brief.discarded` → `planned`. Unit teszt a state machine-re. UI nem írhat status-t közvetlenül, csak a `cancel` action. |
| 4 | **Plan-chat / Workshop chat keveredése.** Ha az operátor véletlenül Workshop chat-ben tervez (campaign_id nélkül), a Director nem fér hozzá a `get_campaign_plan` tool-hoz, és ad-hoc briefet javasol. | A Director skill `kampany-tervezes` thread-context aware — csak akkor töltődik be, ha `campaign_id` ki van töltve. A Workshop chat-ben a Director maradjon a meglévő `delegate.md` / `brief_intake.md` flow-n. UI-ban világos vizuális jelzés: "📅 Kampány tervezés: {campaign.title}" header a Plan-chat thread-en. |
| 5 | **Migration tracking bug a meglévő dev DB-n** (CLAUDE.md gotcha). | Új migration manuálisan alkalmazható: `sqlite3 ~/.marquee-dev/state.db < drizzle/0007_campaign_plans.sql` + hash insert a `__drizzle_migrations`-be. VM 260-on friss DB-vel automatikus. Ezt a deploy script frissítésével dokumentáljuk. |
| 6 | **Plan editor UX-súrlódás.** Sok mező, lista-szerkesztők (key messages, channel mix, calendar) — könnyű túlbonyolítani. | Plan v1-ben minimal viable form: minden lista-mező egyszerű "add row / remove row / inline edit" — drag-and-drop reorder nincs. Ha a használat azt mutatja, hogy ez kevés, Plan v1.1-ben fejlesztjük. |
| 7 | **`propose_campaign_plan` tool input-túlterhelés.** A Director túl sok mezőt egyszerre tölt, a payload nagy lesz, és a `gpt-5.4` modell el-tévedhet a struktúrában. | Tool description: a Director **lépésenként** tölti a kontextust kérdés-válasszal, és a `propose_campaign_plan`-t **utolsó** lépésként hívja, akkor amikor minden kötelező mező (cél, audience, legalább 1 key message, channel mix) már a chat-ben tisztázott. Calendar items lehet üres — utólag tölthető. |

---

## 11. Akceptálási kritériumok

A Plan v1 akkor minősül késznek, ha:

1. **DB és backend:**
   - `0007_campaign_plans.sql` migration alkalmazva, lokális dev DB és friss DB egyaránt
   - `npx tsc --noEmit` zöld a `packages/server`-ben
   - Vitest unit tesztek zöldek a queries, calendar item state machine, és tool input validációra

2. **Director-vezetett tervezés:**
   - Plan-chat-ben "Tervezzünk Q2-re egy audit-promóciós kampányt" üzenetre a Director konzisztensen végigvezeti az 5+ kérdést, és a végén `propose_campaign_plan`-t hív érvényes payloaddal
   - Operátor approve után a Plan tab-en megjelenik a teljes terv + calendar items (ha voltak)
   - Ugyanez a flow akkor is működik, ha az operátor "kezdjük a calendar-ral" kéréssel ugrál — a Director rugalmasan reagál, és a végén jelzi, mit nem fedtünk le

3. **Üres terv és manuális szerkesztés:**
   - "Üres terv létrehozása" akció a Plan tab-en létrehoz egy üres `campaign_plans` rekordot
   - Plan editor formon mezőnként szerkeszthető és menthető (PUT endpoint)
   - "Új calendar item" modal-ból manuálisan rögzíthető item

4. **Brief származtatás:**
   - "Generate brief" gomb a Plan tab calendar item-en aktiválja a Plan-chat-ben a Director-t, aki `propose_brief`-et hív a `calendar_item_id`-vel
   - Brief approve után a calendar item status-a automatikusan `brief_created`-re vált (SSE-n keresztül a Plan tab is frissül)
   - Deliverable approve után az item `delivered`-re vált
   - Discard után `planned`-re vissza

5. **Ad-hoc brief lazán kötve:**
   - Plan-chat-ben "csináljunk egy posztot az X témáról" típusú kérés ad-hoc briefet eredményez (`calendar_item_id = NULL`, `campaign_id = campaign.id`)
   - A Director jelzi: "Ez nem kapcsolódik calendar item-hez."

6. **Frontend UX:**
   - Plan tab és Plan-chat tab cross-szinkronizál SSE-n keresztül (új item Plan tab-en → azonnal látszik a Plan-chat-ben mint context, fordítva is)
   - Kampányok listanézet kibővítve plan progress-szel
   - Brief kártyán a calendar item chip megjelenik, ha a brief származtatott

7. **Smoke a meglévő flow-ra:**
   - Workshop chat (campaign_id nélkül) flow változatlan — a meglévő smoke teszt zöld
   - Régi briefek (calendar_item_id NULL) hibamentesen működnek

---

## 12. Nyitott kérdések / későbbi döntések

- **Plan v1.5 / v2 ütemezés.** A Plan v1 deploy után 1-2 hét éles használat (saját marketing munka), és csak akkor döntünk Plan v2-ről (auto-suggest, proaktív Director nudge), ha a manuális calendar szerkesztés tényleg súrlódik. Ne előre építsünk.
- **`campaign_archetypes.md` memory template.** Ha az első 2-3 kampánytervezésnél a Director ugyanazt a struktúrát találja ki (audit-promóciós kampány, onboarding sorozat, érettségi sorozat), érdemes lefagyasztani archetype-ekké. Ez a Plan v1 utáni első user-driven kalibrációs lépés.
- **Plan history / versioning.** Most nincs — szerkeszthető bármikor. Ha a használat azt mutatja, hogy a tervek "megkövülnek" és vissza kéne hozni egy korábbi verziót, Plan v1.5-ben memory snapshot alapú history fontolható.
- **Multi-tenant kampánytervek.** A `campaign_plans.client_slug` mező már most felkészített, de a default client-en kívüli use case nem cél most. Ha SaaS irány felmerül (CLAUDE.md említi), külön spec.
- **Kampányterv export / megosztás.** Marquee-ből kifelé (PDF, link, Notion sync). Plan v3 vagy később.
- **Performance feedback loop.** A `kpi` mező most szabad szöveg; Plan v3-ban strukturált tracking + n8n inbound performance feed. Külön spec.

---

## 13. Hivatkozások

- Marquee MVP redesign spec: `docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md`
- Wave 1 új agentek spec: `docs/superpowers/specs/2026-04-30-marquee-new-agents-wave-1-design.md`
- Capability Wave 1 spec: `docs/superpowers/specs/2026-04-30-marquee-capability-wave-1-design.md`
- Marquee project CLAUDE.md (gotchas): `marquee/CLAUDE.md`
- Repo: `~/Projects/Homelab/marquee`
- Production: `marquee.lab2.home.arpa` (VM 260) — Plan v1 deploy halasztva
