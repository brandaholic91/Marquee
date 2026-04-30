# Marquee Wave 1 — Új agentek implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Három új agent hozzáadása a Marquee MVP-hez: Email Marketer, SEO Specialist (klasszikus deliverable-gyártók), és Brand Voice Guardian (review role, új minta).

**Architecture:** Email Marketer és SEO Specialist pontosan a meglévő `brief → specialist → deliverable` flow-ba illeszkednek. Brand Voice Guardian külön `dispatchReview` funkción és `deliverable_reviews` DB táblán alapul, operátor-triggerrel a DeliverableDetail UI-ból.

**Tech Stack:** Node.js 22, TypeScript, Fastify 5, better-sqlite3 + Drizzle, React 19, Vite, Zustand, Tailwind 3, `@mariozechner/pi-agent-core`

---

## Fájltérkép

### Új fájlok
| Fájl | Miért |
|---|---|
| `packages/web/src/lib/roles.ts` | Központi role label/szín mapping (spec 7.1 kötelező prerequisite) |
| `packages/server/seed/skills/email-marketer/hirlevel_iras.md` | Email Marketer skill recipe 1 |
| `packages/server/seed/skills/email-marketer/drip_sorozat_tervezes.md` | Email Marketer skill recipe 2 |
| `packages/server/seed/skills/email-marketer/transactional_email_szoveg.md` | Email Marketer skill recipe 3 |
| `packages/server/seed/skills/seo-specialist/kulcsszo_kutatas.md` | SEO Specialist skill recipe 1 |
| `packages/server/seed/skills/seo-specialist/on_page_seo_recommendation.md` | SEO Specialist skill recipe 2 |
| `packages/server/seed/skills/seo-specialist/content_brief_seo.md` | SEO Specialist skill recipe 3 |
| `packages/server/seed/skills/seo-specialist/technikai_seo_audit.md` | SEO Specialist skill recipe 4 |
| `packages/server/seed/skills/brand-voice-guardian/brand_voice_ellenorzes.md` | Guardian skill recipe |
| `packages/server/seed/memory/email_list_segments.md` | Email Marketer memory template |
| `packages/server/seed/memory/seo_keyword_bank.md` | SEO Specialist memory template |
| `packages/server/seed/memory/brand_voice_guidelines.md` | Guardian memory template (kötelező kalibrálás) |
| `packages/server/drizzle/0003_deliverable_reviews.sql` | Migration: deliverable_reviews tábla |
| `packages/server/src/tools/submit-review.ts` | Guardian submit_review tool |
| `packages/server/src/tools/submit-review.test.ts` | submit-review tesztek |
| `packages/server/src/broker/review-dispatcher.ts` | dispatchReview funkció |
| `packages/server/src/broker/review-dispatcher.test.ts` | dispatchReview tesztek |
| `packages/web/src/components/BrandVoiceReviewPanel.tsx` | Guardian review UI panel |

### Módosított fájlok
| Fájl | Mit változtat |
|---|---|
| `packages/server/src/agents/config.ts` | 3 új role: email-marketer, seo-specialist, brand-voice-guardian |
| `packages/server/src/agents/config.test.ts` | Role count 4 → 7, új assertions |
| `packages/server/src/providers/index.ts` | 3 új model mapping |
| `packages/server/src/agents/transform-context.ts` | FILES_FOR_ROLE: 3 új role |
| `packages/server/src/agents/transform-context.test.ts` | Új role-ok memory context tesztje |
| `packages/server/src/agents/factory.ts` | submit_review eset + deliverableId SpawnInput-ban |
| `packages/server/src/memory/validate.ts` | MemoryFile type + REQUIRED: 3 új fájl |
| `packages/server/src/memory/validate.test.ts` | Új memory fájlok validálása |
| `packages/server/src/db/schema.ts` | deliverableReviews tábla + delegations.toAgent enum bővítés |
| `packages/server/src/tools/propose-brief.ts` | SPECIALIST_FOR + típusok + tool description |
| `packages/server/src/tools/propose-brief.test.ts` | Új specialisták tesztje |
| `packages/server/src/broker/router.ts` | BriefPayload.target_specialist típus bővítés |
| `packages/server/src/server/routes/deliverables.ts` | POST /:id/review endpoint + authManager |
| `packages/server/src/server/routes/deliverables.test.ts` | Review endpoint teszt |
| `packages/server/src/server/index.ts` | authManager átadás deliverablesRoutes-nak |
| `packages/web/src/lib/api.ts` | reviewsApi (trigger + list) |
| `packages/web/src/views/DeliverableDetail.tsx` | BrandVoiceReviewPanel integrálása |
| `packages/web/src/components/BriefProposalCard.tsx` | roles.ts használata specialist label-hez |

---

## Task 1: Roles mapping (prerequisite refactor)

**Files:**
- Create: `packages/web/src/lib/roles.ts`
- Modify: `packages/web/src/components/BriefProposalCard.tsx`

A spec 7.1 szerint a role-megjelenítés legyen egy helyről. Ez kötelező refactor, mielőtt új role-okat veszünk fel — különben a diff szétszórt lesz.

- [ ] **Lépés 1: Hozd létre a roles.ts fájlt**

```typescript
// packages/web/src/lib/roles.ts
export const ROLES: Record<string, { label: string; color: string }> = {
  director:              { label: 'Director',              color: 'bg-primary-soft text-primary-hover' },
  copywriter:            { label: 'Copywriter',            color: 'bg-secondary-soft text-warning-deep' },
  'social-manager':      { label: 'Social Manager',        color: 'bg-success-soft text-success-deep' },
  'paid-specialist':     { label: 'Paid Specialist',       color: 'bg-cream text-ink-1 border border-rule' },
  'email-marketer':      { label: 'Email Marketer',        color: 'bg-primary-soft text-primary-hover' },
  'seo-specialist':      { label: 'SEO Specialist',        color: 'bg-success-soft text-success-deep' },
  'brand-voice-guardian':{ label: 'Brand Voice Guardian',  color: 'bg-secondary-soft text-warning-deep' },
};

export function roleLabel(slug: string): string {
  return ROLES[slug]?.label ?? slug;
}
```

- [ ] **Lépés 2: Frissítsd a BriefProposalCard.tsx-t roles.ts-ből**

```tsx
// packages/web/src/components/BriefProposalCard.tsx — a fájl tetejére importáld:
import { roleLabel } from '../lib/roles.js';

// A komponensben cseréld ezt a sort:
// Specialista: <strong>{targetSpecialist}</strong>
// Erre:
Specialista: <strong>{roleLabel(targetSpecialist)}</strong>
```

- [ ] **Lépés 3: TS check**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Lépés 4: Commit**

```bash
git add packages/web/src/lib/roles.ts packages/web/src/components/BriefProposalCard.tsx
git commit -m "refactor(web): central ROLES mapping in lib/roles.ts"
```

---

## Task 2: Email Marketer — backend config (failing tests first)

**Files:**
- Modify: `packages/server/src/agents/config.test.ts`

- [ ] **Lépés 1: Frissítsd a config.test.ts-t — várj 5 role-t (még failel)**

```typescript
// packages/server/src/agents/config.test.ts — módosítandó sorok:

it('has exactly 5 roles', () => {    // volt: 'has exactly 4 roles'
  const slugs = Object.keys(ROLE_CONFIGS);
  expect(slugs.sort()).toEqual([     // volt: 4 elem
    'copywriter', 'director', 'email-marketer', 'paid-specialist', 'social-manager'
  ]);
});

// Új test a meglévők után:
it('email-marketer is transient and produces email', () => {
  const c = getRoleConfig('email-marketer');
  expect(c.lifecycle).toBe('transient');
  expect(c.produces).toContain('email');
  expect(c.tools).toContain('submit_deliverable');
});
```

- [ ] **Lépés 2: Futtasd a tesztet — failelt-e?**

```bash
cd packages/server && npx vitest run src/agents/config.test.ts
```
Expected: FAIL — "has exactly 5 roles" — `email-marketer` hiányzik

---

## Task 3: Email Marketer — backend config implementálás

**Files:**
- Modify: `packages/server/src/agents/config.ts`
- Modify: `packages/server/src/providers/index.ts`
- Modify: `packages/server/src/agents/transform-context.ts`
- Modify: `packages/server/src/memory/validate.ts`
- Modify: `packages/server/src/tools/propose-brief.ts`
- Modify: `packages/server/src/broker/router.ts`

- [ ] **Lépés 1: Bővítsd a config.ts-t**

```typescript
// packages/server/src/agents/config.ts — teljes fájl:
export type RoleSlug =
  | 'director'
  | 'copywriter'
  | 'social-manager'
  | 'paid-specialist'
  | 'email-marketer'
  | 'seo-specialist'
  | 'brand-voice-guardian';

export type Lifecycle = 'warm' | 'transient';

export interface RoleConfig {
  slug: RoleSlug;
  lifecycle: Lifecycle;
  tools: string[];
  produces: string[];
}

export const ROLE_CONFIGS: Record<RoleSlug, RoleConfig> = {
  director: {
    slug: 'director',
    lifecycle: 'warm',
    tools: ['propose_brief', 'propose_memory_update', 'read_memory', 'get_campaign_status'],
    produces: [],
  },
  copywriter: {
    slug: 'copywriter',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_deliverable'],
    produces: ['email', 'blog_post'],
  },
  'social-manager': {
    slug: 'social-manager',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_deliverable'],
    produces: ['social_post'],
  },
  'paid-specialist': {
    slug: 'paid-specialist',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_deliverable'],
    produces: ['ad_copy'],
  },
  'email-marketer': {
    slug: 'email-marketer',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_deliverable'],
    produces: ['email'],
  },
  'seo-specialist': {
    slug: 'seo-specialist',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_deliverable'],
    produces: ['blog_post'],
  },
  'brand-voice-guardian': {
    slug: 'brand-voice-guardian',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_review'],
    produces: [],
  },
};

export function getRoleConfig(slug: RoleSlug): RoleConfig {
  const c = ROLE_CONFIGS[slug];
  if (!c) throw new Error(`unknown role: ${slug}`);
  return c;
}
```

