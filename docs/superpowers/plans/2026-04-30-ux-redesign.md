# UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teljes frontend redesign — Split Tone Ops vizuális irány (sötét sidebar + meleg krém canvas), Amber primary, Inter-only tipográfia, új HQ home képernyő, Jóváhagyások split-panel, Memória render/edit toggle, Kampányok kattintható deliverable sorok.

**Architecture:** CSS custom properties frissítése viszi a legtöbb token-változást minimális komponens-módosítással. Új `Sidebar.tsx` váltja a `TopNav.tsx`-et; az `App.tsx` átáll sidebar-alapú layoutra. A `Approvals.tsx` split-panes layoutba olvasztja a `DeliverableDetail`-t, és URL param-alapon pre-selektál.

**Tech Stack:** React 19, Tailwind 3 (CSS variables via `index.css`), react-router-dom 7, react-markdown + remark-breaks (már telepítve), Zustand store (`useMarqueeStore`).

**Spec:** `docs/superpowers/specs/2026-04-30-marquee-ux-redesign-design.md`

---

## File map

| Fájl | Változás |
|---|---|
| `packages/web/index.html` | Google Fonts — Source Serif 4 eltávolítása |
| `packages/web/src/index.css` | CSS változók teljes csere; sidebar tokenek; `.bulb` animáció; `body` háttér |
| `packages/web/tailwind.config.js` | Sidebar színek hozzáadása |
| `packages/web/src/components/Sidebar.tsx` | **ÚJ** — bal sidebar, nav, agent-status |
| `packages/web/src/components/TopNav.tsx` | **TÖRÖL** |
| `packages/web/src/App.tsx` | Sidebar layout; HQ route; TopNav eltávolítása |
| `packages/web/src/views/HQ.tsx` | **ÚJ** — home képernyő |
| `packages/web/src/lib/api.ts` | `dashboardApi` hozzáadása |
| `packages/web/src/components/StatusBadge.tsx` | Új token osztályok |
| `packages/web/src/components/BulbIndicator.tsx` | Amber tokenek |
| `packages/web/src/components/ChatComposer.tsx` | Lebegő, kerekített, Amber Küldés gomb |
| `packages/web/src/views/Workshop.tsx` | Layout refactor, floating composer |
| `packages/web/src/views/Approvals.tsx` | Split lista+detail panel, URL param pre-select; DeliverableDetail tartalom inline |
| `packages/web/src/views/DeliverableDetail.tsx` | **TÖRÖL** — tartalom beolvad Approvals-ba |
| `packages/web/src/views/Memory.tsx` | Render/edit toggle, frontmatter metaadat-sáv |
| `packages/web/src/views/Campaigns.tsx` | Kattintható deliverable sorok, navigáció |
| `packages/web/src/components/BriefProposalCard.tsx` | Amber tokenek, accent bar |
| `packages/web/src/components/MemoryProposalCard.tsx` | Token frissítés |
| `packages/web/src/components/BrandVoiceReviewPanel.tsx` | Token frissítés |
| `packages/web/src/components/SendBackModal.tsx` | Token frissítés |

---

## Task 1: CSS tokenek + Google Fonts

**Files:**
- Modify: `packages/web/index.html`
- Modify: `packages/web/src/index.css`

- [ ] **1.1 Source Serif 4 eltávolítása az index.html-ből**

Nyisd meg `packages/web/index.html`. Keresd és töröld a Source Serif 4-et tartalmazó `<link>` sort (Google Fonts import). Ha Inter és JetBrains Mono importok vannak, azok maradnak.

- [ ] **1.2 CSS változók cseréje**

Cseréld le `packages/web/src/index.css` teljes `:root { ... }` blokkját:

```css
:root {
  /* Surface */
  --cream: #FAF7F5;
  --parchment: #F5F2EF;
  --white: #FFFFFF;

  /* Sidebar */
  --sidebar-bg: #1C1917;
  --sidebar-border: #292524;
  --sidebar-active: #292524;
  --sidebar-text: #A8A29E;
  --sidebar-text-muted: #57534E;

  /* Ink */
  --ink-1: #18181B;
  --ink-2: #44403C;
  --ink-3: #78716C;

  /* Rules */
  --rule: #E7E5E4;
  --rule-strong: #D6D3D1;

  /* Primary (Amber) */
  --primary: #F59E0B;
  --primary-hover: #D97706;
  --primary-soft: #FEF3C7;
  --primary-deep: #92400E;

  /* Semantic */
  --success-soft: #DCFCE7;
  --success-deep: #15803D;
  --danger-soft: #FEF2F2;
  --danger-deep: #B91C1C;
  --warning-deep: #92400E;

  /* Bulb (Amber) */
  --bulb: #F59E0B;
  --bulb-glow: rgba(245, 158, 11, 0.55);

  /* Typography — Inter only */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;

  /* Border radius */
  --r-card: 10px;
  --r-btn: 6px;
  --r-chip: 9999px;

  /* Shadows */
  --shadow-composer: 0 4px 24px rgba(28, 25, 23, 0.10), 0 1px 4px rgba(28, 25, 23, 0.06);
  --shadow-card: 0 1px 3px rgba(28, 25, 23, 0.06);
}
```

- [ ] **1.3 body háttér frissítése**

Cseréld le a `body { ... }` blokkot (töröld a radial-gradient-et):

