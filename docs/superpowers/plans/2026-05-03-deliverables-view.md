# Deliverables View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Új `/deliverables` oldal a Marquee-ban: szűrhető táblázat az összes deliverable áttekintéséhez típus, kampány, időszak és státusz szerint.

**Architecture:** Tisztán frontend változás — nincs új backend endpoint. A meglévő `GET /api/deliverables` (status param nélkül) visszaadja az összes deliverables-t, a `GET /api/campaigns` adja a kampánynév-mapot. Minden szűrés kliens oldalon történik lokális state-tel. Sorra kattintva a meglévő `/jovahagyas/:id` részletnézetre navigál.

**Tech Stack:** React 19, TypeScript, react-router-dom v7, Tailwind 3, meglévő komponensek (TypeBadge, StatusBadge, EmptyState)

---

## Fájlszerkezet

| Fájl | Változás |
|---|---|
| `packages/web/src/views/Deliverables.tsx` | Létrehozás — teljes új view |
| `packages/web/src/App.tsx` | Módosítás — új route hozzáadása |
| `packages/web/src/components/Sidebar.tsx` | Módosítás — új nav item |
| `packages/web/src/components/MobileNavMenu.tsx` | Módosítás — új nav item |

---

## Task 1: Route és navigáció bekötése

**Files:**
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/components/Sidebar.tsx`
- Modify: `packages/web/src/components/MobileNavMenu.tsx`

- [ ] **Step 1: Import és route hozzáadása App.tsx-ben**

`packages/web/src/App.tsx` — teljes fájl az új sorral:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.js';
import { MobileNavMenu } from './components/MobileNavMenu.js';
import { HQ } from './views/HQ.js';
import { Workshop } from './views/Workshop.js';
import { Approvals } from './views/Approvals.js';
import { Memory } from './views/Memory.js';
import { Campaigns } from './views/Campaigns.js';
import { Agency } from './views/Agency.js';
import { AgentConfig } from './views/AgentConfig.js';
import { Deliverables } from './views/Deliverables.js';

export function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Routes>
          <Route path="/hq" element={<HQ />} />
          <Route path="/" element={<Workshop />} />
          <Route path="/jovahagyas" element={<Approvals />} />
          <Route path="/jovahagyas/:id" element={<Approvals />} />
          <Route path="/kampanyok" element={<Campaigns />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/deliverables" element={<Deliverables />} />
          <Route path="/memoria" element={<Memory />} />
          <Route path="/ugynokseg" element={<Agency />} />
          <Route path="/ugynokseg/:role" element={<AgentConfig />} />
          <Route path="*" element={<Navigate to="/hq" replace />} />
        </Routes>
      </main>
      <MobileNavMenu />
    </div>
  );
}
```

- [ ] **Step 2: Nav item hozzáadása Sidebar.tsx-ben**

A `<nav>` blokkban a Jóváhagyások sor után:

```tsx
<SidebarItem to="/jovahagyas" label="Jóváhagyások" badge={pending > 0 ? pending : undefined} />
<SidebarItem to="/deliverables" label="Deliverables" />
<SidebarItem to="/kampanyok" label="Kampányok" />
```

- [ ] **Step 3: Nav item hozzáadása MobileNavMenu.tsx-ben**

A `NAV_ITEMS` tömbben a Jóváhagyások sor után:

```tsx
const NAV_ITEMS = [
  { to: '/hq', label: 'HQ', end: true },
  { to: '/', label: 'Workshop', end: true },
  { to: '/jovahagyas', label: 'Jóváhagy' },
  { to: '/deliverables', label: 'Deliverables' },
  { to: '/kampanyok', label: 'Kampányok' },
  { to: '/memoria', label: 'Memória' },
  { to: '/ugynokseg', label: 'Ügynökség' },
];
```

- [ ] **Step 4: Placeholder view létrehozása (hogy a route ne crasheljen)**

`packages/web/src/views/Deliverables.tsx` minimális verzió:

```tsx
export function Deliverables() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-[13px] text-ink-3">Betöltés…</p>
    </div>
  );
}
```

- [ ] **Step 5: TS check és manuális ellenőrzés**

```bash
cd /opt/marquee/packages/web && npx tsc --noEmit
```

Elvárt: 0 hiba. Böngészőben navigálj `/deliverables`-re — a "Betöltés…" szövegnek kell megjelennie, a sidebar "Deliverables" linkje aktívra vált.