*Megjegyzés: `seo-specialist` `blog_post`-ot produkál — ez a legalkalmasabb meglévő típus az SEO dokumentumokhoz. `brand-voice-guardian` mind a 3 role-t egyszerre definiálja, de az implementáció fázisosan megy.*

- [ ] **Lépés 2: Bővítsd a providers/index.ts-t**

```typescript
// packages/server/src/providers/index.ts — teljes fájl:
import { getModel } from "@mariozechner/pi-ai";

const ROLE_MODEL: Record<string, string> = {
  director: "gpt-5.4",
  copywriter: "gpt-5.4",
  "social-manager": "gpt-5.4-mini",
  "paid-specialist": "gpt-5.4-mini",
  "email-marketer": "gpt-5.4",
  "seo-specialist": "gpt-5.4-mini",
  "brand-voice-guardian": "gpt-5.4-mini",
};

export function modelForRole(role: string) {
  const id = ROLE_MODEL[role] ?? "gpt-5.4-mini";
  return getModel("openai-codex", id as never)!;
}

export { getEnvApiKey } from "@mariozechner/pi-ai";
```

- [ ] **Lépés 3: Bővítsd a transform-context.ts FILES_FOR_ROLE-t**

```typescript
// packages/server/src/agents/transform-context.ts — módosítandó rész:
const FILES_FOR_ROLE: Record<RoleSlug, MemoryFile[]> = {
  director: ["profile.md", "brand_voice.md", "ongoing_campaigns.md"],
  copywriter: ["profile.md", "brand_voice.md"],
  "social-manager": ["profile.md", "brand_voice.md"],
  "paid-specialist": ["profile.md", "brand_voice.md"],
  "email-marketer": ["profile.md", "brand_voice.md", "email_list_segments.md"],
  "seo-specialist": ["profile.md", "brand_voice.md", "seo_keyword_bank.md"],
  "brand-voice-guardian": ["profile.md", "brand_voice_guidelines.md"],
};
```

- [ ] **Lépés 4: Bővítsd a memory/validate.ts-t az új memory fájlokkal**

```typescript
// packages/server/src/memory/validate.ts — teljes fájl:
export type MemoryFile =
  | 'profile.md'
  | 'brand_voice.md'
  | 'ongoing_campaigns.md'
  | 'email_list_segments.md'
  | 'seo_keyword_bank.md'
  | 'brand_voice_guidelines.md';

const REQUIRED: Record<MemoryFile, string[]> = {
  'profile.md': ['business_description', 'target_audience', 'usp', 'competitors'],
  'brand_voice.md': ['tone', 'adjectives', 'reference_brands', 'do', 'dont'],
  'ongoing_campaigns.md': ['campaigns'],
  'email_list_segments.md': ['segments'],
  'seo_keyword_bank.md': ['keywords'],
  'brand_voice_guidelines.md': ['tone', 'tiltott_kifejezesek', 'pelda_jo_mondatok', 'pelda_rossz_mondatok'],
};

export function validateFrontmatter(file: string, fm: Record<string, unknown>): void {
  const required = REQUIRED[file as MemoryFile];
  if (!required) {
    throw new Error(`unknown memory file: ${file}`);
  }
  const missing = required.filter((k) => !(k in fm));
  if (missing.length > 0) {
    throw new Error(`${file}: missing required frontmatter fields: ${missing.join(', ')}`);
  }
}

export const MEMORY_FILES: MemoryFile[] = [
  'profile.md',
  'brand_voice.md',
  'ongoing_campaigns.md',
  'email_list_segments.md',
  'seo_keyword_bank.md',
  'brand_voice_guidelines.md',
];
```

- [ ] **Lépés 5: Bővítsd a propose-brief.ts-t**

```typescript
// packages/server/src/tools/propose-brief.ts — módosítandó részek:

// SPECIALIST_FOR kibővítve:
const SPECIALIST_FOR: Record<string, string[]> = {
  copywriter: ['email', 'blog_post'],
  'social-manager': ['social_post'],
  'paid-specialist': ['ad_copy'],
  'email-marketer': ['email'],
  'seo-specialist': ['blog_post'],
};

// ProposeBriefInput típus bővítve:
export interface ProposeBriefInput {
  title: string;
  content_md: string;
  deliverable_type: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
  target_specialist: 'copywriter' | 'social-manager' | 'paid-specialist' | 'email-marketer' | 'seo-specialist';
  platform?: string;
  campaign_name?: string;
}

// Az inputSchema target_specialist enum-ja bővítve:
target_specialist: {
  type: 'string',
  enum: ['copywriter', 'social-manager', 'paid-specialist', 'email-marketer', 'seo-specialist'],
  description: [
    'A target_specialist lehetséges értékei:',
    '- copywriter: long-form szöveg (cikk, landing page, blog poszt, white paper, email sorozat keretszöveg).',
    '- social-manager: közösségi média poszt (LinkedIn, Facebook, Instagram, Twitter/X).',
    '- paid-specialist: fizetett hirdetés creative (Meta ads, Google ads, targeting javaslat).',
    '- email-marketer: bármilyen email (hírlevél, drip sorozat, transactional email — welcome, abandoned cart, stb.). Automatizált sorozatnál is ezt válaszd.',
    '- seo-specialist: SEO-feladat (kulcsszó-kutatás, on-page audit, technikai SEO checklist, SEO-orientált content brief Copywriter-nek).',
    'TILOS target_specialist-ként: brand_voice_guardian — ez review role, kizárólag az operátor triggereli.',
    'Ha a kérés egyszerre több role-t érintene, egy briefet javasolj, a legkritikusabb role-ra.',
  ].join('\n'),
},
```

- [ ] **Lépés 6: Frissítsd a broker/router.ts BriefPayload típusát**

```typescript
// packages/server/src/broker/router.ts — módosítandó interface:
interface BriefPayload {
  title: string;
  body: string;
  deliverable_type: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
  target_specialist: 'copywriter' | 'social-manager' | 'paid-specialist' | 'email-marketer' | 'seo-specialist';
  platform?: string | null;
}
```

- [ ] **Lépés 7: Futtasd a teszteket**

```bash
cd packages/server && npx vitest run src/agents/config.test.ts src/tools/propose-brief.test.ts
```
Expected: PASS (config.test.ts email-marketer assertion-ök zöldek)

---

## Task 4: Email Marketer — validate.ts tesztek + seed fájlok

**Files:**
- Modify: `packages/server/src/memory/validate.test.ts`
- Create: `packages/server/seed/skills/email-marketer/hirlevel_iras.md`
- Create: `packages/server/seed/skills/email-marketer/drip_sorozat_tervezes.md`
- Create: `packages/server/seed/skills/email-marketer/transactional_email_szoveg.md`
- Create: `packages/server/seed/memory/email_list_segments.md`

- [ ] **Lépés 1: Adj hozzá tesztet a validate.test.ts-hez**

```typescript
// packages/server/src/memory/validate.test.ts — új tesztek a meglévők után:

it('accepts valid email_list_segments.md', () => {
  expect(() => validateFrontmatter('email_list_segments.md', { segments: [] })).not.toThrow();
});

it('accepts valid brand_voice_guidelines.md', () => {
  const fm = {
    tone: ['professzionális'],
    tiltott_kifejezesek: ['forradalmasít'],
    pelda_jo_mondatok: ['Ez egy jó mondat.'],
    pelda_rossz_mondatok: ['Forradalmasítjuk a piacot.'],
  };
  expect(() => validateFrontmatter('brand_voice_guidelines.md', fm)).not.toThrow();
});

it('rejects brand_voice_guidelines.md missing required fields', () => {
  expect(() => validateFrontmatter('brand_voice_guidelines.md', { tone: ['pro'] }))
    .toThrow(/tiltott_kifejezesek/);
});
```

- [ ] **Lépés 2: Futtasd — PASS kell**

```bash
cd packages/server && npx vitest run src/memory/validate.test.ts
```
Expected: PASS

- [ ] **Lépés 3: Hozd létre a hirlevel_iras.md skill recipe-t**

```markdown
<!-- packages/server/seed/skills/email-marketer/hirlevel_iras.md -->
---
name: hirlevel_iras
when_to_use: Egyetlen standalone hírlevelet kell írni — termékbejelentés, edukáció, akció, vagy bármilyen egyszeri küldés
---

A hírlevél **MAGYAR NYELVŰ**. Minden esetben.

## Kötelező struktúra

Minden hírlevélnek tartalmaznia kell:
1. **Subject line** — 2-3 variáció, A/B teszthez. Max 50 karakter. Nem indulhat "RE:" vagy "FWD:"-vel.
2. **Preheader** — 85-100 karakter. A subject line-t egészíti ki, nem ismétli meg.
3. **Body** — Markdown formátumban. Hook → érték → részletek → CTA sorrend.
4. **CTA** — Egy gomb-szöveg (max 5 szó) + link-placeholder `[CTA_URL]`.

## Terjedelem

300-600 szó. Mobil-első szemlélet: rövid bekezdések, scannable.

## Brand voice

Tartsd be a brand voice irányelveket:
- Hangnem: `{{memory.brand_voice.tone}}`
- Alkalmazd: `{{memory.brand_voice.do}}`
- Kerüld: `{{memory.brand_voice.dont}}`

Az ügyfél leírása: `{{memory.profile.business_description}}`
Célcsoport: `{{memory.profile.target_audience}}`

## submit_deliverable hívása

```json
{
  "content_md": "<teljes hírlevél markdown — subject variációktól CTA-ig>",
  "structured_data": {
    "subject_variants": ["Subject 1", "Subject 2", "Subject 3"],
    "preheader": "A preheader szövege",
    "cta_text": "Gomb szövege",
    "cta_url_placeholder": "[CTA_URL]"
  }
}
```

## Amit ne csinálj

- Ne írj "Kedves [Név]!" megnyitót, hacsak a brief nem kér személyre szabást
- Ne legyen kettőnél több CTA
- Ne kezd generic "Reméljük..." formulával
- Ne adj le, amíg nincs meg mind a 4 kötelező elem (subject, preheader, body, CTA)
```

