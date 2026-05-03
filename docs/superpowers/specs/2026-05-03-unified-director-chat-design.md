# Marquee — Unified Director Chat + Kampányok accordion nézet

**Dátum:** 2026-05-03
**Branch:** feature/campaign-management
**Státusz:** Design jóváhagyva, implementációra vár

---

## 1. Motiváció

A jelenlegi rendszer két helyen teszi elérhetővé a Directort: Workshop chat (ad-hoc briefe-k) és Kampány tervezési chat (kampányterv, calendar-linked briefe-k). A két belépési pont zavart okoz:

- Navigációs konfúzió: nem egyértelmű mikor melyiket kell megnyitni
- Kontextusvesztés: a Director singleton újraindul threadváltáskor
- Fogalmi átfedés: mindkét chat ugyanazt a Directort hívja, más-más kontextussal

**Megoldás:** egy Director, egy chat (Workshop), kampány-aware eszközkészlettel. A tervezési chat tab eltűnik, a kampányok oldalon accordion nézet jelenik meg.

---

## 2. Scope

### Be

- `Campaigns.tsx` átalakítása accordion-ra (inline expand kampányra kattintáskor)
- Plan editor + calendar megjelenítése az accordion belső részében
- `CampaignDetail.tsx` és `/kampanyok/:id` route eltávolítása
- "Generate brief" gomb eltávolítása a `CalendarItemCard`-ból
- `derive-brief` endpoint törlése (`plans.ts`-ből)
- `kampany_tervezes.md` skill frissítése: Workshop threadből is aktiválódik
- `terv_kontextusu_brief.md` skill frissítése: Director proaktívan ajánlja briefet calendar context alapján
- Plan-chat thread létrehozásának eltávolítása a frontendről

### Ki (nem változik)

- Workshop chat és Director logika (`index.ts`) — változatlan
- Plan tool-ok (`propose_campaign_plan`, `update_campaign_plan`, `propose_calendar_item`, `get_campaign_plan`, `get_campaign_status`) — változatlan
- Calendar state machine (`brief_dispatched` → `brief_created`, `deliverable_approved` → `delivered`) — változatlan
- Plan editor form mezők és mentési logika (PUT endpoint) — változatlan
- Plan proposal + calendar item proposal kártyák — változatlan
- `GET /api/threads` Workshop filter (`campaignId IS NULL`) — marad

---

## 3. Frontend architektúra

### 3.1 `Campaigns.tsx` — accordion

A jelenlegi master-detail layout (sidebar + jobb panel) **accordion-ra cserélődik**.

**Új viselkedés:**
- Kampánylista: minden kampány egy kattintható kártya
- Kattintásra: az adott kampány kártya kinyílik (expand) és megmutatja:
  - Kampányterv szerkeszthető form (PlanEditor komponens) — cél, audience, key messages, channel mix, KPI
  - Calendar lista (státusz badge-ekkel, item kártyákkal)
  - Deliverables szekció (a jelenlegi részletes nézet tartalma)
- Másik kampányra kattintáskor az előző bezárul, az új kinyílik
- State: `expandedId: string | null` — egy időben max. egy kinyitva

**Eltávolítandó a jelenlegi kódból:**
- `useNavigate` és `navigate(/kampanyok/)` hívások
- "Terv nézet" gomb
- Master-detail panel logika (`selected` state, `SidebarPanel` / jobb panel struktúra)

**Megtartandó:**
- `campaignsApi.list()` + `campaignsApi.get(id)` hívások (get-tel töltjük be az expanded adatot)
- Státusz módosítás (Befejezett / Archiválás / Visszaállítás gombok — az accordion fejlécébe kerülnek)
- `plan_summary` display a kártya preview-ban (már létezik a `CampaignRow`-ban)

### 3.2 Plan editor és calendar az accordion-ban

Az accordion kinyitott állapotában két szekció jelenik meg egymás alatt:

**Szekció 1 — Terv**
A `PlanEditor` komponens közvetlenül az accordion belsejébe kerül. Mentés a PUT endpointon. Ha nincs terv: "Kérj tervjavaslatot a Directortól a Workshopban" üzenet.

**Szekció 2 — Calendar**
`CalendarItemCard` komponensek újrahasznosítva, `onDeriveBrief` prop nélkül.

**Szekció 3 — Tartalmak**
A jelenlegi detail panel deliverable listája (típus chip + cím + státusz).

### 3.3 `CampaignDetail.tsx` — eltávolítás

A `CampaignDetail.tsx` fájl törlődik. Az `App.tsx`-ből eltávolítandók:
```
<Route path="/kampanyok/:id" element={<CampaignDetail />} />
<Route path="/campaigns/:id" element={<CampaignDetail />} />
```
és a `CampaignDetail` import.

### 3.4 `CalendarItemCard.tsx` — `onDeriveBrief` eltávolítás

Az `onDeriveBrief` prop és a "Generate brief" gomb eltávolítása. A prop más helyen nincs használva.

