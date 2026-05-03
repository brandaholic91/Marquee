# Unified Director Chat + Kampányok Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egyetlen Workshop Director chat ami kampány-aware, accordion kampánylista a plan/calendar inline nézettel, Plan-chat tab eltávolítása.

**Architecture:** Backend cleanup (derive-brief endpoint törlése), majd `Campaigns.tsx` teljes újraírása accordion layoutra a meglévő `PlanEditor` + `CalendarItemCard` komponensekkel, végül `CampaignDetail.tsx` törlése és skills frissítés. A Workshop `ChatThread.tsx` már renderi a `plan_proposal` üzeneteket — nincs változás.

**Tech Stack:** React 19, TypeScript, Fastify 5, Vitest, Tailwind 3

---

## File Map

| Fájl | Változás |
|---|---|
| `packages/server/src/server/routes/plans.ts` | `derive-brief` endpoint törlése |
| `packages/server/src/server/routes/plans.test.ts` | Test: derive-brief 404 |
| `packages/web/src/views/Campaigns.tsx` | Teljes újraírás — accordion |
| `packages/web/src/views/CampaignDetail.tsx` | Törlés |
| `packages/web/src/App.tsx` | `/kampanyok/:id` route törlése |
| `packages/web/src/components/CalendarItemCard.tsx` | `onDeriveBrief` prop törlése |
| `packages/web/src/lib/api.ts` | `deriveBrief` metódus törlése |
| `packages/server/seed/skills/director/kampany_tervezes.md` | Bevezető feltétel frissítése |
| `packages/server/seed/skills/director/terv_kontextusu_brief.md` | Teljes átírás |
| `/home/balazs/.marquee/skills/director/kampany_tervezes.md` | Ugyanaz (élő adat) |
| `/home/balazs/.marquee/skills/director/terv_kontextusu_brief.md` | Ugyanaz (élő adat) |

---

## Task 1: Backend — `derive-brief` endpoint törlése

**Files:**
- Modify: `packages/server/src/server/routes/plans.ts`
- Modify: `packages/server/src/server/routes/plans.test.ts`

- [ ] **Step 1: Írj failing tesztet**

A `plans.test.ts` fájl végére add hozzá (a záró `});` elé):

```typescript
  it("derive-brief endpoint does not exist (removed)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/campaigns/c1/plan/calendar-items/nonexistent/derive-brief",
    });
    expect(res.statusCode).toBe(404);
  });
```

- [ ] **Step 2: Futtasd a tesztet — bukjon el**

```bash
cd /opt/marquee/packages/server
npx vitest run src/server/routes/plans.test.ts --reporter=verbose
```

Várt eredmény: az új teszt FAIL-t mutat (endpoint még létezik, 202-t ad vissza).

- [ ] **Step 3: Töröld a derive-brief endpointot a `plans.ts`-ből**

`packages/server/src/server/routes/plans.ts`-ből töröld a teljes alábbi blokkot (kb. 30 sor):

```typescript
app.post<{ Params: { id: string; itemId: string } }>("/api/campaigns/:id/plan/calendar-items/:itemId/derive-brief", async (req, reply) => {
  // ... teljes blokk törlése ...
});
```

Valamint töröld a `chatThreads` importot ha csak itt volt használva:
```typescript
// Ha a sor így néz ki:
import { campaignCalendarItems, campaignPlans, campaigns, chatThreads, messages } from "../../db/schema.js";
// Cseréld erre:
import { campaignCalendarItems, campaignPlans, campaigns, messages } from "../../db/schema.js";
```

- [ ] **Step 4: Futtasd a teszteket — zöldek legyenek**

```bash
cd /opt/marquee/packages/server
npx vitest run src/server/routes/plans.test.ts --reporter=verbose
```

Várt: minden teszt PASS, beleértve az új derive-brief 404 tesztet.

- [ ] **Step 5: TS check**

```bash
cd /opt/marquee && npx tsc --noEmit -p packages/server/tsconfig.json
```

Várt: nincs hiba.

- [ ] **Step 6: Commit**

```bash
cd /opt/marquee
git add packages/server/src/server/routes/plans.ts packages/server/src/server/routes/plans.test.ts
git commit -m "feat(campaign): remove derive-brief endpoint — Director proactively suggests briefs"
```