- [ ] **Lépés 4: Hozd létre a drip_sorozat_tervezes.md skill recipe-t**

```markdown
<!-- packages/server/seed/skills/email-marketer/drip_sorozat_tervezes.md -->
---
name: drip_sorozat_tervezes
when_to_use: Több emailes sorozatot kell tervezni — onboarding, nurture, re-engagement, vagy bármilyen automatizált flow
---

A drip sorozat **MAGYAR NYELVŰ**. Minden email.

## Kötelező output struktúra

### 1. Sorozat áttekintő
- Cél (1-2 mondat)
- Célcsoport szegmens
- Időzítési séma (pl. nap 0, nap 3, nap 7, nap 14)
- Összefoglaló ív (mi változik az olvasóban email-ről emailre)

### 2. Emailenként
Minden emailhez teljes tartalom:
- Email sorszám és neve (pl. "Email 1 — Welcome")
- Subject line (2 variáció)
- Preheader (1 variáció)
- Body (Markdown, 200-400 szó)
- CTA (gomb-szöveg + link-placeholder)
- Javasolt küldési nap/trigger

## Brand voice

Tartsd be a brand voice-t:
- Hangnem: `{{memory.brand_voice.tone}}`
- Alkalmazd: `{{memory.brand_voice.do}}`
- Kerüld: `{{memory.brand_voice.dont}}`

Az ügyfél leírása: `{{memory.profile.business_description}}`

## submit_deliverable hívása

```json
{
  "content_md": "<teljes sorozat leírása az áttekintőtől az utolsó emailig>",
  "structured_data": {
    "series_goal": "A sorozat célja",
    "email_count": 4,
    "emails": [
      {
        "no": 1,
        "name": "Welcome",
        "send_day": 0,
        "subject_variants": ["Subject A", "Subject B"],
        "preheader": "Preheader szövege",
        "cta_text": "Gomb szöveg",
        "cta_url_placeholder": "[CTA_URL_1]"
      }
    ]
  }
}
```

## Amit ne csinálj

- Ne legyen minden email ugyanolyan struktúrájú — változatos tone és CTA típus
- Ne tervezz 7-nél több emailt, hacsak a brief nem kér expliciten többet
- Ne hagyj ki egy emailt sem — minden sorszám teljes tartalommal
```

- [ ] **Lépés 5: Hozd létre a transactional_email_szoveg.md skill recipe-t**

```markdown
<!-- packages/server/seed/skills/email-marketer/transactional_email_szoveg.md -->
---
name: transactional_email_szoveg
when_to_use: Tranzakciós emailt kell írni — welcome, abandoned cart, order confirmation, password reset, trial expiry, vagy bármilyen esemény-alapú email
---

A tranzakciós email **MAGYAR NYELVŰ**. Minden esetben.

## Tranzakciós email típusok és szabályok

| Típus | Fő cél | Tone |
|---|---|---|
| Welcome | Első benyomás, következő lépés | Meleg, lelkes, de tömör |
| Abandoned cart | Visszahívás, sürgősség | Emlékeztető, nem tolakodó |
| Order confirmation | Biztonságérzet | Tényszerű, megbízható |
| Password reset | Gyors segítség | Semleges, gyors |
| Trial expiry | Konverzió | Értékalapú, nem nyomásos |

## Kötelező elemek

1. **Subject line** — Tranzakciós emailnél az utazó szembetűnő, egyértelmű. 2 variáció.
2. **Preheader** — Egészítse ki a subject-et (85-100 karakter).
3. **Body** — Tömör, tárgyilagos. Maximum 200-300 szó tranzakciós email esetén.
4. **CTA** — Egyetlen, kristálytiszta cselekvés. Gomb-szöveg + link-placeholder.
5. **Személyre szabási placeholder-ek** — `[KERESZTNEV]`, `[TERMEK_NEV]`, stb. ott ahol releváns.

## Brand voice

Tartsd be a brand voice-t:
- Hangnem: `{{memory.brand_voice.tone}}`
- Alkalmazd: `{{memory.brand_voice.do}}`
- Kerüld: `{{memory.brand_voice.dont}}`

## submit_deliverable hívása

```json
{
  "content_md": "<teljes email — subject variációktól CTA-ig — placeholder-ekkel>",
  "structured_data": {
    "email_type": "welcome",
    "subject_variants": ["Subject 1", "Subject 2"],
    "preheader": "Preheader szövege",
    "personalization_placeholders": ["[KERESZTNEV]", "[TERMEK_NEV]"],
    "cta_text": "Gomb szöveg",
    "cta_url_placeholder": "[CTA_URL]"
  }
}
```

## Amit ne csinálj

- Ne legyen egynél több CTA (tranzakciós emailnél különösen fontos)
- Ne tölts ki tényleges URL-t — csak placeholder
- Ne írj AI-frázisokat ("Örömmel értesítjük...", "Kérjük vegye figyelembe...")
```

- [ ] **Lépés 6: Hozd létre az email_list_segments.md memory template-t**

```markdown
<!-- packages/server/seed/memory/email_list_segments.md -->
---
segments:
  - name: "Összes feliratkozó"
    description: "Általános hírlevél lista"
    size_estimate: "ismeretlen"
  - name: "Trial felhasználók"
    description: "Aktív trial-on lévő felhasználók"
    size_estimate: "ismeretlen"

past_campaigns: []

preferred_send_times:
  - "Kedd 10:00"
  - "Csütörtök 14:00"

avg_open_rate: null
avg_ctr: null
---

# Email lista szegmensek

Töltsd ki a fenti frontmatter-t a GrowthFrame email listájának adataival.

**Szegmensek:** Adj hozzá minden releváns listát (pl. newsletter feliratkozók, trial userek, aktív ügyfelek).

**Múltbeli kampányok:** Ide kerülnek a korábbi kampányok teljesítmény-adatai (open rate, CTR, mi működött).

**Preferred send times:** Mikor a legmagasabb az open rate? Ha még nem ismert, hagyj `null`-t.
```

- [ ] **Lépés 7: Futtasd az összes server tesztet**

```bash
cd packages/server && npx vitest run
```
Expected: minden teszt PASS

- [ ] **Lépés 8: TS check**

```bash
cd packages/server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Lépés 9: Commit**

```bash
git add packages/server/src/agents/config.ts packages/server/src/agents/config.test.ts \
  packages/server/src/providers/index.ts packages/server/src/agents/transform-context.ts \
  packages/server/src/memory/validate.ts packages/server/src/memory/validate.test.ts \
  packages/server/src/tools/propose-brief.ts packages/server/src/broker/router.ts \
  packages/server/seed/skills/email-marketer/ \
  packages/server/seed/memory/email_list_segments.md
git commit -m "feat(server): Email Marketer role — config, skills, memory template"
```

---

## Task 5: SEO Specialist — config (failing tests)

**Files:**
- Modify: `packages/server/src/agents/config.test.ts`

- [ ] **Lépés 1: Frissítsd a config.test.ts-t — várj 6 role-t (még failel)**

```typescript
it('has exactly 6 roles', () => {    // volt: 5
  const slugs = Object.keys(ROLE_CONFIGS);
  expect(slugs.sort()).toEqual([
    'copywriter', 'director', 'email-marketer', 'paid-specialist',
    'seo-specialist', 'social-manager'
  ]);
});

// Új test:
it('seo-specialist is transient and produces blog_post', () => {
  const c = getRoleConfig('seo-specialist');
  expect(c.lifecycle).toBe('transient');
  expect(c.produces).toContain('blog_post');
  expect(c.tools).toContain('submit_deliverable');
});
```

- [ ] **Lépés 2: Futtasd — failelt-e?**

```bash
cd packages/server && npx vitest run src/agents/config.test.ts
```
Expected: FAIL — `seo-specialist` hiányzik a role listából

*Megjegyzés: a `seo-specialist` már benne van a config.ts-ben (Task 3-ban hozzáadtuk). Ezért ez a teszt PASS lesz. Ha PASS, nincs gond — lépj tovább a skill recipe-kre.*

---

## Task 6: SEO Specialist — seed fájlok

**Files:**
- Create: `packages/server/seed/skills/seo-specialist/kulcsszo_kutatas.md`
- Create: `packages/server/seed/skills/seo-specialist/on_page_seo_recommendation.md`
- Create: `packages/server/seed/skills/seo-specialist/content_brief_seo.md`
- Create: `packages/server/seed/skills/seo-specialist/technikai_seo_audit.md`
- Create: `packages/server/seed/memory/seo_keyword_bank.md`

- [ ] **Lépés 1: Hozd létre a kulcsszo_kutatas.md recipe-t**

```markdown
<!-- packages/server/seed/skills/seo-specialist/kulcsszo_kutatas.md -->
---
name: kulcsszo_kutatas
when_to_use: Adott témára magyar nyelvű kulcsszó-kutatást kell végezni search intent analízissel
---

