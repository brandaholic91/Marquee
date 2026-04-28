---
version: alpha
name: Marquee Design System
description: Editorial newsroom dashboard with subtle theater-marquee accents for the marquee orchestration UI
colors:
  # --- Canonical role assignments (Material-style "primary"/"secondary"/"neutral") ---
  # primary = the brand action color (Marquee Red)
  primary: "#C13B2D"
  primary-hover: "#A8311E"
  primary-soft: "#F5DDD8"
  on-primary: "#FFFFFF"
  # secondary = the live-state accent (Bulb Amber)
  secondary: "#E5A532"
  secondary-soft: "#FFF4DD"
  # neutral = the warm canvas
  neutral: "#F7F4ED"
  # --- Descriptive aliases (used in components and prose) ---
  # Ink — primary text and core UI
  ink: "#1A1A1F"
  ink-soft: "#2D2D34"
  # Slate — borders, captions, metadata, secondary text
  slate: "#5C5C66"
  slate-soft: "#8F8F99"
  # Cream / parchment — warm editorial surfaces
  cream: "#F7F4ED"
  parchment: "#FAF7F0"
  surface-white: "#FFFFFF"
  divider: "#E8E2D5"
  divider-strong: "#D4CCBA"
  # Semantic — full strength for icons / borders, soft for tinted backgrounds
  success: "#2D8A4F"
  success-deep: "#1F6638"
  success-soft: "#DCEFE2"
  warning: "#C97A1F"
  warning-deep: "#8C5612"
  warning-soft: "#FBEACE"
  danger: "#B83A2F"
  danger-deep: "#8A2D24"
  danger-soft: "#F5DDD8"
typography:
  display-xl:
    fontFamily: Source Serif 4
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0em
  headline-sm:
    fontFamily: Source Serif 4
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
  marquee-ticker:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.08em
rounded:
  sm: 2px
  md: 4px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  container-max: 1280px
  sidebar-width: 240px
  chat-drawer-width: 384px
  card-padding: 24px
  gutter: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-white}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    height: 40px
  button-secondary-hover:
    backgroundColor: "{colors.cream}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink-soft}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  button-ghost-hover:
    backgroundColor: "{colors.cream}"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface-white}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    height: 40px
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  card-interactive-hover:
    backgroundColor: "{colors.parchment}"
  card-elevated:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  input-text:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 12px
    height: 40px
  textarea-chat:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 12px 14px
  badge-status-drafting:
    backgroundColor: "{colors.secondary-soft}"
    textColor: "{colors.warning-deep}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  badge-status-awaiting-eval:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.slate}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  badge-status-awaiting-approval:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  badge-status-shipped:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-deep}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  badge-status-blocked:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-deep}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  badge-agent:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  bulb-indicator-active:
    backgroundColor: "{colors.secondary}"
    size: 8px
    rounded: "{rounded.full}"
  bulb-indicator-idle:
    backgroundColor: "{colors.divider-strong}"
    size: 8px
    rounded: "{rounded.full}"
  live-ticker-row:
    backgroundColor: transparent
    textColor: "{colors.ink-soft}"
    typography: "{typography.marquee-ticker}"
    padding: 8px 12px
  live-ticker-row-hover:
    backgroundColor: "{colors.cream}"
  chat-message-human:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 10px 14px
  chat-message-agent:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 10px 14px
  proposal-card-brief:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  proposal-card-memory:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  sidebar-nav-item:
    backgroundColor: transparent
    textColor: "{colors.slate}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  sidebar-nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
  sidebar-nav-item-hover:
    backgroundColor: "{colors.cream}"
  page-bg:
    backgroundColor: "{colors.cream}"
  sidebar-bg:
    backgroundColor: "{colors.parchment}"
---

# Marquee — Design System

## Brand & Style

Marquee is the orchestration UI for an AI marketing agency. It is used by a single human operator who manages a 7-agent team — supervising deliverables, reviewing work, approving outputs, and steering the team's daily focus.

The aesthetic is **Editorial Newsroom with Marquee Accents**. Imagine the print edition of *Lenny's Newsletter*, the *Stripe Press* book series, or the *NYT Cooking* dashboard — restrained typography, generous whitespace, a warm cream background instead of pure white, and a single bold accent color used sparingly for action.

The "marquee" hommage lives in two restrained places: a glowing **Bulb Amber** indicator (`secondary` token) next to active agents — a single dot, like a theater marquee bulb — and a **monospace ticker** style for the Live Agent Feed, echoing the running text of an actual marquee. Everywhere else, the system stays calm and editorial — because the operator works in this UI for hours each day, and theater-loud styling would exhaust them.