---

## 4. Backend változások

### 4.1 `derive-brief` endpoint törlése

`plans.ts`-ből törlendő:
```
app.post(/api/campaigns/:id/plan/calendar-items/:itemId/derive-brief, ...)
```

### 4.2 `plansApi.deriveBrief` törlése a frontendről

`lib/api.ts`-ből a `deriveBrief` metódus törlése.

### 4.3 Nincs új endpoint, nincs migration.

---

## 5. Skills frissítés

### 5.1 `kampany_tervezes.md`

**Jelenlegi bevezető (törlendő):**
> "Aktivald ezt a skillt, ha a thread kampanyhoz kotott (campaign_id), es az operator kampanytervezest ker."

**Új bevezető:**
> "Aktivald ezt a skillt, ha az operator kampanytervezest ker, vagy egy konkret kampany nevet emliti es tervet szeretne. A kampany kontextusat a `get_campaign_status` es `get_campaign_plan` eszkozokkel szerzed meg — nem szukseges kampany-kotott thread."

A folyamat és kimeneti szabályok változatlanok.

### 5.2 `terv_kontextusu_brief.md`

A skill teljes átírása. Új tartalom:

```markdown
---
name: terv_kontextusu_brief
description: Kampanytervbol brief szarmaztatas — Director proaktivan ajanlya briefet
  amikor calendar itemeket targyalnak
---

Aktivald ezt a skillt, ha az operator egy kampany calendar itemeirol beszel, es brief
szarmaztatas logikusnak tunik.

## Folyamat

1. Hivd a `get_campaign_plan` toolt az aktualis kampany id-javal.
2. Azonositsd melyik calendar item(ek)hez kapcsolodik a beszelgetes
   (channel, intent, target_date alapjan).
3. Ha van egyertelmu egyezes: javasold a brief letrehozasat az adott itemhez.
   - Jelezd az operatornak: "Ezt a posztot a tervbol szarmaztatnam — calendar item: [intent], [datum]."
   - Kerd jovat (igennel folytat, nemmel ad-hoc brief lesz).
4. Javasolt esetben hivd a `propose_brief` toolt a `calendar_item_id` mezoval kitoltve.

## Szabalyok

- Ne hivj propose_brief-et explicit operator jovahagyas nelkul.
- Ha tobb calendar item is illene, kerdezz vissza melyikre gondolt.
- Ad-hoc brief (calendar_item_id nelkul) akkor keszul, ha az operator explicit
  jelzi, vagy nincs megfelelo item a tervben.
```

---

## 6. Érintett fájlok

| Fájl | Változás |
|---|---|
| `packages/web/src/views/Campaigns.tsx` | Teljes újraírás — accordion layout |
| `packages/web/src/views/CampaignDetail.tsx` | Törlés |
| `packages/web/src/App.tsx` | `/kampanyok/:id` és `/campaigns/:id` route-ok törlése |
| `packages/web/src/components/CalendarItemCard.tsx` | `onDeriveBrief` prop törlése |
| `packages/web/src/components/CalendarItemEditModal.tsx` | Változatlan — state kezelése `Campaigns.tsx`-be kerül |
| `packages/web/src/lib/api.ts` | `deriveBrief` metódus törlése |
| `packages/server/src/server/routes/plans.ts` | `derive-brief` endpoint törlése |
| `packages/server/seed/skills/director/kampany_tervezes.md + ~/.marquee/skills/director/kampany_tervezes.md` | Bevezető feltétel frissítése |
| `packages/server/seed/skills/director/terv_kontextusu_brief.md + ~/.marquee/skills/director/terv_kontextusu_brief.md` | Teljes átírás |

---

## 7. Implementációs sorrend

1. **Backend cleanup** — `derive-brief` endpoint törlése, `plans.ts` takarítás
2. **Frontend cleanup** — `CalendarItemCard` `onDeriveBrief` prop törlése, `api.ts` `deriveBrief` törlése
3. **`Campaigns.tsx` újraírás** — accordion layout, plan + calendar szekciók inline
4. **`CampaignDetail.tsx` és route törlése** — `App.tsx` cleanup
5. **Skills frissítés** — `kampany_tervezes.md` + `terv_kontextusu_brief.md`
6. **Tesztelés** — Workshop chatből kampánytervezés, calendar item briefelés

---

## 8. Akceptálási kritériumok

- `/kampanyok` oldalon kampányra kattintva inline kinyílik a terv + calendar + tartalmak
- Nincs "Tervezési chat" tab sehol az alkalmazásban
- Nincs "Generate brief" gomb a calendar itemeknél
- Workshop chatből a Director `get_campaign_status` + `get_campaign_plan` hívással megszerzi a kampány kontextusát és tud `propose_campaign_plan`-t és `propose_brief`-et (calendar_item_id-vel) javasolni
- `npx tsc --noEmit` hibamentes mindkét package-ben
- Vitest tesztek zöldek