A kulcsszó-kutatás output **MAGYAR NYELVŰ**.

## Output struktúra

### 1. Primary keyword (1 db)
- A kulcsszó
- Search intent: informational / commercial / transactional / navigational
- Becsült nehézség: alacsony / közepes / magas *(LLM-becslés, lásd disclaimer)*

### 2. Secondary keywords (5-10 db)
| Kulcsszó | Search intent | Becsült nehézség |
|---|---|---|
| ... | ... | ... |

### 3. Long-tail variációk (5-10 db)
| Long-tail kulcsszó | Search intent | Becsült nehézség |
|---|---|---|
| ... | ... | ... |

### 4. Versenyképességi kontextus
Rövid (3-5 mondat) elemzés: milyen tartalom típusok uralják ezt a témát, mire érdemes fókuszálni.

## Disclaimer (kötelező az outputban)

> **Fontos:** Ez az elemzés LLM-tudás alapján készült. A tényleges keresési volumenekhez és versenyképességhez Google Search Console, Ahrefs, SEMrush, vagy Ubersuggest adataira van szükség. Az output **kiindulási lista**, nem helyettesíti az eszközalapú kutatást.

## submit_deliverable hívása

```json
{
  "content_md": "<teljes kulcsszó-kutatás dokumentum>",
  "structured_data": {
    "primary_keyword": "fő kulcsszó",
    "secondary_keywords": ["kw1", "kw2"],
    "longtail_keywords": ["long-tail 1", "long-tail 2"],
    "target_market": "magyar"
  }
}
```

## Amit ne csinálj

- Ne adj meg tényleges keresési volumen számokat (nincs valós adat)
- Ne hagyj el disclaimer-t — az LLM-becslés vs. valós adat megkülönböztetés kötelező
- Ne javasolj már a keyword_bank-ban szereplő kulcsszavakat (ha a bank tartalmaz adatot): `{{memory.seo_keyword_bank.keywords}}`
```

- [ ] **Lépés 2: Hozd létre az on_page_seo_recommendation.md recipe-t**

```markdown
<!-- packages/server/seed/skills/seo-specialist/on_page_seo_recommendation.md -->
---
name: on_page_seo_recommendation
when_to_use: Egy meglévő landing page vagy blogcikk on-page SEO-ját kell elemezni és javítani
---

Az on-page SEO recommendation **MAGYAR NYELVŰ**.

## Output struktúra

### 1. Meta elemek
- **Meta title javasla** (3 variáció, max 60 karakter, tartalmazza a target keyword-öt)
- **Meta description javaslat** (2 variáció, max 160 karakter, tartalmazza a keyword-öt, cselekvésre ösztönöz)

### 2. H-struktúra elemzés
- Jelenlegi H1 (ha inputban van): megfelelő-e?
- Javasolt H1 (ha módosítani kell)
- H2 javaslatok (min. 3 H2, keyword és variánsok természetes elhelyezése)

### 3. Tartalmi hiányosságok
- Mi hiányzik a cikkből, amit a felhasználó keres ennél a keyword-nél?
- Javasolt belső linkek (ha a brief tartalmaz utalást más oldalakra)

### 4. Képek és médiatartalom
- Alt text javaslatok (ha relevánsan képekről van szó)

## submit_deliverable hívása

```json
{
  "content_md": "<teljes on-page SEO ajánlás dokumentum>",
  "structured_data": {
    "target_keyword": "kulcsszó",
    "meta_title_variants": ["Variant 1", "Variant 2", "Variant 3"],
    "meta_description_variants": ["Desc 1", "Desc 2"],
    "suggested_h1": "Javasolt H1"
  }
}
```

## Amit ne csinálj

- Ne ígérj konkrét ranking-javulást (nincs garancia)
- Ne hagyj el meta title/description variációkat — ezek a legfontosabb actionable output-ok
```

- [ ] **Lépés 3: Hozd létre a content_brief_seo.md recipe-t**

```markdown
<!-- packages/server/seed/skills/seo-specialist/content_brief_seo.md -->
---
name: content_brief_seo
when_to_use: SEO-orientált content briefet kell készíteni Copywriter-nek — mikor a Director SEO-fókuszú cikket akar íratni
---

Az SEO content brief **MAGYAR NYELVŰ**.

## Output struktúra

### 1. Kulcsszó stratégia
- Primary keyword
- Secondary keywords (3-5 db)
- Search intent (informational / commercial / transactional)

### 2. Javasolt struktúra
- H1 javaslat
- H2-k listája (min. 4, max 8)
- Opcionális H3 pontok ahol szükséges

### 3. Tartalmi követelmények
- Javasolt szóhossz: ___
- Kötelező elemek: FAQ, táblázatok, példák, belső linkek (mit érdemes hozzáadni)
- Kerülendők: mi rontja az SEO-t ennél a témánál

### 4. Versenytárs-elemzés pontok
3-5 megfigyelés arról, milyen tartalmak rankolnak most ennél a témánál, és mi az a hozzáadott érték amit egy jó cikk adhat.

## submit_deliverable hívása

```json
{
  "content_md": "<teljes content brief dokumentum>",
  "structured_data": {
    "primary_keyword": "fő kulcsszó",
    "content_type": "article",
    "suggested_word_count": 1800,
    "h2_outline": ["H2 1", "H2 2", "H2 3"]
  }
}
```

## Amit ne csinálj

- Ne írj a Copywriter helyett tényleges cikket — ez egy brief, nem a végső tartalom
- Ne hagyj ki H-struktúra javaslatot — ez az SEO brief legfontosabb eleme
```

- [ ] **Lépés 4: Hozd létre a technikai_seo_audit.md recipe-t**

```markdown
<!-- packages/server/seed/skills/seo-specialist/technikai_seo_audit.md -->
---
name: technikai_seo_audit
when_to_use: Egy weboldal technikai SEO auditját kell elvégezni és strukturált checklist-et adni
---

A technikai SEO audit **MAGYAR NYELVŰ**.

## Fontos disclaimer (az output ELEJÉN kötelező megjeleníteni)

> **Figyelem:** Ez az audit LLM-elemzés alapján készül, nem valós crawl-adat. Pontos adatokhoz Google Search Console, PageSpeed Insights, és Screaming Frog (vagy hasonló eszköz) szükséges. Az alábbi checklist **kiindulási lista** — nem helyettesíti az eszközalapú technikai auditot.

## Audit területek (mindegyikhez: státusz + javaslat + prioritás)

Prioritás: 🔴 Kritikus | 🟡 Közepes | 🟢 Alacsony

### 1. Site speed és Core Web Vitals
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- FID / INP (interaktivitás)
- Képoptimalizálás (WebP, lazy loading)

### 2. Indexálhatóság
- robots.txt — tilt-e fontos oldalakat?
- Sitemap.xml — létezik, elérhető, naprakész?
- Noindex tag-ek — helyesen vannak-e alkalmazva?

### 3. Mobile usability
- Responsive design
- Érintési célpontok mérete
- Viewport meta tag

### 4. Structured data (schema.org)
- Megfelelő schema típus az oldalhoz?
- Rich snippet lehetőségek (FAQ, Article, Product, stb.)

### 5. Crawl issues
- Törött linkek (404-es oldalak)
- Redirect chain-ek (3+ redirect lánc)
- Kanonikus URL-ek konzisztenciája

### 6. HTTPS és biztonság
- Mixed content (HTTP erőforrások HTTPS oldalon)
- SSL tanúsítvány lejárata

### 7. URL struktúra
- Slash konzisztencia
- Ékezetmentes, kötőjeles URL-ek
- Túl mélyen beágyazott oldalak

## submit_deliverable hívása

```json
{
  "content_md": "<teljes audit checklist dokumentum>",
  "structured_data": {
    "url_audited": "https://...",
    "critical_issues": ["issue1", "issue2"],
    "high_priority_count": 2,
    "medium_priority_count": 4,
    "low_priority_count": 5
  }
}
```

## Amit ne csinálj

- Soha ne hagyj el disclaimer-t az output elejéről — kötelező
- Ne állítsd, hogy valós adatok alapján auditálsz, ha az input csak URL
- Ne adj meg konkrét PageSpeed Insights pontszámokat (nincs valós mérés)
```

- [ ] **Lépés 5: Hozd létre az seo_keyword_bank.md memory template-t**

```markdown
<!-- packages/server/seed/memory/seo_keyword_bank.md -->
---
keywords:
  - keyword: "growthframe"
    status: "ranking"
    content_url: null
  - keyword: "marketing automatizálás"
    status: "targeting"
    content_url: null

competitor_keywords: []

covered_topics: []
---

# SEO kulcsszó-bank

Töltsd ki a fenti frontmatter-t a GrowthFrame SEO stratégiájával.

**keywords:** Már lefedett vagy célzott kulcsszavak. A SEO Specialist ezeket nem fogja újra javasolni.

**competitor_keywords:** Versenytársak kulcsszavai amiket megfigyelünk.

**covered_topics:** Témakörök amiről már van tartalom — kerülendő duplikálás.
```

- [ ] **Lépés 6: Futtasd az összes tesztet**

```bash
cd packages/server && npx vitest run
```
Expected: PASS

- [ ] **Lépés 7: TS check**

```bash
cd packages/server && npx tsc --noEmit
cd packages/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Lépés 8: Commit**

```bash
git add packages/server/src/agents/config.test.ts \
  packages/server/seed/skills/seo-specialist/ \
  packages/server/seed/memory/seo_keyword_bank.md
git commit -m "feat(server): SEO Specialist role — skills, memory template"
```

---

## Task 7: Brand Voice Guardian — DB schema és migration

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Create: `packages/server/drizzle/0003_deliverable_reviews.sql`
- Modify: `packages/server/drizzle/meta/_journal.json`

