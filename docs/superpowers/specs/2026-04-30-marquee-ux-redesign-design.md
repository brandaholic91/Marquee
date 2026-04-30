# Marquee — UX Redesign Design Spec

**Dátum:** 2026-04-30  
**Státusz:** brainstorm jóváhagyva  
**Típus:** teljes UX + vizuális redesign — design system csere, új HQ képernyő, layout átstrukturálás  
**Felülírja:** `DESIGN.md` (gyökér) — az ottani tokenek és stílus irányelvek helyett ez a dokumentum az irányadó

---

## 1. Design irány

### 1.1 Összefoglalás

A Marquee új esztétikája: **Split Tone Ops** — sötét meleg sidebar az ügynökség gépezetének, meleg krém canvas az olvasható munkaterületnek. Az editorial newsroom irányt (Source Serif 4, Marquee Red, parchment) leváltja egy operatívabb, boldabb megközelítés, amely jobban passzol egy AI marketing ügynökség irányítófelületéhez.

A design két "tér" kontrasztján alapul:
- **Sötét sidebar** (`#1C1917`): az ügynökség állapota — agentjelzők, navigáció, mindig látható kontroll
- **Meleg krém canvas** (`#FAF7F5`): a tartalom tere — deliverable-ek, chat, olvasható munkaterület

Az egyetlen akcent szín az **Amber** (`#F59E0B`): logo, aktív nav item, jóváhagyás gomb, agentjelző bulb, alert border. A piros (`#DC2626`) kizárólag `danger` szemantikai szerepben marad (törlés, hiba).

### 1.2 Referencia hangulat

Warm Ops — meleg sötét sidebar ops-center energiával + bold brand személyiséggel. Nem hideg tech tool, nem editorial újság, hanem egy határozott, koncentrált irányítófelület.

---

## 2. Design tokenek

### 2.1 Színek

| Token | Érték | Szerep |
|---|---|---|
| `primary` | `#F59E0B` | Egyetlen akcent — logo, aktív nav, action gomb, bulb, alert border |
| `primary-dark` | `#D97706` | Hover state primary elemeken |
| `primary-soft` | `#FEF3C7` | Chip/badge háttér amber kontextusban |
| `primary-text-on` | `#92400E` | Szöveg amber soft háttéren (WCAG AA) |
| `sidebar-bg` | `#1C1917` | Bal sidebar háttér |
| `sidebar-border` | `#292524` | Sidebar belső elválasztók |
| `sidebar-active` | `#292524` | Aktív nav item háttér |
| `sidebar-text` | `#A8A29E` | Inaktív nav item szöveg |
| `sidebar-text-muted` | `#57534E` | Agent nevek idle állapotban |
| `canvas-bg` | `#FAF7F5` | Fő canvas háttér |
| `thread-bg` | `#F5F2EF` | Thread sidebar háttér (Workshop) |
| `surface` | `#FFFFFF` | Kártya, composer, detail panel |
| `border` | `#E7E5E4` | Kártyák, elválasztók |
| `border-strong` | `#D6D3D1` | Erősebb határok |
| `text-primary` | `#18181B` | Főszöveg, headlineok |
| `text-secondary` | `#44403C` | Másodlagos tartalom |
| `text-muted` | `#78716C` | Metaadatok, labelek |
| `text-subtle` | `#A8A29E` | Timestamp, placeholder |
| `danger` | `#DC2626` | Törlés, hiba — csak szemantikai |
| `danger-soft` | `#FEF2F2` | Danger háttér |
| `success` | `#22C55E` | Kiszállítva, OK állapot |

### 2.2 Tipográfia

**Egyetlen fontcsalád: Inter.** A Source Serif 4 teljesen kivezetésre kerül.

| Szerepkör | Méret | Súly | Alkalmazás |
|---|---|---|---|
| `display` | 24px | 800 | Oldal főcím (HQ, Workshop) |
| `heading` | 18px | 700 | Kártyafejlécek, panel title |
| `subheading` | 15px | 700 | Deliverable cím, thread cím |
| `body` | 13–14px | 400 | Üzenetek, tartalom |
| `label` | 12–13px | 500–600 | Gombok, badge-ek, nav itemek |
| `caption` | 10–11px | 400–600 | Timestamp, metadata, section label |
| `mono` | 10–13px | 400–500 | JetBrains Mono — agent nevek, technikai értékek |

A section labelek (pl. "MOST", "MA TÖRTÉNT", "ÜGYNÖKSÉG") Inter 600, 9–10px, `letter-spacing: 0.08–0.1em`, `text-muted` színben.