---

## Task 2: `Campaigns.tsx` — accordion layout újraírás

**Files:**
- Modify: `packages/web/src/views/Campaigns.tsx` (teljes csere)

- [ ] **Step 1: Cseréld le a teljes `Campaigns.tsx` tartalmát**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  campaignsApi,
  plansApi,
  type CampaignRow,
  type CampaignDetail,
  type CampaignPlan,
  type CalendarItem,
} from "../lib/api.js";
import { PlanEditor } from "../components/PlanEditor.js";
import { CalendarItemCard } from "../components/CalendarItemCard.js";
import { CalendarItemEditModal } from "../components/CalendarItemEditModal.js";
import { marqueeEvents } from "../lib/sse.js";

const STATUS_LABEL: Record<string, string> = {
  active: "Aktív",
  completed: "Befejezett",
  archived: "Archivált",
};

const STATUS_CLASS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-500",
};

const TYPE_LABEL: Record<string, string> = {
  social_post: "Social poszt",
  email: "Email",
  blog_post: "Blog poszt",
  ad_copy: "Hirdetés",
};

const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  drafting: "Folyamatban",
  awaiting_approval: "Jóváhagyásra vár",
  shipped: "Kiszállítva",
  archived: "Archivált",
};

type ExpandedData = {
  detail: CampaignDetail;
  plan: CampaignPlan | null;
  items: CalendarItem[];
};

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<ExpandedData | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    campaignsApi
      .list()
      .then((rows) => {
        setCampaigns(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!expandedId) {
      setExpandedData(null);
      return;
    }
    setExpandLoading(true);
    void Promise.all([campaignsApi.get(expandedId), plansApi.get(expandedId)])
      .then(([detail, planRes]) => {
        setExpandedData({ detail, plan: planRes.plan, items: planRes.calendar_items });
      })
      .finally(() => setExpandLoading(false));
  }, [expandedId]);

  useEffect(() => {
    if (!expandedId) return;
    marqueeEvents.start();
    const refresh = () =>
      void plansApi.get(expandedId).then((r) =>
        setExpandedData((d) => (d ? { ...d, plan: r.plan, items: r.calendar_items } : null))
      );
    const unsubs = [
      marqueeEvents.on("plan.accepted", refresh),
      marqueeEvents.on("plan.updated", refresh),
      marqueeEvents.on("calendar_item.added", refresh),
      marqueeEvents.on("calendar_item.updated", refresh),
      marqueeEvents.on("calendar_item.status_changed", refresh),
    ];
    return () => unsubs.forEach((u) => u());
  }, [expandedId]);

  async function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function setStatus(id: string, status: string) {
    await campaignsApi.patch(id, { status });
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: status as CampaignRow["status"] } : c))
    );
    if (expandedData?.detail.id === id) {
      setExpandedData((d) =>
        d ? { ...d, detail: { ...d.detail, status: status as CampaignDetail["status"] } } : null
      );
    }
  }

  const keyMessageById = new Map(
    (expandedData?.plan?.keyMessages ?? []).map((km) => [km.id, km.text])
  );

  if (loading) return <p className="text-ink-2 text-sm py-8 px-5">Betöltés…</p>;

  if (campaigns.length === 0) {
    return (
      <div className="py-16 text-center px-5">
        <p className="text-ink-2">Még nincs kampány.</p>
        <p className="text-ink-2 text-sm mt-1">
          A Director automatikusan létrehoz egyet, ha kampánynevet adsz egy brief javaslatakor.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5 pb-14 md:pb-5 space-y-3">
      <h1 className="text-xl font-bold text-ink-1 mb-4">Kampányok</h1>

      {campaigns.map((c) => {
        const isExpanded = expandedId === c.id;
        const progress = c.plan_summary?.calendar_progress;

        return (
          <div key={c.id} className="border border-rule rounded-lg overflow-hidden">
            {/* Accordion header */}
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between bg-off-white hover:bg-parchment transition-colors"
              onClick={() => void toggleExpand(c.id)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-ink-1 truncate">{c.title}</span>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLASS[c.status] ?? ""}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
                <div className="text-[11px] text-ink-3 mt-0.5">
                  {c.deliverableCount} tartalom
                  {c.pendingApprovals > 0 ? ` · ${c.pendingApprovals} vár` : ""}
                  {progress
                    ? ` · 📋 ${progress.planned + progress.brief_created} tervezett, ${progress.delivered} kész`
                    : ""}
                </div>
              </div>
              <span className="text-ink-3 text-sm ml-3 shrink-0">{isExpanded ? "▾" : "▸"}</span>
            </button>

            {/* Accordion body */}
            {isExpanded && (
              <div className="border-t border-rule bg-cream px-4 py-4 space-y-6">
                {expandLoading ? (
                  <p className="text-ink-2 text-sm">Betöltés…</p>
                ) : (
                  <>
                    {/* Status actions */}
                    <div className="flex gap-2 flex-wrap">
                      {c.status !== "completed" && (
                        <button
                          onClick={() => void setStatus(c.id, "completed")}
                          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                        >
                          Befejezett
                        </button>
                      )}
                      {c.status !== "archived" && (
                        <button
                          onClick={() => void setStatus(c.id, "archived")}
                          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                        >
                          Archiválás
                        </button>
                      )}
                      {c.status === "archived" && (
                        <button
                          onClick={() => void setStatus(c.id, "active")}
                          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                        >
                          Visszaállítás
                        </button>
                      )}
                    </div>

                    {/* Plan section */}
                    <div>
                      <h2 className="text-sm font-semibold text-ink-1 mb-3">Kampányterv</h2>
                      {expandedData?.plan || true ? (
                        <PlanEditor
                          initial={expandedData?.plan ?? null}
                          busy={saving}
                          onStartPlanning={() => navigate("/")}
                          onCreateEmptyPlan={async () => {
                            setSaving(true);
                            await plansApi.put(c.id, {
                              goal: "",
                              goal_type: "other",
                              audience: "",
                              key_messages: [],
                              channel_mix: [],
                              timeline_start: null,
                              timeline_end: null,
                              kpi: "",
                            });
                            const r = await plansApi.get(c.id);
                            setExpandedData((d) => (d ? { ...d, plan: r.plan, items: r.calendar_items } : null));
                            setSaving(false);
                          }}
                          onSave={async (form) => {
                            setSaving(true);
                            await plansApi.put(c.id, form);
                            const r = await plansApi.get(c.id);
                            setExpandedData((d) => (d ? { ...d, plan: r.plan } : null));
                            setSaving(false);
                          }}
                        />
                      ) : (
                        <p className="text-sm text-ink-2">
                          Nincs terv.{" "}
                          <Link to="/" className="text-primary hover:underline">
                            Kérj tervjavaslatot a Directortól a Workshopban.
                          </Link>
                        </p>
                      )}
                    </div>

                    {/* Calendar section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-ink-1">Calendar</h2>
                        <button
                          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                          onClick={() => setAddingItem(true)}
                        >
                          Item hozzáadása
                        </button>
                      </div>
                      {(expandedData?.items ?? []).length === 0 ? (
                        <p className="text-sm text-ink-2">Még nincs calendar item.</p>
                      ) : (
                        <div className="space-y-2">
                          {(expandedData?.items ?? []).map((item) => (
                            <CalendarItemCard
                              key={item.id}
                              item={item}
                              keyMessageText={
                                item.keyMessageRef ? keyMessageById.get(item.keyMessageRef) ?? null : null
                              }
                              onEdit={(current) => setEditingItem(current)}
                              onDelete={(itemId) =>
                                void plansApi
                                  .deleteCalendarItem(c.id, itemId)
                                  .then(() => plansApi.get(c.id))
                                  .then((r) =>
                                    setExpandedData((d) =>
                                      d ? { ...d, items: r.calendar_items } : null
                                    )
                                  )
                              }
                              onOpenApprovals={() => window.location.assign("/jovahagyas")}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Deliverables section */}
                    {(expandedData?.detail.deliverables ?? []).length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold text-ink-1 mb-3">Tartalmak</h2>
                        <div className="space-y-2">
                          {expandedData!.detail.deliverables.map((d) => (
                            <button
                              key={d.id}
                              onClick={() => window.location.assign(`/jovahagyas/${d.id}`)}
                              className="w-full text-left border border-rule rounded-[8px] px-3.5 py-3 bg-off-white hover:border-rule-strong hover:bg-parchment flex items-center justify-between transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="bg-parchment text-ink-2 text-[10px] font-semibold px-2 py-0.5 rounded-chip">
                                  {TYPE_LABEL[d.type] ?? d.type}
                                </span>
                                <span className="text-[13px] text-ink-1">
                                  {d.title ?? new Date(d.updatedAt).toLocaleDateString("hu-HU")}
                                </span>
                              </div>
                              <span className="text-[11px] text-ink-2">
                                {DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {(addingItem || editingItem) && (
        <CalendarItemEditModal
          initial={editingItem}
          keyMessages={expandedData?.plan?.keyMessages ?? []}
          onClose={() => {
            setAddingItem(false);
            setEditingItem(null);
          }}
          onSave={async (payload) => {
            if (!expandedId) return;
            if (editingItem) {
              await plansApi.updateCalendarItem(expandedId, editingItem.id, payload);
            } else {
              await plansApi.createCalendarItem(expandedId, payload);
            }
            setAddingItem(false);
            setEditingItem(null);
            const r = await plansApi.get(expandedId);
            setExpandedData((d) => (d ? { ...d, items: r.calendar_items } : null));
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: TS check**

```bash
cd /opt/marquee && npx tsc --noEmit -p packages/web/tsconfig.json 2>&1 | head -30
```

Várható hiba: `onDeriveBrief` prop hiánya a `CalendarItemCard`-ban — ez az, amit a következő Task javít. Ha más hibát kapsz, javítsd először azt.

- [ ] **Step 3: Commit**

```bash
cd /opt/marquee
git add packages/web/src/views/Campaigns.tsx
git commit -m "feat(campaign): campaigns accordion with inline plan + calendar"
```

---

## Task 3: Cleanup — `CalendarItemCard`, `api.ts`, `CampaignDetail.tsx`, `App.tsx`

Ezt az egész task-t egy commitban csináld, mert az eltávolítások egymásra épülnek.

**Files:**
- Modify: `packages/web/src/components/CalendarItemCard.tsx`
- Modify: `packages/web/src/lib/api.ts`
- Delete: `packages/web/src/views/CampaignDetail.tsx`
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: `CalendarItemCard.tsx` — `onDeriveBrief` prop törlése**

A `CalendarItemCard.tsx`-ben töröld az `onDeriveBrief` prop-ot az interfészből és a JSX-ből.

Az interfészt változtasd erről:
```typescript
export function CalendarItemCard({
  item,
  keyMessageText,
  onDeriveBrief,
  onEdit,
  onDelete,
  onOpenApprovals,
}: {
  item: CalendarItem;
  keyMessageText?: string | null;
  onDeriveBrief: (itemId: string) => void;
  onEdit: (item: CalendarItem) => void;
  onDelete: (itemId: string) => void;
  onOpenApprovals?: () => void;
})
```

Erre:
```typescript
export function CalendarItemCard({
  item,
  keyMessageText,
  onEdit,
  onDelete,
  onOpenApprovals,
}: {
  item: CalendarItem;
  keyMessageText?: string | null;
  onEdit: (item: CalendarItem) => void;
  onDelete: (itemId: string) => void;
  onOpenApprovals?: () => void;
})
```

A JSX-ből töröld a "Generate brief" gombot:
```tsx
// TÖRLENDŐ ez a teljes blokk:
<button className="text-xs px-2 py-1 border border-rule rounded hover:bg-parchment" onClick={() => onDeriveBrief(item.id)}>
  Generate brief
</button>
```

- [ ] **Step 2: `api.ts` — `deriveBrief` törlése**

A `packages/web/src/lib/api.ts`-ből töröld a két sort:
```typescript
deriveBrief: (campaignId: string, itemId: string): Promise<{ ok: true }> =>
  post(`/api/campaigns/${campaignId}/plan/calendar-items/${itemId}/derive-brief`),
```

- [ ] **Step 3: `CampaignDetail.tsx` törlése**

```bash
rm /opt/marquee/packages/web/src/views/CampaignDetail.tsx
```

- [ ] **Step 4: `App.tsx` — route-ok és import törlése**

Az `App.tsx`-ből töröld:
```typescript
import { CampaignDetail } from './views/CampaignDetail.js';
```

És a két route-ot:
```tsx
<Route path="/kampanyok/:id" element={<CampaignDetail />} />
<Route path="/campaigns/:id" element={<CampaignDetail />} />
```

- [ ] **Step 5: TS check — nullás hibák**

```bash
cd /opt/marquee && npx tsc --noEmit -p packages/web/tsconfig.json 2>&1
```

Várt eredmény: nincs hiba.

- [ ] **Step 6: Full test suite**

```bash
cd /opt/marquee/packages/server && npx vitest run --reporter=verbose 2>&1 | tail -10
```

Várt: 245+ teszt, mind PASS.

- [ ] **Step 7: Build**

```bash
cd /opt/marquee && npm run build --workspaces 2>&1 | grep -E "error|built|tsc"
```

Várt: `✓ built` hibák nélkül.

- [ ] **Step 8: Commit**

```bash
cd /opt/marquee
git add packages/web/src/components/CalendarItemCard.tsx \
        packages/web/src/lib/api.ts \
        packages/web/src/App.tsx
git rm packages/web/src/views/CampaignDetail.tsx
git commit -m "feat(campaign): remove CampaignDetail + onDeriveBrief + deriveBrief API"
```

---

## Task 4: Service restart és manuális teszt

- [ ] **Step 1: Restart**

```bash
ssh ai-agency 'sudo systemctl restart marquee && sleep 2 && sudo systemctl is-active marquee'
```

Várt: `active`

- [ ] **Step 2: Böngészős teszt — accordion**

1. Nyisd meg `http://marquee.lab2.home.arpa`
2. Menj a Kampányok oldalra
3. Kattints a "Piaci belépés" kampányra — kinyílik az accordion, látod a tervet és a 12 calendar itemet
4. Kattints ismét — bezárul
5. Nincs "Generate brief" gomb a calendar itemeknél
6. A Workshop chat elérhető, nincs "Tervezési chat" tab sehol

- [ ] **Step 3: Commit (ha minden rendben)**

```bash
cd /opt/marquee && git add -A && git status
# Csak akkor commitolj ha van nem commitolt változás
```

---

## Task 5: Skills frissítés

**Files:**
- Modify: `packages/server/seed/skills/director/kampany_tervezes.md`
- Modify: `packages/server/seed/skills/director/terv_kontextusu_brief.md`
- Modify: `/home/balazs/.marquee/skills/director/kampany_tervezes.md` (élő adat)
- Modify: `/home/balazs/.marquee/skills/director/terv_kontextusu_brief.md` (élő adat)

- [ ] **Step 1: `kampany_tervezes.md` frissítése — seed**

A `packages/server/seed/skills/director/kampany_tervezes.md` fájl első sorát változtasd:

```markdown
Aktivald ezt a skillt, ha a thread kampanyhoz kotott (`campaign_id`), es az operator kampanytervezest ker.
```

Erre:
```markdown
Aktivald ezt a skillt, ha az operator kampanytervezest ker, vagy egy konkret kampany nevet emliti es tervet szeretne. A kampany kontextusat a `get_campaign_status` es `get_campaign_plan` eszkozokkel szerzed meg — nem szukseges kampany-kotott thread.
```

- [ ] **Step 2: `kampany_tervezes.md` frissítése — élő adat**

Ugyanazt a módosítást alkalmazd `/home/balazs/.marquee/skills/director/kampany_tervezes.md`-re.

```bash
ssh ai-agency "sed -i 's/Aktivald ezt a skillt, ha a thread kampanyhoz kotott (\`campaign_id\`), es az operator kampanytervezest ker./Aktivald ezt a skillt, ha az operator kampanytervezest ker, vagy egy konkret kampany nevet emliti es tervet szeretne. A kampany kontextusat a \`get_campaign_status\` es \`get_campaign_plan\` eszkozokkel szerzed meg — nem szukseges kampany-kotott thread./' /home/balazs/.marquee/skills/director/kampany_tervezes.md"
```

- [ ] **Step 3: `terv_kontextusu_brief.md` teljes csere — seed**

A `packages/server/seed/skills/director/terv_kontextusu_brief.md` teljes tartalmát cseréld erre:

```markdown
---
name: terv_kontextusu_brief
description: Kampanytervbol brief szarmaztatas — Director proaktivan ajanlya briefet amikor calendar itemeket targyalnak
---

Aktivald ezt a skillt, ha az operator egy kampany calendar itemeirol beszel, es brief szarmaztatas logikusnak tunik.

## Folyamat

1. Hivd a `get_campaign_plan` toolt az aktualis kampany id-javal.
2. Azonositsd melyik calendar item(ek)hez kapcsolodik a beszelgetes (channel, intent, target_date alapjan).
3. Ha van egyertelmu egyezes: javasold a brief letrehozasat az adott itemhez.
   - Jelezd az operatornak: "Ezt a posztot a tervbol szarmaztatnam — calendar item: [intent], [datum]."
   - Kerd jovat (igennel folytat, nemmel ad-hoc brief lesz).
4. Javasolt esetben hivd a `propose_brief` toolt a `calendar_item_id` mezoval kitoltve.

## Szabalyok

- Ne hivj propose_brief-et explicit operator jovahagyas nelkul.
- Ha tobb calendar item is illene, kerdezz vissza melyikre gondolt.
- Ad-hoc brief (calendar_item_id nelkul) akkor keszul, ha az operator explicit jelzi, vagy nincs megfelelo item a tervben.
```

- [ ] **Step 4: `terv_kontextusu_brief.md` teljes csere — élő adat**

```bash
ssh ai-agency "cat > /home/balazs/.marquee/skills/director/terv_kontextusu_brief.md << 'SKILLEOF'
---
name: terv_kontextusu_brief
description: Kampanytervbol brief szarmaztatas — Director proaktivan ajanlya briefet amikor calendar itemeket targyalnak
---

Aktivald ezt a skillt, ha az operator egy kampany calendar itemeirol beszel, es brief szarmaztatas logikusnak tunik.

## Folyamat

1. Hivd a \`get_campaign_plan\` toolt az aktualis kampany id-javal.
2. Azonositsd melyik calendar item(ek)hez kapcsolodik a beszelgetes (channel, intent, target_date alapjan).
3. Ha van egyertelmu egyezes: javasold a brief letrehozasat az adott itemhez.
   - Jelezd az operatornak: \"Ezt a posztot a tervbol szarmaztatnam — calendar item: [intent], [datum].\"
   - Kerd jovat (igennel folytat, nemmel ad-hoc brief lesz).
4. Javasolt esetben hivd a \`propose_brief\` toolt a \`calendar_item_id\` mezoval kitoltve.

## Szabalyok

- Ne hivj propose_brief-et explicit operator jovahagyas nelkul.
- Ha tobb calendar item is illene, kerdezz vissza melyikre gondolt.
- Ad-hoc brief (calendar_item_id nelkul) akkor keszul, ha az operator explicit jelzi, vagy nincs megfelelo item a tervben.
SKILLEOF"
```

- [ ] **Step 5: Service restart (skills azonnal érvényes)**

```bash
ssh ai-agency 'sudo systemctl restart marquee && sleep 2 && sudo systemctl is-active marquee'
```

- [ ] **Step 6: Commit**

```bash
cd /opt/marquee
git add packages/server/seed/skills/director/kampany_tervezes.md \
        packages/server/seed/skills/director/terv_kontextusu_brief.md
git commit -m "feat(campaign): update director skills — workshop-aware campaign planning"
```

---

## Végső ellenőrzőlista

- [ ] `npx tsc --noEmit` zöld mindkét package-ben
- [ ] `npx vitest run` 245+ teszt PASS
- [ ] Kampányok oldalon accordion működik
- [ ] Nincs "Tervezési chat" tab / "Generate brief" gomb
- [ ] Workshop chatből Director tud kampánykontextust lekérni (`get_campaign_status` visszaad ID-t)