*Megjegyzés: a `deliverableReviews` tábla FK-ja NO CASCADE — összhangban a projekt FK policy-val (schema.ts fejléc megjegyzés). A spec ON DELETE CASCADE-et javasolt, de a projekt konvenció elsőbbséget élvez.*

- [ ] **Lépés 1: Add hozzá a deliverableReviews táblát a schema.ts-hez**

```typescript
// packages/server/src/db/schema.ts — az utolsó tábla után add hozzá:

export const deliverableReviews = sqliteTable('deliverable_reviews', {
  id: text('id').primaryKey(),
  deliverableId: text('deliverable_id').notNull().references(() => deliverables.id),
  reviewerRole: text('reviewer_role').notNull(),
  score: integer('score').notNull(),
  comments: text('comments').notNull(),     // JSON stringified
  suggestions: text('suggestions').notNull(), // JSON stringified
  summary: text('summary').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  byDeliverable: index('idx_reviews_deliverable').on(t.deliverableId),
}));
```

Valamint frissítsd a `delegations.toAgent` enum-ját (TypeScript-szintű ellenőrzés, SQLite nem enforceol):

```typescript
// packages/server/src/db/schema.ts — delegations tábla toAgent mezője:
toAgent: text('to_agent', {
  enum: ['copywriter', 'social-manager', 'paid-specialist', 'email-marketer', 'seo-specialist']
}).notNull(),
```

- [ ] **Lépés 2: Hozd létre a migration SQL-t**

```sql
-- packages/server/drizzle/0003_deliverable_reviews.sql
CREATE TABLE `deliverable_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `deliverable_id` text NOT NULL REFERENCES `deliverables`(`id`),
  `reviewer_role` text NOT NULL,
  `score` integer NOT NULL,
  `comments` text NOT NULL,
  `suggestions` text NOT NULL,
  `summary` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE INDEX `idx_reviews_deliverable` ON `deliverable_reviews` (`deliverable_id`);
```

- [ ] **Lépés 3: Frissítsd a _journal.json-t**

```json
// packages/server/drizzle/meta/_journal.json — adj hozzá a entries tömb végére:
{
  "idx": 3,
  "version": "6",
  "when": 1746216000000,
  "tag": "0003_deliverable_reviews",
  "breakpoints": true
}
```

- [ ] **Lépés 4: Futtasd a schema tesztet**

```bash
cd packages/server && npx vitest run src/db/schema.test.ts src/db/index.test.ts
```
Expected: PASS (migration lefut, tábla létrejön)

- [ ] **Lépés 5: Commit**

```bash
git add packages/server/src/db/schema.ts \
  packages/server/drizzle/0003_deliverable_reviews.sql \
  packages/server/drizzle/meta/_journal.json
git commit -m "feat(db): deliverable_reviews tábla + migration 0003"
```

---

## Task 8: Brand Voice Guardian — submit_review tool

**Files:**
- Create: `packages/server/src/tools/submit-review.ts`
- Create: `packages/server/src/tools/submit-review.test.ts`

- [ ] **Lépés 1: Írj failing tesztet**

```typescript
// packages/server/src/tools/submit-review.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { makeSubmitReviewTool } from './submit-review.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

beforeEach(async () => {
  events.length = 0;
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.chatThreads).values({ id: 'thr_1', clientSlug: 'default', title: 't', archivedAt: null });
  await db.insert(schema.briefs).values({
    id: 'br_1', clientSlug: 'default', sourceThreadId: 'thr_1', contentMd: '{}',
    status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now(),
  });
  await db.insert(schema.delegations).values({
    id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director',
    toAgent: 'copywriter', payloadJson: '{}', status: 'complete', requestedAt: Date.now(), completedAt: Date.now(),
  });
  await db.insert(schema.deliverables).values({
    id: 'dlv_1', delegationId: 'del_1', clientSlug: 'default', campaignId: null,
    type: 'blog_post', status: 'awaiting_approval',
    currentRevisionId: null, createdAt: Date.now(), updatedAt: Date.now(),
  });
});

describe('submit_review tool', () => {
  it('ments review-t a deliverable_reviews táblába és emittál eventet', async () => {
    const tool = makeSubmitReviewTool({ db, broker, deliverableId: 'dlv_1' });
    const r = await tool.execute({
      score: 7,
      comments: [{ quote: 'forradalmasít', issue: 'tiltott szó', severity: 'error' }],
      suggestions: [{ original: 'forradalmasít', suggested: 'alapjaiban változtatja meg', reasoning: 'brand voice: nem forradalmi retorika' }],
      summary: 'Kisebb brand voice eltérés — 1 tiltott szó.',
    });
    expect(r.review_id).toMatch(/^[a-z0-9]+$/);

    const reviews = await db.select().from(schema.deliverableReviews).all();
    expect(reviews).toHaveLength(1);
    expect(reviews[0].deliverableId).toBe('dlv_1');
    expect(reviews[0].score).toBe(7);
    expect(reviews[0].reviewerRole).toBe('brand_voice_guardian');
    const comments = JSON.parse(reviews[0].comments);
    expect(comments[0].severity).toBe('error');
    expect(events.some((e) => e.type === 'review_completed')).toBe(true);
  });
});
```

- [ ] **Lépés 2: Futtasd — failelt-e?**

```bash
cd packages/server && npx vitest run src/tools/submit-review.test.ts
```
Expected: FAIL — `submit-review.ts` nem létezik

- [ ] **Lépés 3: Implementáld a submit-review.ts-t**

```typescript
// packages/server/src/tools/submit-review.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createId } from '@paralleldrive/cuid2';
import { deliverableReviews } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface SubmitReviewContext {
  db: Db;
  broker: Broker;
  deliverableId: string;
}

export interface ReviewComment {
  quote: string;
  issue: string;
  severity: 'info' | 'warn' | 'error';
}

export interface ReviewSuggestion {
  original: string;
  suggested: string;
  reasoning: string;
}

export interface SubmitReviewInput {
  score: number;
  comments: ReviewComment[];
  suggestions: ReviewSuggestion[];
  summary: string;
}

export function makeSubmitReviewTool(ctx: SubmitReviewContext) {
  return {
    name: 'submit_review',
    description: 'Add be a brand voice review-t. A deliverable szövegét átnézted, most küldd be a strukturált visszajelzést score-ral, megjegyzésekkel és javaslatokkal.',
    inputSchema: {
      type: 'object',
      properties: {
        score: { type: 'number', description: '1-10 közötti pontszám. 1-3: jelentős eltérés. 4-6: részleges eltérés. 7-8: kisebb finomítások. 9-10: brand voice OK.' },
        comments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              quote: { type: 'string', description: 'Az érintett mondat/kifejezés a deliverable szövegéből.' },
              issue: { type: 'string', description: 'Mi a probléma röviden.' },
              severity: { type: 'string', enum: ['info', 'warn', 'error'] },
            },
            required: ['quote', 'issue', 'severity'],
          },
        },
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              original: { type: 'string' },
              suggested: { type: 'string' },
              reasoning: { type: 'string' },
            },
            required: ['original', 'suggested', 'reasoning'],
          },
        },
        summary: { type: 'string', description: '1-2 mondatos összefoglaló a review eredményéről.' },
      },
      required: ['score', 'comments', 'suggestions', 'summary'],
    },
    execute: async (input: SubmitReviewInput) => {
      const id = createId();
      await ctx.db.insert(deliverableReviews).values({
        id,
        deliverableId: ctx.deliverableId,
        reviewerRole: 'brand_voice_guardian',
        score: input.score,
        comments: JSON.stringify(input.comments),
        suggestions: JSON.stringify(input.suggestions),
        summary: input.summary,
        createdAt: Date.now(),
      });
      ctx.broker.emit({ type: 'review_completed', review_id: id, deliverable_id: ctx.deliverableId });
      return { review_id: id };
    },
  };
}
```

- [ ] **Lépés 4: Futtasd — PASS kell**

```bash
cd packages/server && npx vitest run src/tools/submit-review.test.ts
```
Expected: PASS

- [ ] **Lépés 5: Commit**

```bash
git add packages/server/src/tools/submit-review.ts packages/server/src/tools/submit-review.test.ts
git commit -m "feat(server): submit_review tool a Brand Voice Guardian-hoz"
```

---

## Task 9: Brand Voice Guardian — dispatchReview + SpawnInput frissítés

**Files:**
- Create: `packages/server/src/broker/review-dispatcher.ts`
- Create: `packages/server/src/broker/review-dispatcher.test.ts`
- Modify: `packages/server/src/agents/factory.ts`

- [ ] **Lépés 1: Írj failing tesztet a review-dispatcher-hez**

```typescript
// packages/server/src/broker/review-dispatcher.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatchReview } from './review-dispatcher.js';
import * as schema from '../db/schema.js';

vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: class FakeAgent {
    constructor(public opts: any) {}
    async prompt(_: string) {
      // simulate Guardian calling submit_review via the real tool
    }
  },
}));