### 2.3 Spacing & shape

Az 8px-es spacing scale megmarad. Rounded corner változások:

| Elem | Radius |
|---|---|
| Gomb, input, nav item | 6px |
| Kártya, detail panel | 10px |
| Composer (floating) | 16px |
| Logo négyzet | 6px |
| Badge, bulb | 9999px (pill) |

### 2.4 Elevation

Egy szint: a **lebegő composer**. `box-shadow: 0 4px 24px rgba(28,25,23,0.10), 0 1px 4px rgba(28,25,23,0.06)`. Más elemeken shadow nincs — háttérszín kontrasztja és border viszi a hierarchiát.

---

## 3. Shell layout

### 3.1 Struktúra

Három sáv desktopон (≥960px):

```
┌─────────────┬────────────────────────────────────────┐
│  Sidebar    │  Main Canvas                           │
│  180px      │  flex-1, max-width 1280px              │
│  #1C1917    │  #FAF7F5                               │
└─────────────┴────────────────────────────────────────┘
```

Mobilon (< 960px): sidebar slide-in overlay, hamburger ikonnal.

**A jobb oldali chat drawer megszűnik.** A régi design 384px-es collapsible drawert tartalmazott amely mindig látható volt. Az új layoutban a chat kizárólag a Workshop nézetben él — a Director interakció egy dedikált nézet, nem egy floating panel. Ez egyszerűsíti a layoutot és megszünteti a canvas/drawer területi konfliktust.

### 3.2 Sidebar felépítése (fentről le)

1. **Logo blokk** (padding: 20px 16px): amber `#F59E0B` 28px × 28px négyzet ("M" betű `#1C1917` 900 weight) + "Marquee" felirat `#FAFAF9` 700 15px. `border-bottom: sidebar-border`.

2. **Navigáció** (padding: 10px 8px, gap: 2px):
   - HQ
   - Workshop
   - Jóváhagyások — amber pill badge a függő számmal (ha > 0)
   - Kampányok
   - Memória
   
   Aktív item: `sidebar-active` háttér, `primary` szöveg, 600 weight. Inaktív: `sidebar-text` szöveg, transparent háttér. Hover: `#292524` háttér.
   
   Nav item padding: 8px 10px, border-radius: 6px.