- [ ] **Step 6: Commit**

```bash
cd /opt/marquee
git add packages/web/src/App.tsx packages/web/src/components/Sidebar.tsx packages/web/src/components/MobileNavMenu.tsx packages/web/src/views/Deliverables.tsx
git commit -m "feat: add /deliverables route and nav items"
```

---

## Task 2: Adatbetöltés és kampánynév-map

**Files:**
- Modify: `packages/web/src/views/Deliverables.tsx`

Háttér: `GET /api/deliverables` (status param nélkül) visszaadja az összes deliverable-t — `drafting`, `awaiting_approval`, `shipped`, `archived` státuszokat. Az `archived` státusz a "Eldobott" deliverable-eknek felel meg (a discard action `archived`-ra állítja a státuszt). A `GET /api/campaigns` ad `id → title` mapot a kampánynevekhez.

- [ ] **Step 1: Deliverables.tsx — adatbetöltés**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deliverablesApi, campaignsApi, type DeliverableRow, type CampaignRow } from "../lib/api.js";

export function Deliverables() {
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      deliverablesApi.list(),
      campaignsApi.list(),
    ]).then(([dels, camps]) => {
      setRows(Array.isArray(dels) ? dels : []);
      setCampaigns(Array.isArray(camps) ? camps : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const campaignName = (id: string | null): string => {
    if (!id) return "—";
    return campaigns.find((c) => c.id === id)?.title ?? "—";
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-ink-3">Betöltés…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6">
      <h1 className="text-[18px] font-bold text-ink-1 mb-4">Deliverables</h1>
      <p className="text-[12px] text-ink-3">{rows.length} elem betöltve</p>
    </div>
  );
}
```

- [ ] **Step 2: TS check**

```bash
cd /opt/marquee/packages/web && npx tsc --noEmit
```

Elvárt: 0 hiba. Böngészőben `/deliverables` az elemszámot mutatja.

- [ ] **Step 3: Commit**

```bash
cd /opt/marquee
git add packages/web/src/views/Deliverables.tsx
git commit -m "feat: deliverables view data loading"
```

---

## Task 3: Szűrők

**Files:**
- Modify: `packages/web/src/views/Deliverables.tsx`

Státusz mapping: az `archived` státuszú elemeket a UI-ban "Eldobott"-ként kezeljük, mivel a `discard` action `archived`-ra állítja a státuszt.

- [ ] **Step 1: Szűrő state és szűrési logika hozzáadása**

A `Deliverables` function elején, a `navigate` sor után:

```tsx
const DELIVERABLE_TYPES = [
  "social_post", "email", "blog_post", "ad_copy", "content_brief_seo", "seo_report",
] as const;

const TYPE_LABEL: Record<string, string> = {
  social_post: "Social poszt",
  email: "Email",
  blog_post: "Blog poszt",
  ad_copy: "Hirdetés szöveg",
  content_brief_seo: "SEO brief",
  seo_report: "SEO riport",
};

const STATUS_PILLS = [
  { value: "shipped", label: "Lezárva" },
  { value: "awaiting_approval", label: "Jóváhagyásra vár" },
  { value: "archived", label: "Eldobott" },
] as const;

type StatusFilter = "shipped" | "awaiting_approval" | "archived";
```

State deklarációk a `loading` sor után:

```tsx
const [statusFilter, setStatusFilter] = useState<StatusFilter>("shipped");
const [typeFilter, setTypeFilter] = useState<string>("all");
const [campaignFilter, setCampaignFilter] = useState<string>("all");
const [periodFilter, setPeriodFilter] = useState<string>("all");
```

Szűrési logika helper függvény a `campaignName` után:

```tsx
function periodStart(period: string): number {
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    now.setDate(diff);
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  if (period === "month") {
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  return 0;
}

const filtered = rows.filter((d) => {
  if (d.status !== statusFilter) return false;
  if (typeFilter !== "all" && d.type !== typeFilter) return false;
  if (campaignFilter !== "all" && d.campaignId !== campaignFilter) return false;
  if (periodFilter !== "all" && d.updatedAt < periodStart(periodFilter)) return false;
  return true;
});
```

- [ ] **Step 2: Szűrősáv JSX a return-ben**

A `<h1>` sor után, a táblázat előtt:

```tsx
{/* Szűrősáv */}
<div className="flex flex-wrap items-center gap-3 mb-5">
  {/* Státusz pill-gombok */}
  <div className="flex gap-1">
    {STATUS_PILLS.map((p) => (
      <button
        key={p.value}
        onClick={() => setStatusFilter(p.value)}
        className={`text-[12px] font-medium px-3 py-1.5 rounded-chip border transition-colors ${
          statusFilter === p.value
            ? "bg-primary text-sidebar-bg border-primary"
            : "bg-off-white text-ink-2 border-rule hover:bg-parchment"
        }`}
      >
        {p.label}
      </button>
    ))}
  </div>

  {/* Típus dropdown */}
  <select
    value={typeFilter}
    onChange={(e) => setTypeFilter(e.target.value)}
    className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
  >
    <option value="all">Minden típus</option>
    {DELIVERABLE_TYPES.map((t) => (
      <option key={t} value={t}>{TYPE_LABEL[t]}</option>
    ))}
  </select>

  {/* Kampány dropdown */}
  <select
    value={campaignFilter}
    onChange={(e) => setCampaignFilter(e.target.value)}
    className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
  >
    <option value="all">Minden kampány</option>
    {campaigns.map((c) => (
      <option key={c.id} value={c.id}>{c.title}</option>
    ))}
  </select>

  {/* Időszak dropdown */}
  <select
    value={periodFilter}
    onChange={(e) => setPeriodFilter(e.target.value)}
    className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
  >
    <option value="all">Összes időszak</option>
    <option value="today">Ma</option>
    <option value="week">Ez a hét</option>
    <option value="month">Ez a hónap</option>
  </select>

  <span className="text-[11px] text-ink-3 ml-auto">{filtered.length} elem</span>
</div>
```

- [ ] **Step 3: TS check**

```bash
cd /opt/marquee/packages/web && npx tsc --noEmit
```

Elvárt: 0 hiba. Böngészőben a szűrők megjelennek és a pill-gomb ki- és bekapcsol.

- [ ] **Step 4: Commit**

```bash
cd /opt/marquee
git add packages/web/src/views/Deliverables.tsx
git commit -m "feat: deliverables view filter controls"
```

---

## Task 4: Táblázat és üres állapot

**Files:**
- Modify: `packages/web/src/views/Deliverables.tsx`

- [ ] **Step 1: Import-ok kiegészítése a fájl tetején**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deliverablesApi, campaignsApi, type DeliverableRow, type CampaignRow } from "../lib/api.js";
import { TypeBadge } from "../components/TypeBadge.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { EmptyState } from "../components/EmptyState.js";
```

- [ ] **Step 2: Táblázat JSX a szűrősáv után**

A szűrősáv `</div>` után:

```tsx
{filtered.length === 0 ? (
  <EmptyState
    title="Nincs találat"
    body="Próbálj más szűrőkombinációt."
  />
) : (
  <div className="overflow-auto flex-1">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-rule">
          <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2 pr-4">Cím</th>
          <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2 pr-4">Típus</th>
          <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2 pr-4">Kampány</th>
          <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2 pr-4">Státusz</th>
          <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2">Dátum</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((d) => (
          <tr
            key={d.id}
            onClick={() => navigate(`/jovahagyas/${d.id}`)}
            className="border-b border-rule hover:bg-parchment cursor-pointer transition-colors"
          >
            <td className="py-2.5 pr-4 text-[13px] font-medium text-ink-1 max-w-[260px] truncate">
              {d.title ?? d.type}
            </td>
            <td className="py-2.5 pr-4">
              <TypeBadge type={d.type} />
            </td>
            <td className="py-2.5 pr-4 text-[12px] text-ink-2">
              {campaignName(d.campaignId)}
            </td>
            <td className="py-2.5 pr-4">
              <StatusBadge status={d.status} />
            </td>
            <td className="py-2.5 text-[12px] text-ink-3 whitespace-nowrap">
              {new Date(d.updatedAt).toLocaleString("hu-HU", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Step 3: TS check**

```bash
cd /opt/marquee/packages/web && npx tsc --noEmit
```

Elvárt: 0 hiba.

- [ ] **Step 4: Manuális ellenőrzés**

Böngészőben `/deliverables`:
- A táblázat sorai megjelennek a `shipped` default szűrővel
- Kampány dropdown tartalmazza a meglévő kampányokat
- Típus dropdown szűkíti a listát
- Időszak dropdown szűkíti a listát
- Sorra kattintva a `/jovahagyas/:id` oldalra navigál és a deliverable részlete megjelenik
- Ha nincs találat, az EmptyState szöveg jelenik meg

- [ ] **Step 5: Commit**

```bash
cd /opt/marquee
git add packages/web/src/views/Deliverables.tsx
git commit -m "feat: deliverables view table and empty state"
```

---

## Teljes Deliverables.tsx referencia

A 4 task végeztével a fájl teljes tartalma:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deliverablesApi, campaignsApi, type DeliverableRow, type CampaignRow } from "../lib/api.js";
import { TypeBadge } from "../components/TypeBadge.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { EmptyState } from "../components/EmptyState.js";

const DELIVERABLE_TYPES = [
  "social_post", "email", "blog_post", "ad_copy", "content_brief_seo", "seo_report",
] as const;

const TYPE_LABEL: Record<string, string> = {
  social_post: "Social poszt",
  email: "Email",
  blog_post: "Blog poszt",
  ad_copy: "Hirdetés szöveg",
  content_brief_seo: "SEO brief",
  seo_report: "SEO riport",
};

const STATUS_PILLS = [
  { value: "shipped", label: "Lezárva" },
  { value: "awaiting_approval", label: "Jóváhagyásra vár" },
  { value: "archived", label: "Eldobott" },
] as const;

type StatusFilter = "shipped" | "awaiting_approval" | "archived";

function periodStart(period: string): number {
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    now.setDate(diff);
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  if (period === "month") {
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  return 0;
}

export function Deliverables() {
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("shipped");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      deliverablesApi.list(),
      campaignsApi.list(),
    ]).then(([dels, camps]) => {
      setRows(Array.isArray(dels) ? dels : []);
      setCampaigns(Array.isArray(camps) ? camps : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const campaignName = (id: string | null): string => {
    if (!id) return "—";
    return campaigns.find((c) => c.id === id)?.title ?? "—";
  };

  const filtered = rows.filter((d) => {
    if (d.status !== statusFilter) return false;
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (campaignFilter !== "all" && d.campaignId !== campaignFilter) return false;
    if (periodFilter !== "all" && d.updatedAt < periodStart(periodFilter)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-ink-3">Betöltés…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6">
      <h1 className="text-[18px] font-bold text-ink-1 mb-4">Deliverables</h1>

      {/* Szűrősáv */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1">
          {STATUS_PILLS.map((p) => (
            <button
              key={p.value}
              onClick={() => setStatusFilter(p.value)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-chip border transition-colors ${
                statusFilter === p.value
                  ? "bg-primary text-sidebar-bg border-primary"
                  : "bg-off-white text-ink-2 border-rule hover:bg-parchment"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
        >
          <option value="all">Minden típus</option>
          {DELIVERABLE_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>

        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
        >
          <option value="all">Minden kampány</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
        >
          <option value="all">Összes időszak</option>
          <option value="today">Ma</option>
          <option value="week">Ez a hét</option>
          <option value="month">Ez a hónap</option>
        </select>

        <span className="text-[11px] text-ink-3 ml-auto">{filtered.length} elem</span>
      </div>

      {/* Táblázat */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Nincs találat"
          body="Próbálj más szűrőkombinációt."
        />
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-rule">
                <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2 pr-4">Cím</th>
                <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2 pr-4">Típus</th>
                <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2 pr-4">Kampány</th>
                <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2 pr-4">Státusz</th>
                <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide pb-2">Dátum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/jovahagyas/${d.id}`)}
                  className="border-b border-rule hover:bg-parchment cursor-pointer transition-colors"
                >
                  <td className="py-2.5 pr-4 text-[13px] font-medium text-ink-1 max-w-[260px] truncate">
                    {d.title ?? d.type}
                  </td>
                  <td className="py-2.5 pr-4">
                    <TypeBadge type={d.type} />
                  </td>
                  <td className="py-2.5 pr-4 text-[12px] text-ink-2">
                    {campaignName(d.campaignId)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="py-2.5 text-[12px] text-ink-3 whitespace-nowrap">
                    {new Date(d.updatedAt).toLocaleString("hu-HU", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```