let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: vi.fn() };

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-rd-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });

  // Seed a deliverable with a revision artifact
  await db.insert(schema.chatThreads).values({ id: 'thr_1', clientSlug: 'default', title: 't', archivedAt: null });
  await db.insert(schema.briefs).values({
    id: 'br_1', clientSlug: 'default', sourceThreadId: 'thr_1', contentMd: '{}',
    status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now(),
  });
  await db.insert(schema.delegations).values({
    id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director',
    toAgent: 'copywriter', payloadJson: '{}', status: 'complete', requestedAt: Date.now(), completedAt: Date.now(),
  });
  await db.insert(schema.deliverables).values({
    id: 'dlv_1', delegationId: 'del_1', clientSlug: 'default', campaignId: null,
    type: 'blog_post', status: 'awaiting_approval',
    currentRevisionId: 'rev_1', createdAt: Date.now(), updatedAt: Date.now(),
  });
  // Artifact fájl
  const artDir = join(baseDir, 'artifacts', 'clients', 'default', 'dlv_1');
  mkdirSync(artDir, { recursive: true });
  const artPath = join(artDir, 'rev_001.md');
  writeFileSync(artPath, '# Test blog poszt\nEz egy teszt tartalom.');
  await db.insert(schema.deliverableRevisions).values({
    id: 'rev_1', deliverableId: 'dlv_1', revisionNo: 1,
    artifactPath: artPath, createdByAgent: 'copywriter', feedbackNote: null, ts: Date.now(),
  });
  broker.emit.mockClear();
});

describe('dispatchReview', () => {
  it('spawns Guardian agent and emits review_started event', async () => {
    await dispatchReview({ db, broker, dataDir: baseDir, deliverableId: 'dlv_1' });
    expect(broker.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review_started', deliverable_id: 'dlv_1' })
    );
  });

  it('throws when deliverable not found', async () => {
    await expect(dispatchReview({ db, broker, dataDir: baseDir, deliverableId: 'nonexistent' }))
      .rejects.toThrow(/deliverable not found/);
  });
});
```

- [ ] **Lépés 2: Futtasd — failelt-e?**

```bash
cd packages/server && npx vitest run src/broker/review-dispatcher.test.ts
```
Expected: FAIL — `review-dispatcher.ts` nem létezik

- [ ] **Lépés 3: Frissítsd a factory.ts SpawnInput-ját és a submit_review case-t**

```typescript
// packages/server/src/agents/factory.ts — SpawnInput interface bővítve:
export interface SpawnInput {
  db: Db;
  broker: Broker;
  dataDir: string;
  clientSlug: string;
  role: RoleSlug;
  threadId?: string;
  delegationId?: string;
  deliverableId?: string;    // NEW — Brand Voice Guardian-hoz
  deliverableType?: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
  authManager?: AuthManager;
}

// buildToolsForRole switch-be add hozzá a submit_review case-t (import a tool-t is):
import { makeSubmitReviewTool } from '../tools/submit-review.js';

// ...a switch case-ek közé:
case 'submit_review':
  if (!input.deliverableId) throw new Error('submit_review needs deliverableId');
  tools.push(makeSubmitReviewTool({
    db: input.db, broker: input.broker, deliverableId: input.deliverableId,
  }) as RawTool);
  break;
```

- [ ] **Lépés 4: Implementáld a review-dispatcher.ts-t**

```typescript
// packages/server/src/broker/review-dispatcher.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { deliverables, deliverableRevisions } from '../db/schema.js';
import { spawnAgent } from '../agents/factory.js';
import { AuthManager } from '../providers/auth.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface DispatchReviewInput {
  db: Db;
  broker: Broker;
  dataDir: string;
  deliverableId: string;
  authManager?: AuthManager;
}

export async function dispatchReview(input: DispatchReviewInput): Promise<void> {
  const rows = await input.db.select().from(deliverables)
    .where(eq(deliverables.id, input.deliverableId)).all();
  if (rows.length === 0) throw new Error(`deliverable not found: ${input.deliverableId}`);
  const deliverable = rows[0];

  // Lehúzza a legfrissebb revision artifact tartalmát
  let artifactContent = '(tartalom nem érhető el)';
  if (deliverable.currentRevisionId) {
    const revRows = await input.db.select().from(deliverableRevisions)
      .where(eq(deliverableRevisions.id, deliverable.currentRevisionId)).all();
    if (revRows.length > 0 && revRows[0].artifactPath) {
      try {
        artifactContent = await readFile(revRows[0].artifactPath, 'utf-8');
      } catch {
        // artifact file hiányzik — folytatás üres tartalommal
      }
    }
  }

  input.broker.emit({ type: 'review_started', deliverable_id: input.deliverableId });

  const { agent } = await spawnAgent({
    db: input.db,
    broker: input.broker,
    dataDir: input.dataDir,
    clientSlug: deliverable.clientSlug,
    role: 'brand-voice-guardian',
    deliverableId: input.deliverableId,
    authManager: input.authManager,
  });

  const prompt = [
    '# Brand Voice Ellenőrzés',
    '',
    `Deliverable típus: ${deliverable.type}`,
    '',
    '## Deliverable szövege',
    artifactContent,
    '',
    'Ellenőrizd a fenti szöveget a brand voice guidelines alapján.',
    'Hívd meg a submit_review tool-t a strukturált visszajelzéssel.',
  ].join('\n');

  agent.prompt(prompt).catch((err) => {
    input.broker.emit({ type: 'error', source: 'guardian', deliverable_id: input.deliverableId, message: String(err) });
  });
}
```

- [ ] **Lépés 5: Futtasd a tesztet — PASS kell**

```bash
cd packages/server && npx vitest run src/broker/review-dispatcher.test.ts
```
Expected: PASS

- [ ] **Lépés 6: Futtasd az összes tesztet**

```bash
cd packages/server && npx vitest run
```
Expected: PASS

- [ ] **Lépés 7: Commit**

```bash
git add packages/server/src/broker/review-dispatcher.ts \
  packages/server/src/broker/review-dispatcher.test.ts \
  packages/server/src/agents/factory.ts
git commit -m "feat(server): dispatchReview + submit_review wiring a Guardian-hoz"
```

---

## Task 10: Brand Voice Guardian — REST endpoint

**Files:**
- Modify: `packages/server/src/server/routes/deliverables.ts`
- Modify: `packages/server/src/server/routes/deliverables.test.ts`
- Modify: `packages/server/src/server/index.ts`

- [ ] **Lépés 1: Adj hozzá failing tesztet a deliverables.test.ts-hez**

A meglévő `deliverables.test.ts` mintájára — `app`, `seedDeliverable()` és `d_1` id már elérhető a fájlban:

```typescript
// packages/server/src/server/routes/deliverables.test.ts — a describe blokk végére add hozzá:

it('POST /:id/review — 200 + ok:true', async () => {
  await seedDeliverable();
  const res = await app.inject({ method: 'POST', url: '/api/deliverables/d_1/review' });
  expect(res.statusCode).toBe(200);
  expect(res.json().ok).toBe(true);
  expect(events.some((e) => e.type === 'review_started')).toBe(true);
});

it('POST /:id/review — 404 for missing deliverable', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/deliverables/nonexistent/review' });
  expect(res.statusCode).toBe(404);
});

it('GET /:id/reviews — returns empty array when no reviews', async () => {
  await seedDeliverable();
  const res = await app.inject({ method: 'GET', url: '/api/deliverables/d_1/reviews' });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual([]);
});
```

- [ ] **Lépés 2: Futtasd — failelt-e?**

```bash
cd packages/server && npx vitest run src/server/routes/deliverables.test.ts
```
Expected: FAIL — review endpoint nem létezik

- [ ] **Lépés 3: Bővítsd a DeliverablesRoutesOpts-t és add hozzá az endpointot**

```typescript
// packages/server/src/server/routes/deliverables.ts — módosítandó részek:

// Import a review-dispatcher-ből:
import { dispatchReview } from '../../broker/review-dispatcher.js';
import type { AuthManager } from '../../providers/auth.js';
// Import az új táblából:
import { deliverableReviews } from '../../db/schema.js';
// Import a desc-hez ha még nincs:
// desc már importálva van

// Opts interface bővítve (authManager optional — a meglévő tesztek nem adják át):
export interface DeliverablesRoutesOpts {
  db: Db;
  broker: Broker;
  dataDir: string;
  n8nWebhookUrl: string | null;
  authManager?: AuthManager;  // NEW — optional, Guardian fallback: getEnvApiKey
}

// Az async (app, opts) => { ... } blokk végére, a többi route után add hozzá:

app.post<{ Params: { id: string } }>('/api/deliverables/:id/review', async (req, reply) => {
  const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
  if (!d) return reply.code(404).send({ error: 'not_found' });

  void dispatchReview({
    db, broker, dataDir, deliverableId: req.params.id, authManager: opts.authManager,
  }).catch((err) => {
    broker.emit({ type: 'error', source: 'guardian', message: String(err) });
  });

  return reply.send({ ok: true });
});

app.get<{ Params: { id: string } }>('/api/deliverables/:id/reviews', async (req, reply) => {
  const rows = await db.select().from(deliverableReviews)
    .where(eq(deliverableReviews.deliverableId, req.params.id))
    .orderBy(desc(deliverableReviews.createdAt))
    .all();
  return rows.map((r) => ({
    ...r,
    comments: JSON.parse(r.comments),
    suggestions: JSON.parse(r.suggestions),
  }));
});
```

- [ ] **Lépés 4: Frissítsd a server/index.ts deliverablesRoutes regisztrációját**

```typescript
// packages/server/src/server/index.ts — módosítandó rész:
await app.register(deliverablesRoutes, {
  db,
  broker: flatBroker,
  dataDir: opts.dataDir,
  n8nWebhookUrl: opts.n8nWebhookUrl,
  authManager: opts.authManager,  // NEW
});
```

- [ ] **Lépés 5: Futtasd a tesztet**

```bash
cd packages/server && npx vitest run src/server/routes/deliverables.test.ts
```
Expected: PASS

- [ ] **Lépés 6: Futtasd az összes tesztet**

```bash
cd packages/server && npx vitest run
```
Expected: PASS

- [ ] **Lépés 7: TS check**

```bash
cd packages/server && npx tsc --noEmit
```
Expected: no errors

- [ ] **Lépés 8: Commit**

```bash
git add packages/server/src/server/routes/deliverables.ts \
  packages/server/src/server/routes/deliverables.test.ts \
  packages/server/src/server/index.ts