3. **Ügynökség állapota** (bottom, `border-top: sidebar-border`, padding: 12px 8px):
   - Section label: "ÜGYNÖKSÉG" — 9px, 600, 0.1em tracking, `sidebar-text-muted`
   - Agent sorok: bulb (6px kör) + agent neve monospace 10px
   - Aktív bulb: `primary` (#F59E0B), `box-shadow: 0 0 5px rgba(245,158,11,0.7)`, 1.5s pulse animáció
   - Idle bulb: `#44403C`, no shadow, no animation

---

## 4. HQ képernyő (home)

### 4.1 Topbar

Padding: 16px 24px. Flex row, space-between.
- Bal: "Headquarters" — display (24px, 800, `text-primary`, letter-spacing: -0.02em) + dátum caption (`text-muted`)
- Jobb: "+ Új brief" — primary gomb (amber háttér, `#1C1917` szöveg, 700, 12px, 6px radius, 8px 14px padding)

### 4.2 Kétpaneles tartalom

`display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px 24px`

**Bal panel — "MOST"**

Section label fent. Két kártya egymás alatt:

1. **Aktív agent panel** — `sidebar-bg` (#1C1917) háttér, 10px radius, 16px padding:
   - "AKTÍV AGENT" section label (10px, 600, `sidebar-text-muted`)
   - Agent sor: amber bulb + agent neve monospace `#FAFAF9` + "dolgozik..." jobb oldalon `text-muted`
   - Alatta: brief cím `#A8A29E` 12px, 15px left indent

2. **Jóváhagyás alert** — `surface` háttér, `1.5px solid primary` border, 10px radius, 16px padding:
   - Header: "JÓVÁHAGYÁSRA VÁR" label + amber pill badge (számmal)
   - Deliverable lista: 3 legutóbbi, `canvas-bg` háttér sorok (6px radius, 6px 8px padding), title + agent jobb oldalon
   - CTA gomb: 100% széles, `sidebar-bg` háttér, `primary` szöveg, 700, 8px padding — "Jóváhagyások megtekintése →"
   
   Ha nincs függő jóváhagyás: az alert kártya rejtve, helyette "Nincs függő jóváhagyás" üres állapot.

**Jobb panel — "MA TÖRTÉNT"**

Section label fent. Fehér kártya `border` borderrel, 10px radius. Esemény lista:

Legutóbbi 20 esemény jelenik meg, fordított időrendben. Minden esemény sor: 12px 14px padding, `border-bottom: border`. Három elem:
- Bal: 6px színes bulb (amber = agent aktív/kész, zöld = kiszállítva, `border-strong` = semleges esemény) + flex-1 szöveges tartalom (cím 12px 600 + subtitle 11px `text-muted`)
- Jobb: timestamp 10px `text-subtle`

---

## 5. Workshop nézet

### 5.1 Struktúra

`display: flex; flex: 1` — két belső sáv:

1. **Thread sidebar** — 200px, `thread-bg` (#F5F2EF), `border-right: border`
2. **Chat terület** — flex-1

### 5.2 Thread sidebar

Header: "Beszélgetések" 12px 600 + "+" ikon jobb oldalon. `border-bottom: border`.

Thread item: 10px 12px padding, `border-bottom: border`.
- Aktív: `surface` háttér
- Inaktív: transparent háttér, hover: `surface`
- Cím: 12px 600 `text-primary` → 12px 500 `text-secondary` (inaktív)
- Preview / dátum: 11px `text-muted`

### 5.3 Chat header

Padding: 14px 18px, `border-bottom: border`. Thread cím 14px 700 + director bulb + "director" monospace 11px.

### 5.4 Üzenetek

- **Emberi üzenet** (jobb): `sidebar-bg` (#1C1917) háttér, `#FAFAF9` szöveg, 13px, border-radius: 10px 10px 2px 10px, 10px 14px padding
- **Agent üzenet** (bal): kis avatar négyzet (22px, `#292524`, agent initial) + `surface` kártya `border` borderrel, border-radius: 2px 10px 10px 10px

### 5.5 Brief proposal kártya

Inline az agent üzenet alatt. `surface` háttér, `1.5px solid primary` border, 10px radius, 14px padding, enyhe shadow (`card-elevated`).

- Amber accent bar: 4px × 14px `primary` kör-radius, inline a "BRIEF JAVASLAT" label előtt
- Cím: 13px 700 `text-primary`
- Leírás: 12px `text-muted`, 1.5 line-height
- Chip-ek: `primary-soft` háttér `primary-text-on` szöveg (típus), `#F5F5F4` háttér `text-secondary` szöveg (agent, db)
- Gombok: "Jóváhagy & indít" (`primary` háttér, `#1C1917` szöveg, 700) + "Szerkeszt" (white, `border`) + "Eldob" (ghost)

### 5.6 Lebegő composer

Pozicionálás: `position: sticky; bottom: 0` — nem fix, hanem a scroll alján lebeg. A chat list `padding-bottom: 80px` hogy ne fedjen.

Forma: `surface` háttér, `border` border, **16px border-radius**, box-shadow (elevation szint). Margin: 12px 16px.

Belső: `<textarea>` (border none, resize none, 14px, transparent háttér, 1.5 line-height, min-height: 52px) + alsó sor `border-top: #F5F2EF`: bal oldalon üres, jobb oldalon "Küldés" gomb.

"Küldés" gomb: `primary` háttér, `#1C1917` szöveg 700 13px, 8px radius, 8px 18px padding, nyíl SVG ikon.

---

## 6. Jóváhagyások nézet

### 6.1 Struktúra

Két belső sáv:
1. **Deliverable lista** — 260px, `border-right: border`
2. **Részletpanel** — flex-1

### 6.2 Deliverable lista

Header: "Jóváhagyások" 16px 800 + "N vár · M ma kiszállítva" caption.

Deliverable item: 12px 16px padding, `border-bottom: border`, `border-left: 3px solid` (aktív: `primary`; inaktív: transparent).
- Aktív: `surface` háttér
- Cím: 13px 600 (aktív) / 500 (inaktív), `text-primary`
- Státusz badge: jobb felső, pill
- Agent + timestamp: 11px, monospace agent, `text-muted` timestamp

Szekció elválasztó: "MA KISZÁLLÍTVA" — `#F5F2EF` háttér, 10px 600 `text-subtle` caption.

Kiszállított itemek: 70% opacitás, zöld "✓ kiszállítva" szöveg.

### 6.3 Részletpanel

Header (padding: 16px 20px, `border-bottom`):
- Bal: cím 15px 700 + státusz badge + agent·timestamp
- Jobb: 3 gomb: "Visszaküld" (secondary), "Eldob" (secondary), "✓ Jóváhagy" (`primary` amber)

Tartalom: scroll-ozható terület, fehér kártya `border`-rel, 10px radius, 18px padding. Section label + deliverable szöveg.

---

## 7. Navigáció és UX flow

### 7.1 Napi operátor munkamenet (happy path)

1. Megnyitja a Marquee-t → **HQ** fogadja: látja a függő jóváhagyásokat és az aktív agentet
2. Amber alert CTA-t kattint → **Jóváhagyások** nézet, első item előre kiválasztva
3. Végigmegy a listán: Jóváhagy / Visszaküld — minden kattintás a szomszédos panelben nyílik
4. Ha új kampányt akar indítani → **Workshop**, Directort megszólítja
5. Brief kártyát jóváhagyja → visszatérhet HQ-ra, látja az agentet dolgozni

### 7.2 Badge logika

A "Jóváhagyások" nav item amber pill badge-dzse megjelenik ha `awaiting_approval` státuszú deliverable van. A szám SSE-n keresztül frissül valós időben. Ha 0 → badge eltűnik.

### 7.3 Státusz badge-ek (változatlan szemantika, új vizuál)

| Státusz | Háttér | Szöveg |
|---|---|---|
| `drafting` | `primary-soft` | `primary-text-on` |
| `awaiting_eval` | `#F5F5F4` | `text-muted` |
| `awaiting_approval` | `primary-soft` | `primary-text-on` |
| `shipped` | `#DCFCE7` | `#15803D` |
| `blocked` | `danger-soft` | `#B91C1C` |

---

---

---

## 7a. Memória nézet — editor UX

### Renderelt nézet + szerkesztés toggle

A memória fájlok backend formátuma (YAML frontmatter + markdown törzs) változatlan marad. A frontend két módban mutatja ugyanazt a tartalmat:

**Olvasási mód (alapértelmezett):**
- A YAML frontmatter `name` és `description` mezői metaadat-sávként jelennek meg a kártya tetején (`#F5F2EF` háttér, 10px 600 `text-muted` labelek) — a user soha nem lát nyers YAML-t
- A markdown törzs renderelve jelenik meg (`react-markdown` + `remark-breaks`, ugyanaz mint a többi nézeten)
- Jobb felső sarokban: "Szerkesztés" gomb (`button-secondary`)

**Szerkesztési mód ("Szerkesztés" gombra):**
- A kártya tartalmát felváltja egy `<textarea>` a teljes nyers tartalommal (YAML frontmatter + markdown)
- A "Szerkesztés" gomb helyett: "Mentés" (`button-primary`, amber) + "Mégse" (`button-ghost`)
- Mentés után visszaáll olvasási módba, a friss tartalom újra renderelve

## 7b. Kampányok nézet — kiegészítések

### Deliverable sorok navigációja

A kampány részletpanelben minden deliverable sor kattintható, státusztól függetlenül (folyamatban, jóváh. vár, kiszállítva egyaránt). Kattintásra a Jóváhagyások nézetre navigál, az adott deliverable előre betöltve a részletpanelben (`/approvals/:id` route). A Jóváhagyások nézet kezeli a shipped státuszú itemeket is — ebben az esetben az akciógombok (Jóváhagy / Visszaküld / Eldob) rejtve vannak, a tartalom olvasható.

A sor hover állapota: `border-color: border-strong`, cursor: pointer — jelzi a kattinthatóságot.

---

## 8. Komponensek amelyek NEM változnak

- Memória nézet (MemoryFileList, MemoryEditor) — csak token frissítés
- Kampányok nézet — csak token frissítés
- RevisionTabs — csak token frissítés
- BrandVoiceReviewPanel — csak token frissítés
- SendBackModal — csak token frissítés
- SSE, backend, adatbázis — érintetlen

---

## 9. DESIGN.md státusza

A gyökér `DESIGN.md` elavulttá válik. Az implementáció ezt a dokumentumot (`2026-04-30-marquee-ux-redesign-design.md`) és az ebből generált Tailwind tokenkonfigurációt használja. A régi DESIGN.md archívumba kerül vagy törlődik.

---

## 10. Implementációs megjegyzések

- **Tailwind config** frissítendő: új color tokenek, Inter-only fontStack, új border-radius értékek
- **DESIGN.md gyökér** vagy törlődik vagy a spec elején "deprecated" jelzést kap
- A `packages/web/src/lib/design.ts` token map frissítendő az új értékekkel
- Komponensek érintett fájljai: `TopNav.tsx` → `Sidebar.tsx`-szé alakul; `Workshop.tsx` composer refactor; `Approvals.tsx` split-panel layout
- A sötét sidebar Inter + JetBrains Mono kombót használ — a Google Fonts import a Source Serif 4-et kihagyhatja