The product is professional, data-driven, and non-promotional. It mirrors the brand voice of the agency itself.

## Colors

The palette is built on warm neutrals (cream, parchment, ink) with a single bold accent (`primary`, the Marquee Red) reserved exclusively for primary actions and live-status emphasis. A second accent (`secondary`, the Bulb Amber) marks living state — used only for the active-agent indicator and memory-proposal card accents.

**Token roles:**

- **`primary` (#C13B2D — "Marquee Red"):** The single action color. Used **only** for primary action buttons, the active sidebar nav item background tint, the deliverable status `awaiting_approval` badge, and the focus ring on inputs. Never decorative.
- **`primary-hover` (#A8311E):** Hover state for primary buttons.
- **`primary-soft` (#F5DDD8):** Tinted background for selected nav items, awaiting-approval badges, and human chat messages.
- **`secondary` (#E5A532 — "Bulb Amber"):** Warm theater-bulb yellow used **only** for the active-agent indicator dot and the border accent on memory-proposal cards. Marks living state.
- **`secondary-soft` (#FFF4DD):** The glow halo around active-agent indicators; `drafting` badge background.
- **`neutral` (#F7F4ED):** Alias of `cream`. The canonical canvas color.

**Descriptive aliases (used in components and prose):**

- **`ink` (#1A1A1F):** Deep, slightly warm black. Headlines, body text, core UI. Replaces pure black to feel printed rather than digital.
- **`ink-soft` (#2D2D34):** Mid charcoal for ticker rows, body content where ink feels too heavy.
- **`slate` (#5C5C66) / `slate-soft` (#8F8F99):** Mid-grey for captions, metadata, placeholder text. Avoids cold UI grey.
- **`cream` (#F7F4ED) / `parchment` (#FAF7F0):** Warm editorial surfaces. Page background and sidebar/drawer background respectively.
- **`surface-white` (#FFFFFF):** Card surfaces. Pops against cream, replacing heavy shadows as the cue for "elevated content".
- **`divider` (#E8E2D5) / `divider-strong` (#D4CCBA):** Warm beiges for separators. Used as `border-divider` / `border-divider-strong` Tailwind utility classes (not via component tokens — the design.md schema doesn't model border colors at component level; see "Borders & shadows" below).

**Semantic — full strength + deep + soft:**

- `success` (#2D8A4F) / `success-deep` (#1F6638) / `success-soft` (#DCEFE2)
- `warning` (#C97A1F) / `warning-deep` (#8C5612) / `warning-soft` (#FBEACE)
- `danger` (#B83A2F) / `danger-deep` (#8A2D24) / `danger-soft` (#F5DDD8)

The `*-deep` variants are used as text colors on the `*-soft` backgrounds to pass WCAG AA contrast (≥ 4.5:1) on small text. The full-strength variants are used for icons, borders (via Tailwind utilities), and full-color buttons.

**Contrast targets:** all body text on cream and white passes WCAG AA. Primary on white passes AA for buttons (4.96:1). All status badges (drafting / awaiting_eval / awaiting_approval / shipped / blocked) pass AA after the deep-variant text-color choice.

### Borders & shadows (not in component tokens)

The design.md schema only models a small set of component sub-tokens (background, text, typography, rounded, padding, size). **Border colors and shadow values are conveyed in this prose, not in YAML.** Implementation maps:

- **`card`, `card-interactive-hover`** — 1px solid `divider`. On hover: `divider-strong`.
- **`card-elevated`** — 1px solid `divider` + shadow `0 1px 2px rgba(26, 26, 31, 0.04), 0 4px 12px rgba(26, 26, 31, 0.06)`. Only one elevation level total.
- **`button-secondary`** — 1px solid `divider-strong`.
- **`input-text`, `textarea-chat`** — 1px solid `divider-strong`. **Focus state**: 2px ring `primary` + offset 1px (`box-shadow: 0 0 0 2px primary`).
- **`badge-agent`** — 1px solid `divider`.
- **`chat-message-agent`** — 1px solid `divider`.
- **`proposal-card-brief`** — 2px solid `primary` (signals "action required").
- **`proposal-card-memory`** — 2px solid `secondary` (signals "your input shapes the team's brain").
- **`bulb-indicator-active`** — 4px outer halo, `secondary-soft` at 40% opacity, with a 1.5s pulse animation.
- **`sidebar-bg`** — 1px solid `divider` on the right edge only.

## Typography

The system uses three font families:

- **Source Serif 4** — editorial serif for all headlines and display text. Open-source from Adobe via Google Fonts. Calm, modern, with low-key authority. Reinforces the "editorial masthead" framing.
- **Inter** — clean humanist sans-serif for all body text, UI labels, and navigation. Ubiquitous, free, excellent on screens at every size.
- **JetBrains Mono** — geometric monospace for technical data (token counts, timestamps, IDs, model names) and the Live Agent Feed ticker. Replaces the traditional dot-matrix marquee font with something readable while retaining the "running data" character.

Hierarchy:

- **Display (display-xl, display-lg):** First-time-user moments only — the onboarding chat header ("Welcome to marquee"), empty-state hero illustrations.
- **Headline (lg / md / sm):** Page titles, deliverable titles, dashboard widget headers. All Source Serif 4 semibold.
- **Body (lg / md / sm):** Inter, comfortable reading sizes. `body-md` (15px) is the workhorse.
- **Label (md / sm):** Inter medium, for buttons, badges, sidebar nav. `label-sm` is uppercase-light (no forced uppercasing) — let the prose decide casing.
- **Caption:** Inter regular small, for timestamps and tertiary metadata.
- **Mono (md / sm):** JetBrains Mono for any technical value the user might want to copy or compare (turn IDs, token counts, model names).
- **Marquee-ticker:** JetBrains Mono medium, slightly tracked-out, used **only** in the Live Agent Feed rows. The visual signature of the marquee accent.

## Layout

The layout is built on an **8px spacing scale** (with a 4px half-step for tight UI). Editorial layouts breathe — most card padding is `lg` (24px), most gutters are `lg`, page margins are `xl` (32px) on desktop.

The shell is a three-column layout on desktop:

- **Left sidebar** (240px wide, parchment background) — main nav: Home, Pipeline, Memory. Compact, no icons-only mode in v0.1 (clarity over density).
- **Main canvas** (flex, max-width 1280px, cream background) — the active view (dashboard widgets, deliverable detail, etc.).
- **Right chat drawer** (384px wide, parchment background, collapsible) — always-on chat with the team. Collapsing it reveals 100% of the canvas.

On mobile (rare for this single-user dashboard, but supported): sidebar becomes a slide-in menu, drawer becomes a full-screen overlay invoked from a chat icon.

The Home dashboard uses a 2×2 grid of cards on desktop (Approvals, Live Feed, Pipeline, Active Conversations), each card 480px wide minimum. Cards collapse to single-column at <960px viewport.

## Elevation & Depth

Marquee is **flat-editorial**. Visual hierarchy comes from:

1. **Background tone contrast** — cream canvas, parchment structural surfaces, white cards. Three tones is enough.
2. **Borders** — the warm `divider` and `divider-strong` colors carry separation. No 1px hairlines in cool grey.
3. **Selective elevation** — exactly one shadow level (`card-elevated`) for hover/focused states and modals. Layered shadows are forbidden.

Heavy drop shadows, gradient backgrounds, glass blur, and depth-as-decoration are explicitly out of scope. If a UI element needs to "feel important", make the typography work harder.

## Shapes

Subtle rounded corners — editorial restraint.

- `rounded-sm` (2px) — inline elements like inline-code, small badges, separators
- `rounded-md` (4px) — buttons, inputs, sidebar nav items (the workhorse)
- `rounded-lg` (8px) — cards, chat messages, proposal cards
- `rounded-xl` (12px) — large hero cards or modals (rare)
- `rounded-full` (9999px) — exclusively for status badges, agent badges, and the bulb indicator

iOS-style fully-rounded buttons or pill-shaped cards are out of scope.

## Components

### Bulb indicator (the marquee accent)

A small (8px) circular indicator placed inline next to agent slugs in lists or feeds. Two states:

- **Active** (`bulb-indicator-active`) — fill `secondary`, with a soft 4px glow halo (`secondary-soft` at 40% opacity). Subtle 1.5s pulse animation when an agent is mid-turn.
- **Idle** (`bulb-indicator-idle`) — fill `divider-strong`, no glow, no animation.

This is the **only** decorative element that uses animation. Used in: Live Agent Feed rows, "Active conversations" widget, sidebar agent indicators.

### Live ticker row (`live-ticker-row`)

A single line in the Live Agent Feed widget. Uses `marquee-ticker` typography (JetBrains Mono, tracked-out 0.08em). Format:

```
[bulb] HH:MM:SS  agent-slug  EVENT_TYPE  ›  short payload
```

Hover reveals the full payload in a popover. Click navigates to the related deliverable / chat thread.

### Brief proposal card (`proposal-card-brief`)

An interactive card that appears inline in the chat when an agent calls `propose_brief(...)`. 2px solid `primary` border signals "action required". Contents: title (`headline-md`), scope (`body-md`), deliverables list (`label-sm` chips), optional deadline. Three buttons at the bottom: **Approve & dispatch** (`button-primary`), **Edit** (`button-secondary`), **Discard** (`button-ghost`).

### Memory proposal card (`proposal-card-memory`)

Inline in chat. 2px solid `secondary` border signals "your input shapes the team's brain". Contents: file name (`label-md`), agent author (`badge-agent`), unified-diff render with green/red lines. Two buttons: **Approve & commit** (`button-primary`), **Reject** (`button-ghost`).

### Status badges

Pill-shaped (`rounded-full`), Inter `label-sm`. Each deliverable status has its own color pairing (text on bg, all WCAG AA):

- `drafting` → `secondary-soft` bg, `warning-deep` text
- `awaiting_eval` → `cream` bg, `slate` text
- `awaiting_approval` → `primary-soft` bg, `primary-hover` text (the only badge that gets the action accent)
- `shipped` → `success-soft` bg, `success-deep` text
- `blocked` → `danger-soft` bg, `danger-deep` text

The `awaiting_approval` badge is intentionally the loudest — it pulls the operator's eye toward the action queue.

### Buttons

Three styles, used purposefully:

- **button-primary** (`primary` background, `on-primary` text) — exactly one per view. Reserved for the highest-priority action: Approve, Dispatch, Confirm.
- **button-secondary** (white with `divider-strong` border) — accept-but-not-decisive actions: Edit, Cancel from a destructive flow, secondary CTA.
- **button-ghost** (transparent) — tertiary or inline actions: Dismiss, Open in new tab, expand.
- **button-destructive** (`danger` background, white text) — only for explicit destructive actions: Archive, Delete (rare in v0.1).

## Do's and Don'ts

### Do

- Use `primary` (Marquee Red) for **exactly one** primary call-to-action per view. Multiple red buttons = red noise.
- Use `bulb-indicator-active` (Bulb Amber, glowing) for active-agent state only. It's the visual signature.
- Use `marquee-ticker` typography only in the Live Agent Feed. Anywhere else makes the running-text effect cheap.
- Pair Source Serif 4 headlines with Inter body. Always.
- Reach for whitespace before reaching for visual decoration. Editorial design earns attention by withholding it.
- Use bg-color contrast (cream / parchment / white) before reaching for shadows.

### Don't

- Don't use `primary` for borders, separators, or decorative accents. It's an action color (the only exceptions are documented above: `proposal-card-brief` border, `awaiting_approval` badge).
- Don't put `secondary` on anything that isn't a living-state indicator. No amber buttons. No amber "warning" backgrounds (use `warning-soft` instead).
- Don't stack shadows. One elevation level total (`card-elevated`).
- Don't use serif (Source Serif 4) for body, labels, or anything below 18px. Headlines only.
- Don't use uppercase for label text by default. Casing is decided by the prose author, not the design system.
- Don't put theater bulbs around button borders, decorative dot patterns in the background, or any "cute" marquee evocation. The hommage stays restrained to the two documented places.
- Don't add dark mode in v0.1. Solve once-light first; dark in v0.2 if the user requests it.

---

## Implementation notes

This DESIGN.md is consumed by the agent doing frontend work in Plan 1 Tasks 30-36. Specifically:

- **Task 30** (`packages/web/` bootstrap): the file is copied to the marquee monorepo root as `DESIGN.md`. The Tailwind config is generated from the YAML tokens (color palette, typography scale, rounded scale, spacing scale).
- **Tasks 32-36** (frontend views): each view references the relevant component definitions above. Buttons, badges, cards, inputs, and the bulb indicator are pre-defined; the views compose them.
- **shadcn/ui customization** (Task 30): when adding shadcn components, override their default Tailwind variants to match this system (e.g., `Button` variant `default` becomes `button-primary`, the cream/parchment/white tones replace the default `background`/`muted` tokens).

To validate the file before committing changes:

```bash
npx @google/design.md lint docs/superpowers/specs/2026-04-27-marquee-design.md
```

Targets: zero errors, contrast warnings only on intentionally-low-contrast decorative elements (none in v0.1).