git commit -m "feat(server): POST /api/deliverables/:id/review + GET reviews endpoint"
```

---

## Task 11: Brand Voice Guardian — config, transform-context test frissítés

**Files:**
- Modify: `packages/server/src/agents/config.test.ts`
- Modify: `packages/server/src/agents/transform-context.test.ts`

- [ ] **Lépés 1: Frissítsd a config.test.ts-t — várj 7 role-t**

```typescript
it('has exactly 7 roles', () => {    // volt: 6
  const slugs = Object.keys(ROLE_CONFIGS);
  expect(slugs.sort()).toEqual([
    'brand-voice-guardian', 'copywriter', 'director',
    'email-marketer', 'paid-specialist', 'seo-specialist', 'social-manager'
  ]);
});

it('brand-voice-guardian is transient and has submit_review tool', () => {
  const c = getRoleConfig('brand-voice-guardian');
  expect(c.lifecycle).toBe('transient');
  expect(c.tools).toContain('submit_review');
  expect(c.tools).toContain('read_memory');
  expect(c.produces).toHaveLength(0);
});
```

- [ ] **Lépés 2: Adj hozzá tesztet a transform-context.test.ts-hez**

```typescript
// packages/server/src/agents/transform-context.test.ts — a meglévő tesztek után:
it('email-marketer gets profile + brand_voice (email_list_segments skip if missing)', async () => {
  const out = await renderMemoryContext(dir, 'default', 'email-marketer');
  expect(out).toContain('memory/profile.md');
  expect(out).toContain('memory/brand_voice.md');
  expect(out).not.toContain('email_list_segments');  // fájl nem létezik a test dirben
});

it('brand-voice-guardian gets profile + brand_voice_guidelines (skip if missing)', async () => {
  const out = await renderMemoryContext(dir, 'default', 'brand-voice-guardian');
  expect(out).toContain('memory/profile.md');
  expect(out).not.toContain('brand_voice_guidelines');  // fájl nem létezik a test dirben
});
```

- [ ] **Lépés 3: Futtasd**

```bash
cd packages/server && npx vitest run src/agents/config.test.ts src/agents/transform-context.test.ts
```
Expected: PASS (config.ts-ben már benne van a brand-voice-guardian Task 3-ból)

- [ ] **Lépés 4: Commit**

```bash
git add packages/server/src/agents/config.test.ts packages/server/src/agents/transform-context.test.ts
git commit -m "test(server): config és transform-context tesztek frissítve 7 role-ra"
```

---

## Task 12: Brand Voice Guardian — seed fájlok

**Files:**
- Create: `packages/server/seed/skills/brand-voice-guardian/brand_voice_ellenorzes.md`
- Create: `packages/server/seed/memory/brand_voice_guidelines.md`

- [ ] **Lépés 1: Hozd létre a brand_voice_ellenorzes.md skill recipe-t**

```markdown
<!-- packages/server/seed/skills/brand-voice-guardian/brand_voice_ellenorzes.md -->
---
name: brand_voice_ellenorzes
when_to_use: Egy meglévő deliverable szövegét kell összevetni a brand voice guidelines-szal és strukturált review-t adni
---

A brand voice review **MAGYAR NYELVŰ** outputot ad.

## Feladatod

Elemezd a kapott deliverable szövegét a `<memory>` blokkban lévő `brand_voice_guidelines.md` alapján.

Figyelj különösen:
1. **Tiltott kifejezések** — megjelenik-e valamelyik a szövegben?
2. **Hangnem konzisztencia** — megfelel-e a `tone` elvárásoknak?
3. **Kötelező elemek** — szerepel-e minden aminek szerepelnie kell?
4. **Példamondatok mintáját** — közelebb van-e a `pelda_jo_mondatok` vagy a `pelda_rossz_mondatok` stílusához?

## Score kalibrálás

- **9-10:** Nincs eltérés. Brand voice-konzisztens.
- **7-8:** 1-2 kisebb finomítás kellene, de alapvetően OK.
- **4-6:** Több helyen eltér. Visszaküldés javasolt.
- **1-3:** Jelentős brand voice hiba. Azonnali visszaküldés.

## submit_review hívása

Hívd meg a `submit_review` tool-t az elemzés után:

```json
{
  "score": 7,
  "comments": [
    {
      "quote": "az érintett mondat a szövegből",
      "issue": "Tiltott kifejezés: 'forradalmasít'",
      "severity": "error"
    }
  ],
  "suggestions": [
    {
      "original": "forradalmasítja a piacot",
      "suggested": "alapjaiban alakítja át a döntéshozatalt",
      "reasoning": "A brand voice nem forradalmi retorikát használ, hanem konkrét, értékalapú megfogalmazást."
    }
  ],
  "summary": "1 tiltott szó és 2 hangnem-eltérés. Kisebb finomítások ajánlottak."
}
```

## Amit ne csinálj

- Ne írj subjektív véleményt guidelines alap nélkül — minden észrevétel legyen visszavezethető a guidelines-ra
- Ne legyen üres a comments tömb ha az eltérés nyilvánvaló (score < 8)
- Ne legyen üres a suggestions tömb ha comments-ben van `error` severity-jű elem
- Ne add le a review-t `submit_review` hívás nélkül
```

- [ ] **Lépés 2: Hozd létre a brand_voice_guidelines.md memory template-t**

```markdown
<!-- packages/server/seed/memory/brand_voice_guidelines.md -->
---
tone:
  - "professzionális, de közvetlen"
  - "tegező — a GrowthFrame tegezi az ügyfeleit"
  - "magabiztos, de nem arrogáns"
  - "konkrét, számokon és példákon alapuló"

stilus:
  - "rövid, scannable mondatok"
  - "konkrét példák, nem absztrakciók"
  - "magyar nyelv; idegen szakszavak csak indokolt esetben (pl. CTR, CPC, ROAS)"

tiltott_kifejezesek:
  - "forradalmasít"
  - "next-level"
  - "game-changer"
  - "páratlan"
  - "egyedülálló lehetőség"

kotelezo_elemek:
  - "CTA mindig konkrét cselekvés (ne: 'tudj meg többet', igen: 'foglalj demo időpontot')"

pelda_jo_mondatok:
  - "Az MDIP a magyar SMB-knek készül, akik napi szinten döntenek marketing-költésről."
  - "Ha 3 hirdetési platformon futsz egyszerre, a konszolidált riport 40%-kal csökkenti a reporting időt."
  - "Töltsd ki az alábbi űrlapot, és 24 órán belül felvesszük veled a kapcsolatot."

pelda_rossz_mondatok:
  - "Forradalmasítjuk a marketing decision intelligence-t."
  - "Páratlan, game-changing megoldásunk next-level élményt nyújt."
  - "Fedezd fel a lehetőségeket!"
---

# Brand Voice Guidelines — GrowthFrame

**Figyelem:** Ez a template kitöltésre szorul! Az aktuálisan lévő értékek placeholder-ek.

## Kalibrálási követelmény

A Brand Voice Guardian megbízható működéséhez legalább:
- **5-10 jó példamondat** (`pelda_jo_mondatok`)
- **5-10 rossz példamondat** (`pelda_rossz_mondatok`)
- **Tiltott kifejezések teljes listája** (`tiltott_kifejezesek`)

szükséges. Bővítsd a frontmatter-t GrowthFrame valódi tartalmából vett példákkal mielőtt élesben használod.

## Egyéb irányelvek (szabadszöveges)

Ide kerülhetnek azok az elvárások, amelyek nem férnek bele a frontmatter struktúrába — pl. specifikus témaköröknél alkalmazandó speciális szabályok.
```

- [ ] **Lépés 3: Futtasd az összes tesztet**

```bash
cd packages/server && npx vitest run
```
Expected: PASS

- [ ] **Lépés 4: Commit**

```bash
git add packages/server/seed/skills/brand-voice-guardian/ \
  packages/server/seed/memory/brand_voice_guidelines.md
git commit -m "feat(server): Brand Voice Guardian skill recipe + memory template"
```

---

## Task 13: Frontend — BrandVoiceReviewPanel + DeliverableDetail

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Create: `packages/web/src/components/BrandVoiceReviewPanel.tsx`
- Modify: `packages/web/src/views/DeliverableDetail.tsx`

- [ ] **Lépés 1: Bővítsd az api.ts-t reviewsApi-val**

```typescript
// packages/web/src/lib/api.ts — a fájl végére add hozzá:

// -------------------------
// Reviews
// -------------------------
export interface ReviewComment {
  quote: string;
  issue: string;
  severity: 'info' | 'warn' | 'error';
}

export interface ReviewSuggestion {
  original: string;
  suggested: string;
  reasoning: string;
}

export interface ReviewRow {
  id: string;
  deliverableId: string;
  reviewerRole: string;
  score: number;
  comments: ReviewComment[];
  suggestions: ReviewSuggestion[];
  summary: string;
  createdAt: number;
}

export const reviewsApi = {
  trigger: (deliverableId: string): Promise<{ ok: true }> =>
    post(`/api/deliverables/${deliverableId}/review`),
  list: (deliverableId: string): Promise<ReviewRow[]> =>
    fetch(`/api/deliverables/${deliverableId}/reviews`).then(json),
};
```

- [ ] **Lépés 2: Hozd létre a BrandVoiceReviewPanel.tsx-t**

```tsx
// packages/web/src/components/BrandVoiceReviewPanel.tsx
import { useState, useEffect } from 'react';
import { reviewsApi, type ReviewRow, type ReviewComment } from '../lib/api.js';