```css
body {
  background-color: var(--cream);
  color: var(--ink-1);
  font-family: var(--font-sans);
}
```

- [ ] **1.4 `.bulb` animáció frissítése**

```css
@keyframes bulb-pulse {
  0%, 100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.4); }
  50%       { box-shadow: 0 0 10px rgba(245, 158, 11, 0.8); }
}

.bulb {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--bulb);
  box-shadow: 0 0 5px var(--bulb-glow);
  flex: none;
  animation: bulb-pulse 1.5s ease-in-out infinite;
  display: inline-block;
}
.bulb-idle {
  width: 6px; height: 6px; border-radius: 50%;
  background: #44403C;
  flex: none;
  display: inline-block;
}
```

- [ ] **1.5 `.serif` utility osztály eltávolítása**

Az `index.css`-ből töröld a `.serif { font-family: var(--font-serif); }` sort és a `display-lg`, `headline-lg`, `headline-md` szabályokat (ezeket Inter váltja). A `--font-serif` változó is törölhető.

- [ ] **1.6 `.textarea-chat` frissítése**

```css
.textarea-chat {
  width: 100%; padding: 14px 16px;
  background: var(--white); border: none;
  resize: none;
  font: 400 14px/1.5 var(--font-sans); color: var(--ink-1); outline: none;
}
.textarea-chat::placeholder { color: var(--ink-3); }
```

- [ ] **1.7 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

Várható: 0 hiba (csak token csere volt, nem TS változás).

- [ ] **1.8 Commit**

```bash
git add packages/web/index.html packages/web/src/index.css
git commit -m "style: CSS token rendszer csere — Amber primary, Split Tone, Inter-only"
```

---

## Task 2: Tailwind config — sidebar tokenek

**Files:**
- Modify: `packages/web/tailwind.config.js`

- [ ] **2.1 Sidebar színek + font frissítés**