const SCORE_CONFIG: { max: number; label: string; cls: string }[] = [
  { max: 3,  label: 'Jelentős eltérés',   cls: 'bg-red-100 text-red-700' },
  { max: 6,  label: 'Részleges eltérés',  cls: 'bg-yellow-100 text-yellow-700' },
  { max: 8,  label: 'Kisebb finomítások', cls: 'bg-green-100 text-green-700' },
  { max: 10, label: 'Brand voice OK',     cls: 'bg-success-soft text-success-deep' },
];

function scoreBadge(score: number) {
  const cfg = SCORE_CONFIG.find((c) => score <= c.max) ?? SCORE_CONFIG[SCORE_CONFIG.length - 1];
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
      {score}/10 — {cfg.label}
    </span>
  );
}

function severityIcon(severity: ReviewComment['severity']) {
  return severity === 'error' ? '🔴' : severity === 'warn' ? '🟡' : 'ℹ️';
}

export function BrandVoiceReviewPanel({ deliverableId }: { deliverableId: string }) {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [triggering, setTriggering] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadReviews = () =>
    reviewsApi.list(deliverableId).then((rows) => {
      setReviews(rows);
      setSelectedIdx(0);
    });

  useEffect(() => { loadReviews(); }, [deliverableId]);

  const handleTrigger = async () => {
    setTriggering(true);
    await reviewsApi.trigger(deliverableId);
    // Poll until new review appears
    let attempts = 0;
    const poll = setInterval(async () => {
      const rows = await reviewsApi.list(deliverableId);
      if (rows.length > (reviews?.length ?? 0) || attempts > 20) {
        setReviews(rows);
        setSelectedIdx(0);
        setTriggering(false);
        clearInterval(poll);
      }
      attempts++;
    }, 2000);
  };

  const current = reviews?.[selectedIdx] ?? null;

  return (
    <div className="mt-6 border border-rule rounded-lg bg-off-white p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ink-1">Brand Voice ellenőrzés</span>
        {reviews && reviews.length > 1 && (
          <select
            className="text-xs border border-rule rounded px-2 py-1 bg-parchment text-ink-2"
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
          >
            {reviews.map((r, i) => (
              <option key={r.id} value={i}>
                {new Date(r.createdAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
              </option>
            ))}
          </select>
        )}
      </div>

      {triggering ? (
        <div className="text-ink-2 text-sm italic">Guardian fut… (max ~30 mp)</div>
      ) : !current ? (
        <div>
          <p className="text-sm text-ink-2 mb-3">Még nem fut brand voice ellenőrzés erre a deliverable-re.</p>
          <button
            className="px-4 py-2 rounded-md text-sm bg-primary text-white hover:bg-primary-hover"
            onClick={handleTrigger}
          >
            Brand Voice ellenőrzés indítása
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-2">
            {scoreBadge(current.score)}
            <span className="text-sm text-ink-2">{current.summary}</span>
          </div>

          <button
            className="text-xs text-primary-hover hover:underline mb-2"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '▲ Részletek elrejtése' : '▼ Részletek megtekintése'}
          </button>

          {expanded && (
            <div className="space-y-4">
              {current.comments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink-2 uppercase tracking-wide mb-2">Észrevételek</p>
                  {current.comments.map((c, i) => (
                    <div key={i} className="mb-2 bg-cream border border-rule rounded p-3 text-sm">
                      <span className="mr-1">{severityIcon(c.severity)}</span>
                      <span className="italic text-ink-2">„{c.quote}"</span>
                      <span className="ml-2 text-ink-1">— {c.issue}</span>
                    </div>
                  ))}
                </div>
              )}

              {current.suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink-2 uppercase tracking-wide mb-2">Javaslatok</p>
                  {current.suggestions.map((s, i) => (
                    <div key={i} className="mb-2 bg-cream border border-rule rounded p-3 text-sm">
                      <div className="text-ink-2 italic line-through mb-1">„{s.original}"</div>
                      <div className="text-ink-1 mb-1">→ „{s.suggested}"</div>
                      <div className="text-xs text-ink-2">{s.reasoning}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <button
              className="text-xs text-ink-2 hover:underline"
              onClick={handleTrigger}
            >
              Újra ellenőrzés
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Lépés 3: Integráld a BrandVoiceReviewPanel-t a DeliverableDetail-be**

```tsx
// packages/web/src/views/DeliverableDetail.tsx — módosítandó részek:

// Import hozzáadva a többi import mellé:
import { BrandVoiceReviewPanel } from '../components/BrandVoiceReviewPanel.js';

// A return-ben, a DeliverableActions után (a </div> zárótag előtt):
{deliverable.status === 'awaiting_approval' && (
  <DeliverableActions deliverableId={deliverable.id} />
)}

<BrandVoiceReviewPanel deliverableId={deliverable.id} />
```

- [ ] **Lépés 4: TS check**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Lépés 5: Commit**

```bash
git add packages/web/src/lib/api.ts \
  packages/web/src/components/BrandVoiceReviewPanel.tsx \
  packages/web/src/views/DeliverableDetail.tsx
git commit -m "feat(web): BrandVoiceReviewPanel a DeliverableDetail view-ban"
```

---

## Task 14: Végső ellenőrzés

**Files:** —

- [ ] **Lépés 1: Futtasd az összes server tesztet**

```bash
cd packages/server && npx vitest run
```
Expected: minden teszt PASS

- [ ] **Lépés 2: TS check mindkét package-ben**

```bash
cd packages/server && npx tsc --noEmit && cd ../web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Lépés 3: Ellenőrizd a seed fájlok struktúráját**

```bash
find packages/server/seed -type f | sort
```
Expected output (ebben a sorrendben):
```
packages/server/seed/memory/brand_voice.md
packages/server/seed/memory/brand_voice_guidelines.md
packages/server/seed/memory/email_list_segments.md
packages/server/seed/memory/ongoing_campaigns.md
packages/server/seed/memory/profile.md
packages/server/seed/memory/seo_keyword_bank.md
packages/server/seed/skills/brand-voice-guardian/brand_voice_ellenorzes.md
packages/server/seed/skills/copywriter/blog_post_writer.md
packages/server/seed/skills/copywriter/email_writer.md
packages/server/seed/skills/director/brief_intake.md
packages/server/seed/skills/director/client_profile_setup.md
packages/server/seed/skills/director/delegate.md
packages/server/seed/skills/email-marketer/drip_sorozat_tervezes.md
packages/server/seed/skills/email-marketer/hirlevel_iras.md
packages/server/seed/skills/email-marketer/transactional_email_szoveg.md
packages/server/seed/skills/paid-specialist/google_ad_copy.md
packages/server/seed/skills/paid-specialist/meta_ad_copy.md
packages/server/seed/skills/seo-specialist/content_brief_seo.md
packages/server/seed/skills/seo-specialist/kulcsszo_kutatas.md
packages/server/seed/skills/seo-specialist/on_page_seo_recommendation.md
packages/server/seed/skills/seo-specialist/technikai_seo_audit.md
packages/server/seed/skills/social-manager/social_post_writer.md
```

- [ ] **Lépés 4: Ellenőrizd a DB migration sorrendet**

```bash
cat packages/server/drizzle/meta/_journal.json
```
Expected: 4 entries (idx 0-3), utolsó tag: `0003_deliverable_reviews`

- [ ] **Lépés 5: Final commit (ha minden zöld)**

```bash
git add .
git commit -m "feat: Wave 1 agentek kész — Email Marketer, SEO Specialist, Brand Voice Guardian"
```

---

## Akceptálási kritériumok ellenőrzőlista (manuális teszt)

A Wave 1 akkor minősül késznek, ha manuálisan is teljesülnek a spec 10. szakaszának kritériumai:

**Email Marketer:**
- [ ] Director "küldjünk hírlevelet X témáról" kérésre `email-marketer` target_specialist-et javasol
- [ ] Approve után Email Marketer deliverable jelenik meg (email típusú, subject+preheader+body+CTA)
- [ ] Deliverable az Approvals queue-ban jóváhagyható, n8n webhook elindul

**SEO Specialist:**
- [ ] Mind a 4 skill legalább 1-1 sikeres deliverable-t produkál
- [ ] `technikai_seo_audit` output tartalmazza a kötelező disclaimer-t

**Brand Voice Guardian:**
- [ ] DeliverableDetail view-ban megjelenik a "Brand Voice ellenőrzés indítása" gomb
- [ ] Klikkelés után max ~30 mp alatt megjelenik a review panel (score, summary, részletek)
- [ ] Review elmentve a `deliverable_reviews` táblában, többször futtatható, history dropdown
- [ ] `brand_voice_guidelines.md` kalibrálva GrowthFrame brand voice-ra (legalább 5-5 jó/rossz példa)

**Architektúra:**
- [ ] `npx vitest run` — minden teszt zöld
- [ ] `npx tsc --noEmit` — mindkét package hibamentes
- [ ] Smoke teszt (meglévő flow-ra regresszió-ellenőrzés): `DATA_DIR=~/.marquee-dev npm run smoke --workspace=packages/server`

---

## Self-review megjegyzések

- **Approvals view szűrés (spec 7.3):** Az `Approvals.tsx` állapot-alapú szűrőt használ, nem role-alapút — ezért ez a spec-pont **no-op**, nem kellett külön task hozzá.
- **authManager a deliverablesRoutes-ban:** optional-ként van definiálva, hogy a meglévő tesztek változtatás nélkül működjenek. A production `server/index.ts` mindig átadja.

---

## Nyitott kérdések / nem scope-ban

- Memory proposal flow bővítése új role-okra: külön spec
- Guardian auto-trigger (operátor-trigger → automatikus): külön spec
- Paid Specialist Meta/Google Ads API push: külön spec
- Wave 2 (Content Strategist, Analytics Reporter): külön spec