Cseréld le `packages/web/tailwind.config.js` tartalmát:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        parchment: 'var(--parchment)',
        'off-white': 'var(--white)',
        sidebar: {
          bg: 'var(--sidebar-bg)',
          border: 'var(--sidebar-border)',
          active: 'var(--sidebar-active)',
          text: 'var(--sidebar-text)',
          muted: 'var(--sidebar-text-muted)',
        },
        ink: {
          1: 'var(--ink-1)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        rule: {
          DEFAULT: 'var(--rule)',
          strong: 'var(--rule-strong)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          soft: 'var(--primary-soft)',
          deep: 'var(--primary-deep)',
        },
        success: {
          soft: 'var(--success-soft)',
          deep: 'var(--success-deep)',
        },
        danger: {
          soft: 'var(--danger-soft)',
          deep: 'var(--danger-deep)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        composer: 'var(--shadow-composer)',
        card: 'var(--shadow-card)',
      },
      borderRadius: {
        card: 'var(--r-card)',
        btn: 'var(--r-btn)',
        chip: 'var(--r-chip)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
```

- [ ] **2.2 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **2.3 Commit**

```bash
git add packages/web/tailwind.config.js
git commit -m "style: Tailwind config — sidebar tokenek, font-serif eltávolítva"
```

---

## Task 3: Sidebar komponens

**Files:**
- Create: `packages/web/src/components/Sidebar.tsx`

- [ ] **3.1 Sidebar.tsx megírása**

```tsx
import { NavLink } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

const AGENTS = [
  'director', 'copywriter', 'social-manager',
  'paid-specialist', 'email-marketer', 'seo-specialist',
];

export function Sidebar() {
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);
  const activeAgents = useMarqueeStore((s) => s.activeAgents);

  return (
    <aside className="w-[180px] shrink-0 bg-sidebar-bg flex flex-col border-r border-sidebar-border min-h-screen">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-[6px] bg-primary flex items-center justify-center shrink-0">
          <span className="text-[13px] font-black text-sidebar-bg leading-none">M</span>
        </div>
        <span className="text-[15px] font-bold text-white tracking-tight">Marquee</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2.5 flex flex-col gap-0.5">
        <SidebarItem to="/hq" label="HQ" end />
        <SidebarItem to="/" label="Workshop" end />
        <SidebarItem to="/jovahagyas" label="Jóváhagyások" badge={pending > 0 ? pending : undefined} />
        <SidebarItem to="/kampanyok" label="Kampányok" />
        <SidebarItem to="/memoria" label="Memória" />
      </nav>

      {/* Agent status */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <p className="text-[9px] font-semibold text-sidebar-muted tracking-[0.1em] uppercase px-1.5 mb-2">
          Ügynökség
        </p>
        <div className="flex flex-col gap-1">
          {AGENTS.map((role) => (
            <div key={role} className="flex items-center gap-2 px-1.5 py-1">
              {activeAgents.has(role) ? (
                <span className="bulb" />
              ) : (
                <span className="bulb-idle" />
              )}
              <span className="font-mono text-[10px] text-sidebar-muted truncate">
                {role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  to, label, end, badge,
}: {
  to: string; label: string; end?: boolean; badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-2.5 py-2 rounded-[6px] text-[13px] transition-colors ${
          isActive
            ? 'bg-sidebar-active text-primary font-semibold'
            : 'text-sidebar-text hover:bg-sidebar-active'
        }`
      }
    >
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="bg-primary text-sidebar-bg text-[10px] font-bold rounded-chip min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
```

- [ ] **3.2 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **3.3 Commit**

```bash
git add packages/web/src/components/Sidebar.tsx
git commit -m "feat(web): Sidebar komponens — sötét nav, amber logo, agent status"
```

---

## Task 4: App.tsx — sidebar layout + HQ route

**Files:**
- Modify: `packages/web/src/App.tsx`
- Delete: `packages/web/src/components/TopNav.tsx`

- [ ] **4.1 App.tsx átírása**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.js';
import { HQ } from './views/HQ.js';
import { Workshop } from './views/Workshop.js';
import { Approvals } from './views/Approvals.js';
import { Memory } from './views/Memory.js';
import { Campaigns } from './views/Campaigns.js';

export function App() {
  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Routes>
          <Route path="/hq" element={<HQ />} />
          <Route path="/" element={<Workshop />} />
          <Route path="/jovahagyas" element={<Approvals />} />
          <Route path="/jovahagyas/:id" element={<Approvals />} />
          <Route path="/kampanyok" element={<Campaigns />} />
          <Route path="/memoria" element={<Memory />} />
          <Route path="*" element={<Navigate to="/hq" replace />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **4.2 TopNav.tsx törlése**

```bash
rm packages/web/src/components/TopNav.tsx
```

- [ ] **4.3 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

Várható: hibák a `DeliverableDetail` import miatt (azt a következő task-ban rendezzük). Ha `DeliverableDetail` importra panaszkodik, egyelőre add hozzá üres route-ként vagy hagyd el.

- [ ] **4.4 Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/components/TopNav.tsx
git commit -m "feat(web): App sidebar layout — TopNav eltávolítva, HQ route hozzáadva"
```

---

## Task 5: StatusBadge + BulbIndicator tokenek

**Files:**
- Modify: `packages/web/src/components/StatusBadge.tsx`
- Modify: `packages/web/src/components/BulbIndicator.tsx`

- [ ] **5.1 StatusBadge.tsx frissítése**

```tsx
const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  drafting:          { text: 'Folyamatban',      cls: 'bg-primary-soft text-primary-deep' },
  awaiting_eval:     { text: 'Kiértékelés',      cls: 'bg-parchment text-ink-2' },
  awaiting_approval: { text: 'Jóváhagyásra vár', cls: 'bg-primary-soft text-primary-deep' },
  shipped:           { text: 'Lezárva',          cls: 'bg-success-soft text-success-deep' },
  blocked:           { text: 'Blokkolt',         cls: 'bg-danger-soft text-danger-deep' },
  archived:          { text: 'Archív',           cls: 'bg-parchment text-ink-3' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { text: status, cls: 'bg-parchment text-ink-2' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-chip ${s.cls}`}>
      {s.text}
    </span>
  );
}
```

- [ ] **5.2 BulbIndicator.tsx ellenőrzése**

A `.bulb` és `.bulb-idle` CSS osztályok az `index.css`-ben már frissítve vannak (Task 1.4). Nézd meg `packages/web/src/components/BulbIndicator.tsx` tartalmát — ha `className="bulb"` és `className="bulb-idle"` osztályokat használ, nincs változtatás szükséges. Ha más Tailwind osztályokat használ, cseréld le ezekre.

- [ ] **5.3 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **5.4 Commit**

```bash
git add packages/web/src/components/StatusBadge.tsx packages/web/src/components/BulbIndicator.tsx
git commit -m "style(web): StatusBadge + BulbIndicator — Amber tokenek"
```

---

## Task 6: ChatComposer — lebegő, kerekített, Amber gomb

**Files:**
- Modify: `packages/web/src/components/ChatComposer.tsx`

- [ ] **6.1 ChatComposer.tsx olvasása**

Olvasd el a jelenlegi `packages/web/src/components/ChatComposer.tsx`-t hogy megértsd az interface-t (props, onSubmit, stb.).

- [ ] **6.2 ChatComposer refactor**

Tartsd meg az interfészt (props és logika), csak a JSX-et és a stílust cseréld le. A komponens `mx-3 mb-3` marginnal lebeg a chat lista alatt (`position: sticky; bottom: 0` a szülőben kezelendő):

```tsx
// A tényleges props interface-t a jelenlegi fájlból vedd át.
// Az alábbi JSX cseréli a return értéket:
return (
  <div className="mx-4 mb-3 bg-off-white border border-rule rounded-[16px] shadow-composer">
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Írj a Directornak…"
      rows={2}
      className="textarea-chat w-full min-h-[52px] rounded-t-[16px]"
      disabled={disabled}
    />
    <div className="flex items-center justify-end px-3 py-2 border-t border-parchment">
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="bg-primary text-sidebar-bg text-[13px] font-bold px-[18px] py-2 rounded-btn flex items-center gap-1.5 disabled:opacity-40"
      >
        Küldés
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
);
```

- [ ] **6.3 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **6.4 Commit**

```bash
git add packages/web/src/components/ChatComposer.tsx
git commit -m "style(web): ChatComposer — lebegő kártya, Amber Küldés gomb"
```

---

## Task 7: HQ view — új home képernyő

**Files:**
- Create: `packages/web/src/views/HQ.tsx`
- Modify: `packages/web/src/lib/api.ts`

- [ ] **7.1 dashboardApi hozzáadása az api.ts-hez**

Add hozzá az `api.ts` végéhez:

```ts
// -------------------------
// Dashboard
// -------------------------
export const dashboardApi = {
  activity: (): Promise<DeliverableRow[]> =>
    fetch('/api/deliverables').then(json),
};
```

- [ ] **7.2 HQ.tsx megírása**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { dashboardApi, type DeliverableRow } from '../lib/api.js';

const AGENTS = [
  'director', 'copywriter', 'social-manager',
  'paid-specialist', 'email-marketer', 'seo-specialist',
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

function activityBulb(status: string) {
  if (status === 'shipped') return 'w-1.5 h-1.5 rounded-full bg-success-deep flex-shrink-0 mt-1';
  if (status === 'awaiting_approval') return 'bulb flex-shrink-0 mt-1';
  return 'w-1.5 h-1.5 rounded-full bg-rule-strong flex-shrink-0 mt-1';
}

function activityLabel(d: DeliverableRow) {
  if (d.status === 'shipped') return `Kiszállítva`;
  if (d.status === 'awaiting_approval') return `Elkészült — jóváhagyásra vár`;
  if (d.status === 'drafting') return `Folyamatban`;
  return d.status;
}

export function HQ() {
  const navigate = useNavigate();
  const activeAgents = useMarqueeStore((s) => s.activeAgents);
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);
  const deliverables = useMarqueeStore((s) => s.deliverables);
  const fetchDeliverables = useMarqueeStore((s) => s.fetchDeliverables);

  const [activity, setActivity] = useState<DeliverableRow[]>([]);

  useEffect(() => {
    fetchDeliverables('awaiting_approval');
    dashboardApi.activity().then((rows) => {
      const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
      setActivity(sorted);
    });
  }, [fetchDeliverables]);

  const today = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const activeList = AGENTS.filter((r) => activeAgents.has(r));
  const pendingList = deliverables.filter((d) => d.status === 'awaiting_approval').slice(0, 3);

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-cream">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink-1 tracking-tight">Headquarters</h1>
          <p className="text-[12px] text-ink-3 mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-sidebar-bg text-[12px] font-bold px-3.5 py-2 rounded-btn"
        >
          + Új brief
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 grid grid-cols-2 gap-4 content-start">

        {/* Bal — Most */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase">Most</p>

          {/* Aktív agent panel */}
          <div className="bg-sidebar-bg rounded-card p-4 flex flex-col gap-2.5">
            <p className="text-[9px] font-semibold text-sidebar-muted tracking-[0.08em] uppercase">Aktív agent</p>
            {activeList.length === 0 ? (
              <p className="text-[12px] text-sidebar-muted">Jelenleg nincs aktív agent.</p>
            ) : (
              activeList.map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <span className="bulb" />
                  <span className="font-mono text-[13px] text-white font-medium">{role}</span>
                  <span className="ml-auto text-[11px] text-sidebar-muted">dolgozik…</span>
                </div>
              ))
            )}
          </div>

          {/* Jóváhagyás alert */}
          {pending > 0 ? (
            <div className="bg-off-white border-[1.5px] border-primary rounded-card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-primary-deep tracking-[0.06em] uppercase">Jóváhagyásra vár</p>
                <span className="bg-primary text-sidebar-bg text-[10px] font-extrabold rounded-chip w-[22px] h-[22px] flex items-center justify-center">
                  {pending}
                </span>
              </div>
              {pendingList.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-cream px-2 py-1.5 rounded-[6px] cursor-pointer hover:bg-parchment"
                  onClick={() => navigate(`/jovahagyas/${d.id}`)}
                >
                  <span className="text-[12px] text-ink-1 truncate">{d.type}</span>
                  <span className="text-[10px] text-ink-3 shrink-0 ml-2">{d.delegationId?.slice(0, 8) ?? ''}</span>
                </div>
              ))}
              <button
                onClick={() => navigate('/jovahagyas')}
                className="mt-1 w-full bg-sidebar-bg text-primary text-[12px] font-bold py-2 rounded-[6px]"
              >
                Jóváhagyások megtekintése →
              </button>
            </div>
          ) : (
            <div className="bg-off-white border border-rule rounded-card p-4">
              <p className="text-[12px] text-ink-3">Nincs függő jóváhagyás.</p>
            </div>
          )}
        </div>

        {/* Jobb — Ma történt */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase">Ma történt</p>
          <div className="bg-off-white border border-rule rounded-card overflow-hidden">
            {activity.length === 0 ? (
              <p className="p-4 text-[12px] text-ink-3">Még nincs esemény ma.</p>
            ) : (
              activity.map((d, i) => (
                <div
                  key={d.id}
                  className={`flex items-start gap-2.5 px-3.5 py-3 cursor-pointer hover:bg-cream ${
                    i < activity.length - 1 ? 'border-b border-rule' : ''
                  }`}
                  onClick={() => navigate(`/jovahagyas/${d.id}`)}
                >
                  <span className={activityBulb(d.status)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-ink-1 truncate">{activityLabel(d)}</p>
                    <p className="text-[11px] text-ink-3 mt-0.5">{d.type}</p>
                  </div>
                  <span className="text-[10px] text-ink-3 shrink-0">{formatTime(d.updatedAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
```

- [ ] **7.3 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **7.4 Commit**

```bash
git add packages/web/src/views/HQ.tsx packages/web/src/lib/api.ts
git commit -m "feat(web): HQ home képernyő — agent panel, jóváhagyás alert, aktivitás feed"
```

---

## Task 8: Workshop view — lebegő composer, layout

**Files:**
- Modify: `packages/web/src/views/Workshop.tsx`

- [ ] **8.1 Workshop.tsx olvasása**

Olvasd el a teljes `packages/web/src/views/Workshop.tsx`-t hogy megértsd a jelenlegi struktúrát.

- [ ] **8.2 Topbar hozzáadása, chat area sticky composer**

Az alábbi struktúrális változások szükségesek — a belső logika (SSE, sendMessage, stb.) érintetlen marad:

A fő `return` wrapper cseréje:

```tsx
return (
  <div className="flex flex-1 h-screen overflow-hidden">
    {/* Thread sidebar */}
    <div className="w-[200px] shrink-0 bg-parchment border-r border-rule flex flex-col">
      <div className="px-3 py-3.5 border-b border-rule flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink-2">Beszélgetések</span>
        <button onClick={() => void createThread()} className="text-ink-3 hover:text-ink-1 text-xl leading-none">+</button>
      </div>
      <div className="flex-1 overflow-auto">
        <ThreadList
          threads={threads}
          activeId={threadId}
          onSelect={(id) => void selectThread(id)}
          onArchive={(id) => void archiveThread(id)}
          onRename={(id, t) => void renameThread(id, t)}
        />
      </div>
    </div>

    {/* Chat area */}
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Chat header — az activeAgents store state-ből jön, isThinking-et az 
          activeAgents.has('director') váltja ki, vagy a jelenlegi workshop flag neve */}
      <div className="px-4 py-3.5 border-b border-rule bg-cream flex items-center gap-2">
        <span className="text-[14px] font-bold text-ink-1">
          {threads.find((t) => t.id === threadId)?.title ?? 'Új beszélgetés'}
        </span>
        {activeAgents.has('director') && <span className="bulb ml-1" />}
      </div>

      {/* Messages — scroll-ozható, padding-bottom a composernek */}
      <div className="flex-1 overflow-auto px-4 py-4 pb-24 flex flex-col gap-3">
        <ChatThread messages={messages} proposedBriefs={proposedBriefs} />
      </div>

      {/* Sticky composer */}
      <div className="sticky bottom-0 pb-3 bg-gradient-to-t from-cream via-cream to-transparent pt-2">
        <ChatComposer onSubmit={handleSend} disabled={isThinking} />
      </div>
    </div>
  </div>
);
```

- [ ] **8.3 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **8.4 Vizuális ellenőrzés**

```bash
DATA_DIR=~/.marquee-dev npm run dev
```

Nyisd meg `http://localhost:5173` — ellenőrizd: sötét sidebar, Workshop layout, lebegő composer.

- [ ] **8.5 Commit**

```bash
git add packages/web/src/views/Workshop.tsx
git commit -m "style(web): Workshop — sticky lebegő composer, thread sidebar"
```

---

## Task 9: Approvals — split lista + detail panel

**Files:**
- Modify: `packages/web/src/views/Approvals.tsx`
- Delete: `packages/web/src/views/DeliverableDetail.tsx`

- [ ] **9.1 Approvals.tsx olvasása**

Olvasd el a teljes `packages/web/src/views/Approvals.tsx`-t és `packages/web/src/views/DeliverableDetail.tsx`-t.

- [ ] **9.2 Approvals.tsx átírása split-panel layoutra**

A DeliverableDetail teljes tartalmát (revision tabs, approve/return/discard logika, BrandVoiceReviewPanel, stb.) beolvasztja az Approvals jobb paneljébe. Az URL param (`/jovahagyas/:id`) alapján pre-selektál.

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { deliverablesApi, type DeliverableRow, type DeliverableDetail } from '../lib/api.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { RevisionTabs } from '../components/RevisionTabs.js';
import { DeliverableActions } from '../components/DeliverableActions.js';
import { BrandVoiceReviewPanel } from '../components/BrandVoiceReviewPanel.js';
import { MarkdownView } from '../components/MarkdownView.js';
import { SendBackModal } from '../components/SendBackModal.js';

export function Approvals() {
  const { id: urlId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const deliverables = useMarqueeStore((s) => s.deliverables);
  const fetchDeliverables = useMarqueeStore((s) => s.fetchDeliverables);
  const approveDeliverable = useMarqueeStore((s) => s.approveDeliverable);

  const [selectedId, setSelectedId] = useState<string | null>(urlId ?? null);
  const [detail, setDetail] = useState<DeliverableDetail | null>(null);
  const [allDeliverables, setAllDeliverables] = useState<DeliverableRow[]>([]);
  const [showSendBack, setShowSendBack] = useState(false);

  // Load all deliverables for list (pending + today shipped)
  useEffect(() => {
    fetchDeliverables('awaiting_approval');
    deliverablesApi.list().then((rows) => {
      const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
      setAllDeliverables(sorted);
    });
  }, [fetchDeliverables]);

  // Sync URL param → selectedId
  useEffect(() => {
    if (urlId) setSelectedId(urlId);
  }, [urlId]);

  // Load detail when selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    deliverablesApi.get(selectedId).then(setDetail);
  }, [selectedId]);

  function selectItem(id: string) {
    setSelectedId(id);
    navigate(`/jovahagyas/${id}`, { replace: true });
  }

  const pending = allDeliverables.filter((d) => d.status === 'awaiting_approval');
  const shipped = allDeliverables.filter((d) => d.status === 'shipped');
  const pendingCount = pending.length;
  const shippedToday = shipped.filter((d) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d.updatedAt >= today.getTime();
  });

  const canAct = detail?.deliverable.status === 'awaiting_approval';

  return (
    <div className="flex flex-1 h-screen overflow-hidden">

      {/* Lista panel */}
      <div className="w-[260px] shrink-0 border-r border-rule flex flex-col bg-cream">
        <div className="px-4 py-4 border-b border-rule">
          <h1 className="text-[16px] font-extrabold text-ink-1 tracking-tight">Jóváhagyások</h1>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {pendingCount} vár · {shippedToday.length} ma kiszállítva
          </p>
        </div>

        <div className="flex-1 overflow-auto">
          {pending.map((d) => (
            <DeliverableListItem
              key={d.id}
              d={d}
              isActive={d.id === selectedId}
              onClick={() => selectItem(d.id)}
            />
          ))}

          {shippedToday.length > 0 && (
            <>
              <div className="px-4 py-2 bg-parchment border-y border-rule">
                <span className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase">Ma kiszállítva</span>
              </div>
              {shippedToday.map((d) => (
                <DeliverableListItem
                  key={d.id}
                  d={d}
                  isActive={d.id === selectedId}
                  onClick={() => selectItem(d.id)}
                  dim
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {detail ? (
          <>
            <div className="px-5 py-4 border-b border-rule flex items-start justify-between gap-3 bg-cream">
              <div>
                <p className="text-[15px] font-bold text-ink-1">
                  {detail.deliverable.type} — {detail.deliverable.id.slice(0, 8)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={detail.deliverable.status} />
                  <span className="text-[11px] text-ink-3 font-mono">
                    {new Date(detail.deliverable.updatedAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              {canAct && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setShowSendBack(true)}
                    className="btn btn-secondary btn-sm"
                  >
                    Visszaküld
                  </button>
                  <button
                    onClick={() => void deliverablesApi.discard(detail.deliverable.id).then(() => fetchDeliverables('awaiting_approval'))}
                    className="btn btn-secondary btn-sm text-ink-3"
                  >
                    Eldob
                  </button>
                  <button
                    onClick={() => void approveDeliverable(detail.deliverable.id)}
                    className="btn btn-primary btn-sm"
                  >
                    ✓ Jóváhagy
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-5">
              <RevisionTabs
                revisions={detail.revisions as Parameters<typeof RevisionTabs>[0]['revisions']}
                deliverableId={detail.deliverable.id}
              />
              <BrandVoiceReviewPanel deliverableId={detail.deliverable.id} />
            </div>

            {showSendBack && (
              <SendBackModal
                deliverableId={detail.deliverable.id}
                onClose={() => setShowSendBack(false)}
                onSent={() => {
                  setShowSendBack(false);
                  void fetchDeliverables('awaiting_approval');
                }}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-ink-3">Válassz ki egy elemet a listából.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliverableListItem({
  d, isActive, onClick, dim,
}: {
  d: DeliverableRow; isActive: boolean; onClick: () => void; dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-rule transition-colors ${
        isActive
          ? 'bg-off-white border-l-[3px] border-l-primary'
          : 'border-l-[3px] border-l-transparent hover:bg-parchment'
      } ${dim ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[13px] leading-snug ${isActive ? 'font-semibold text-ink-1' : 'font-medium text-ink-1'}`}>
          {d.type}
        </span>
        <StatusBadge status={d.status} />
      </div>
      <p className="text-[11px] text-ink-3 mt-1">
        {new Date(d.updatedAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </button>
  );
}
```

- [ ] **9.3 DeliverableDetail.tsx törlése**

```bash
rm packages/web/src/views/DeliverableDetail.tsx
```

- [ ] **9.4 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **9.5 Commit**

```bash
git add packages/web/src/views/Approvals.tsx packages/web/src/views/DeliverableDetail.tsx
git commit -m "feat(web): Approvals split-panel — lista+detail egy képernyőn, URL param pre-select"
```

---

## Task 10: Memory view — render/edit toggle

**Files:**
- Modify: `packages/web/src/views/Memory.tsx`

- [ ] **10.1 Memory.tsx átírása**

A backend API már visszaadja `{ frontmatter, body, rawContent }` alakban (az `api.ts`-ben a `memoryApi.get()` ezt adja). A frontmatter `name` és `description` mezőket mutatjuk metaadat-sávként.

```tsx
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { memoryApi } from '../lib/api.js';
import { MemoryFileList } from '../components/MemoryFileList.js';
import { MemoryProposalCard } from '../components/MemoryProposalCard.js';

const SLUG = 'default';

interface ProposalShape {
  id: string;
  file: string;
  newContent: string;
  reason: string | null;
  createdAt: number;
}

interface FileMeta {
  frontmatter: Record<string, string>;
  body: string;
  rawContent: string;
}

export function Memory() {
  const [fileFlags, setFileFlags] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState('profile.md');
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [proposals, setProposals] = useState<ProposalShape[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadAll = async () => {
    const [files, props] = await Promise.all([
      memoryApi.files(SLUG),
      memoryApi.proposals(SLUG),
    ]);
    const flags: Record<string, boolean> = {};
    for (const f of files) flags[f.file] = f.exists;
    setFileFlags(flags);
    setProposals(props as ProposalShape[]);
  };

  const loadFile = async (file: string) => {
    try {
      const r = await memoryApi.get(SLUG, file);
      setFileMeta({
        frontmatter: (r?.frontmatter as Record<string, string>) ?? {},
        body: r?.body ?? '',
        rawContent: r?.rawContent ?? '',
      });
    } catch {
      setFileMeta({ frontmatter: {}, body: '', rawContent: '' });
    }
    setEditMode(false);
    setSaveError(null);
  };

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => { void loadFile(selected); }, [selected]);

  const handleEdit = () => {
    setEditValue(fileMeta?.rawContent ?? '');
    setEditMode(true);
    setSaveError(null);
  };

  const handleCancel = () => {
    setEditMode(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    const r = await memoryApi.put(SLUG, selected, editValue) as { ok?: true; error?: string };
    if (r?.ok) {
      await loadFile(selected);
      await loadAll();
    } else {
      setSaveError(r?.error ?? 'Mentés sikertelen.');
    }
  };

  const handleApprove = async (id: string) => {
    await memoryApi.approveProposal(id);
    await loadAll();
    await loadFile(selected);
  };

  const handleReject = async (id: string) => {
    await memoryApi.rejectProposal(id);
    await loadAll();
  };

  const fm = fileMeta?.frontmatter ?? {};

  return (
    <div className="flex flex-1 h-screen overflow-hidden">

      {/* Fájllista */}
      <div className="w-[220px] shrink-0 bg-parchment border-r border-rule flex flex-col">
        <div className="px-3.5 py-4 border-b border-rule">
          <h1 className="text-[16px] font-extrabold text-ink-1 tracking-tight">Memória</h1>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {Object.keys(fileFlags).length} fájl
            {proposals.length > 0 ? ` · ${proposals.length} javaslat` : ''}
          </p>
        </div>

        {proposals.length > 0 && (
          <div className="mx-2 mt-2">
            <button className="w-full flex items-center gap-2 bg-primary-soft border border-primary rounded-[6px] px-2.5 py-1.5 text-[11px] font-semibold text-primary-deep">
              <span className="bulb" />
              {proposals.length} függő javaslat
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-2">
          <MemoryFileList fileFlags={fileFlags} selected={selected} onSelect={setSelected} />
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-rule bg-cream flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-bold text-ink-1">{selected}</span>
            {fm.description && (
              <span className="text-[11px] text-ink-3">{fm.description}</span>
            )}
          </div>
          {!editMode ? (
            <button onClick={handleEdit} className="btn btn-secondary btn-sm">Szerkesztés</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleCancel} className="btn btn-ghost btn-sm">Mégse</button>
              <button onClick={() => void handleSave()} className="btn btn-primary btn-sm">Mentés</button>
            </div>
          )}
        </div>

        {/* Proposals */}
        {proposals.length > 0 && (
          <div className="px-5 py-4 border-b border-rule">
            <p className="text-[11px] font-semibold text-ink-2 mb-2">Függő javaslatok ({proposals.length})</p>
            {proposals.map((p) => (
              <MemoryProposalCard
                key={p.id}
                proposal={p}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}

        {/* Tartalom */}
        <div className="flex-1 overflow-auto p-5">
          {!editMode ? (
            <div className="bg-off-white border border-rule rounded-card p-5 max-w-2xl">
              {/* Frontmatter metaadat-sáv */}
              {(fm.name || fm.type) && (
                <div className="bg-parchment rounded-[6px] px-3 py-2 mb-4 flex gap-4">
                  {fm.name && (
                    <span className="text-[10px] text-ink-3">
                      <strong className="text-ink-2 font-semibold">Fájl:</strong> {fm.name}
                    </span>
                  )}
                  {fm.type && (
                    <span className="text-[10px] text-ink-3">
                      <strong className="text-ink-2 font-semibold">Típus:</strong> {fm.type}
                    </span>
                  )}
                </div>
              )}
              {/* Renderelt markdown */}
              <div className="prose prose-sm max-w-none text-ink-1">
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                  {fileMeta?.body ?? ''}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-w-2xl">
              {saveError && <p className="text-[12px] text-danger-deep">{saveError}</p>}
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-off-white border border-rule-strong rounded-card p-4 font-mono text-[13px] text-ink-1 outline-none resize-none min-h-[400px]"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **10.2 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **10.3 Commit**

```bash
git add packages/web/src/views/Memory.tsx
git commit -m "feat(web): Memory view — renderelt mód + szerkesztés toggle, frontmatter metaadat-sáv"
```

---

## Task 11: Campaigns — kattintható deliverable sorok

**Files:**
- Modify: `packages/web/src/views/Campaigns.tsx`

- [ ] **11.1 Kattintható sorok + navigáció**

A `selected.deliverables.map(...)` blokkban cseréld le a statikus `<div>`-et kattintható gombra:

```tsx
// Importok tetején add hozzá:
import { useNavigate } from 'react-router-dom';

// A komponens elejére:
const navigate = useNavigate();

// A deliverable sor JSX-et cseréld le:
{selected.deliverables.map((d) => (
  <button
    key={d.id}
    onClick={() => navigate(`/jovahagyas/${d.id}`)}
    className="w-full text-left border border-rule rounded-[8px] px-3.5 py-3 bg-off-white hover:border-rule-strong hover:bg-parchment flex items-center justify-between transition-colors cursor-pointer"
  >
    <div className="flex items-center gap-2.5">
      <span className="bg-parchment text-ink-2 text-[10px] font-semibold px-2 py-0.5 rounded-chip">
        {TYPE_LABEL[d.type] ?? d.type}
      </span>
      <span className="text-[13px] text-ink-1">
        {new Date(d.updatedAt).toLocaleDateString('hu-HU')}
      </span>
    </div>
    <span className="text-[11px] text-ink-2">{DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}</span>
  </button>
))}
```

A kampánylista kártyákon a `border-primary-hover bg-primary-soft` → `border-primary bg-primary-soft` (token csere):

```tsx
selected?.id === c.id
  ? 'border-primary bg-primary-soft border-l-[3px] border-l-primary'
  : 'border-rule bg-off-white hover:bg-parchment border-l-[3px] border-l-transparent'
```

A kampány részlet fejlécben a `font-serif` osztályt töröld:

```tsx
<h2 className="text-[18px] font-bold text-ink-1 tracking-tight">{selected.title}</h2>
```

- [ ] **11.2 Ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
```

- [ ] **11.3 Commit**

```bash
git add packages/web/src/views/Campaigns.tsx
git commit -m "feat(web): Campaigns — kattintható deliverable sorok, navigáció Approvals-ba"
```

---

## Task 12: BriefProposalCard + maradék komponensek

**Files:**
- Modify: `packages/web/src/components/BriefProposalCard.tsx`
- Modify: `packages/web/src/components/MemoryProposalCard.tsx`
- Modify: `packages/web/src/components/BrandVoiceReviewPanel.tsx`
- Modify: `packages/web/src/components/SendBackModal.tsx`

- [ ] **12.1 BriefProposalCard — amber border, accent bar**

Olvasd el a jelenlegi fájlt. A fő változások:
- A kártya border: `border-[1.5px] border-primary` (volt: `border-primary-hover` vagy hasonló)
- Cseréld a "BRIEF JAVASLAT" label elé egy amber accent bar-t: `<div className="w-1 h-3.5 bg-primary rounded-sm mr-1.5 inline-block" />`
- "Jóváhagy & indít" gomb: `className="btn btn-primary"`
- "Szerkeszt" gomb: `className="btn btn-secondary"`
- "Eldob" gomb: `className="btn btn-ghost"`
- Ha `font-serif` osztály bárhol van, töröld

- [ ] **12.2 MemoryProposalCard — token frissítés**

Olvasd el a fájlt. Töröld a `font-serif` osztályokat, cseréld `bg-parchment`-re az `bg-cream`/`bg-off-white` variánsokat ahol nem stimmel.

- [ ] **12.3 BrandVoiceReviewPanel — font-serif eltávolítása**

Olvasd el a fájlt. Töröld a `font-serif` osztályokat. Cseréld az `bg-cream text-ink-2` badge variánsokat az új token nevekre ahol szükséges.

- [ ] **12.4 SendBackModal — font-serif eltávolítása**

Olvasd el a fájlt. Töröld a `font-serif` osztályokat.

- [ ] **12.5 TypeBadge és DeliverableRow komponensek**

Olvasd el `TypeBadge.tsx` és `DeliverableRow.tsx`. Ha `font-serif` van bennük, töröld. Ha régi token neveket (`text-ink-2`, `bg-cream`, `border-rule`) használnak — ezek változatlanok maradnak, mert a CSS variables frissültek.

- [ ] **12.6 Teljes TypeScript ellenőrzés**

```bash
cd packages/web && npx tsc --noEmit
cd packages/server && npx tsc --noEmit
```

Mindkét helyen 0 hiba várható.

- [ ] **12.7 Commit**

```bash
git add packages/web/src/components/
git commit -m "style(web): komponens token frissítések — font-serif eltávolítva, Amber primary"
```

---

## Task 13: Vizuális smoke test + deploy

**Files:** —

- [ ] **13.1 Dev szerver indítása**

```bash
DATA_DIR=~/.marquee-dev npm run dev
```

- [ ] **13.2 Ellenőrző checklist böngészőben**

`http://localhost:5173/hq` — HQ megnyílik, sötét sidebar látható, amber logo, nav itemek
`http://localhost:5173/` — Workshop, thread sidebar, lebegő composer látható
`http://localhost:5173/jovahagyas` — Approvals split panel, lista + detail
`http://localhost:5173/memoria` — Memory, fájllista, renderelt mód
`http://localhost:5173/kampanyok` — Kampányok, deliverable sorok kattinthatók

- [ ] **13.3 Szervertesztek futtatása**

```bash
cd packages/server && npx vitest run
```

Várható: összes korábbi teszt pass (a backend nem változott).

- [ ] **13.4 Build**

```bash
npm run build --workspaces
```

Várható: 0 hiba, `packages/web/dist/` feltöltve.

- [ ] **13.5 Deploy (opcionális)**

```bash
bash scripts/deploy.sh
```

- [ ] **13.6 Záró commit**

```bash
git add -A
git commit -m "chore: UX redesign teljes — Split Tone Ops, HQ screen, Amber primary"
```
