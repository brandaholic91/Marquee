# Capability Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brand-konzisztens kollaboráció — `brand:voice-guidelines` minden deliverable-gyártó role kontextusába, SEO→Copywriter handoff operátor review-val, `seo_article_writer` skill a Copywriternek.

**Architecture:** 4 fázis egymásra épülő sorrendben: (0) skill loader refactor + file renames, (1) brand voice memory injection, (2) handoff (DB + endpoint + frontend), (3) seo_article_writer skill + Director update. Minden fázis külön commitban, önállóan tesztelhető.

**Tech Stack:** Node.js 22 LTS, TypeScript, Fastify 5, Drizzle 0.36 + better-sqlite3, React 19, Zustand, react-router-dom 7

**Spec:** `docs/superpowers/specs/2026-04-30-marquee-capability-wave-1-design.md`
**Kiegészítő design:** `docs/superpowers/specs/2026-04-30-seo-copywriter-handoff-design.md`

---

## File map

**Létrehozandó:**
- `packages/server/seed/skills/_common/brand_voice_instruction.md`
- `packages/server/seed/skills/copywriter/seo_article_writer.md`
- `packages/server/drizzle/0005_handoff.sql`

**Átnevezendő (seed/skills):**
- `brand-voice-guardian/brand_voice_ellenorzes.md` → `brand_voice_review.md`
- `email-marketer/drip_sorozat_tervezes.md` → `drip_sequence_planning.md`
- `email-marketer/hirlevel_iras.md` → `newsletter_writer.md`
- `email-marketer/transactional_email_szoveg.md` → `transactional_email_writer.md`
- `seo-specialist/kulcsszo_kutatas.md` → `keyword_research.md`
- `seo-specialist/technikai_seo_audit.md` → `technical_seo_audit.md`

**Módosítandó:**
- `packages/server/src/db/schema.ts`
- `packages/server/src/agents/config.ts`
- `packages/server/src/tools/submit-deliverable.ts`
- `packages/server/src/agents/factory.ts`
- `packages/server/src/tools/propose-brief.ts`
- `packages/server/src/skills/loader.ts`
- `packages/server/src/agents/transform-context.ts`
- `packages/server/src/broker/router.ts`
- `packages/server/src/server/routes/deliverables.ts`
- `packages/server/drizzle/meta/_journal.json`
- `packages/web/src/lib/api.ts`
- `packages/web/src/views/Approvals.tsx`
- `packages/web/src/components/BriefProposalCard.tsx`
- `packages/web/src/store/useMarqueeStore.ts`

---

## Task 1: Skill file renames + új deliverable típusok a sémában

**Files:**
- Rename: `packages/server/seed/skills/brand-voice-guardian/brand_voice_ellenorzes.md`
- Rename: `packages/server/seed/skills/email-marketer/drip_sorozat_tervezes.md`
- Rename: `packages/server/seed/skills/email-marketer/hirlevel_iras.md`
- Rename: `packages/server/seed/skills/email-marketer/transactional_email_szoveg.md`
- Rename: `packages/server/seed/skills/seo-specialist/kulcsszo_kutatas.md`
- Rename: `packages/server/seed/skills/seo-specialist/technikai_seo_audit.md`
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/agents/config.ts`
- Modify: `packages/server/src/tools/submit-deliverable.ts`
- Modify: `packages/server/src/agents/factory.ts`
- Modify: `packages/server/src/tools/propose-brief.ts`

- [ ] **Lépés 1: Nevezd át a 6 skill fájlt és frissítsd a `name:` frontmattert mindegyikben**

```bash
cd packages/server/seed/skills
mv brand-voice-guardian/brand_voice_ellenorzes.md brand-voice-guardian/brand_voice_review.md
mv email-marketer/drip_sorozat_tervezes.md email-marketer/drip_sequence_planning.md
mv email-marketer/hirlevel_iras.md email-marketer/newsletter_writer.md
mv email-marketer/transactional_email_szoveg.md email-marketer/transactional_email_writer.md
mv seo-specialist/kulcsszo_kutatas.md seo-specialist/keyword_research.md
mv seo-specialist/technikai_seo_audit.md seo-specialist/technical_seo_audit.md
```

Minden átnevezett fájlban a `name:` frontmatter mező is frissül. Példa `brand_voice_review.md`-ben:
```
---
name: brand_voice_review
...
---
```
Ellenőrizd mind a 6 fájlt — csak a `name:` sor változik, a tartalom marad.

- [ ] **Lépés 2: Add hozzá a `content_brief_seo` és `seo_report` típusokat a `schema.ts`-hez**

`packages/server/src/db/schema.ts` — módosítsd a `deliverables` tábla `type` mezőjét és a `delegations` tábla `toAgent` mezőjét:

```typescript
// deliverables tábla (sor ~74):
type: text('type', { enum: ['social_post', 'email', 'blog_post', 'ad_copy', 'content_brief_seo', 'seo_report'] }).notNull(),

// briefs tábla után add hozzá a parentDeliverableId mezőt (sor ~51 körül, a dispatchedAt után):
parentDeliverableId: text('parent_deliverable_id').references(() => deliverables.id),
```

Figyelem: a `parentDeliverableId` FK forward-reference `deliverables`-re — Drizzle SQLite-ban ez rendben van, mert a tábla definiálva van ugyanabban a fájlban. A migration ezt kezeli.

- [ ] **Lépés 3: Frissítsd a `config.ts` seo-specialist `produces` mezőjét**

`packages/server/src/agents/config.ts` (sor ~50–56):
```typescript
'seo-specialist': {
  slug: 'seo-specialist',
  lifecycle: 'transient',
  tools: ['read_memory', 'submit_deliverable'],
  produces: ['blog_post', 'content_brief_seo', 'seo_report'],
},
```

- [ ] **Lépés 4: Frissítsd a `submit-deliverable.ts` és `factory.ts` deliverableType enum-ját**

`packages/server/src/tools/submit-deliverable.ts` (sor ~18):
```typescript
export interface SubmitDeliverableContext {
  db: Db;
  broker: Broker;
  dataDir: string;
  clientSlug: string;
  delegationId: string;
  agentSlug: string;
  deliverableType: 'social_post' | 'email' | 'blog_post' | 'ad_copy' | 'content_brief_seo' | 'seo_report';
}
```

`packages/server/src/agents/factory.ts` (sor ~31):
```typescript
export interface SpawnInput {
  db: Db;
  broker: Broker;
  dataDir: string;
  clientSlug: string;
  role: RoleSlug;
  threadId?: string;
  delegationId?: string;
  deliverableId?: string;
  deliverableType?: 'social_post' | 'email' | 'blog_post' | 'ad_copy' | 'content_brief_seo' | 'seo_report';
  authManager?: AuthManager;
}
```

- [ ] **Lépés 5: Frissítsd a `propose-brief.ts` SPECIALIST_FOR map-et és a `skill` mezőt**

`packages/server/src/tools/propose-brief.ts` — add hozzá a `skill` optional mezőt és frissítsd a SPECIALIST_FOR-t:

```typescript
const SPECIALIST_FOR: Record<string, string[]> = {
  copywriter: ['email', 'blog_post'],
  'social-manager': ['social_post'],
  'paid-specialist': ['ad_copy'],
  'email-marketer': ['email'],
  'seo-specialist': ['blog_post', 'content_brief_seo', 'seo_report'],
};

export interface ProposeBriefInput {
  title: string;
  content_md: string;
  deliverable_type: 'social_post' | 'email' | 'blog_post' | 'ad_copy' | 'content_brief_seo' | 'seo_report';
  target_specialist: 'copywriter' | 'social-manager' | 'paid-specialist' | 'email-marketer' | 'seo-specialist';
  platform?: string;
  campaign_name?: string;
  skill?: string;
}
```

Az `execute` függvényben a `contentMd` JSON-ba is kerüljön be a `skill`:
```typescript
contentMd: JSON.stringify({
  title: input.title,
  body: input.content_md,
  deliverable_type: input.deliverable_type,
  target_specialist: input.target_specialist,
  platform: input.platform ?? null,
  skill: input.skill ?? null,
}),
```

A `broker.emit` eseménybe is add hozzá: `skill: input.skill ?? null`.

Az `inputSchema`-ban add hozzá a `skill` mezőt és frissítsd a Director tool description-jét (a `target_specialist` description végére):
```
\n- seo-specialist: SEO-feladatok: kulcsszó-kutatás (skill: keyword_research), on-page ajánlás (skill: on_page_seo_recommendation), technikai SEO audit (skill: technical_seo_audit), SEO-orientált content brief Copywriter-nek (skill: content_brief_seo).\n\nCopywriter skill-választás:\n- Ha általános cikket kell írni: deliverable_type: blog_post, skill elhagyható.\n- Ha SEO-orientált cikket kell írni ÉS már van SEO content brief deliverable: deliverable_type: blog_post, skill: seo_article_writer, parent_deliverable_id töltve. Ha még nincs SEO brief, ELŐSZÖR javasolj seo-specialist briefet content_brief_seo skill-lel.
```

- [ ] **Lépés 6: TS check**

```bash
cd packages/server && npx tsc --noEmit
```
Expected: 0 hiba.

- [ ] **Lépés 7: Commit**

```bash
git add packages/server/seed/skills packages/server/src/db/schema.ts packages/server/src/agents/config.ts packages/server/src/tools/submit-deliverable.ts packages/server/src/agents/factory.ts packages/server/src/tools/propose-brief.ts
git commit -m "feat: rename skill files to English, add content_brief_seo/seo_report types"
```

---

## Task 2: Migration 0005 — `briefs.parent_deliverable_id`

**Files:**
- Create: `packages/server/drizzle/0005_handoff.sql`
- Modify: `packages/server/drizzle/meta/_journal.json`

- [ ] **Lépés 1: Hozd létre a migration SQL fájlt**

`packages/server/drizzle/0005_handoff.sql`:
```sql
ALTER TABLE briefs ADD COLUMN parent_deliverable_id TEXT REFERENCES deliverables(id) ON DELETE SET NULL;
CREATE INDEX idx_briefs_parent_deliverable ON briefs(parent_deliverable_id);
```

- [ ] **Lépés 2: Frissítsd a `_journal.json`-t**

`packages/server/drizzle/meta/_journal.json` — add hozzá az új entry-t az `entries` tömb végére:
```json
{
  "idx": 5,
  "version": "6",
  "when": 1746388800000,
  "tag": "0005_handoff",
  "breakpoints": true
}
```

- [ ] **Lépés 3: Alkalmazd a migrációt a dev DB-re**

```bash
sqlite3 ~/.marquee-dev/state.db < packages/server/drizzle/0005_handoff.sql
```

Ellenőrzés:
```bash
sqlite3 ~/.marquee-dev/state.db ".schema briefs"
```
Expected: a `briefs` tábla schemájában megjelenik a `parent_deliverable_id` oszlop.

- [ ] **Lépés 4: Adj hozzá manuálisan egy sort a `__drizzle_migrations` táblába**

A hash kiszámítása (SHA-256 a fájl tartalmából):
```bash
sha256sum packages/server/drizzle/0005_handoff.sql | awk '{print $1}'
```

A kiszámított hash-sel:
```bash
sqlite3 ~/.marquee-dev/state.db "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('<SHA256_HASH>', $(date +%s%3N));"
```

- [ ] **Lépés 5: Futtasd a schema teszteket**

```bash
cd packages/server && npx vitest run src/db/schema.test.ts
```
Expected: PASS.

- [ ] **Lépés 6: Commit**

```bash
git add packages/server/drizzle/0005_handoff.sql packages/server/drizzle/meta/_journal.json
git commit -m "feat: add briefs.parent_deliverable_id migration (0005)"
```

---

## Task 3: Common brand voice instruction + loader refactor (Fázis 0)

**Files:**
- Create: `packages/server/seed/skills/_common/brand_voice_instruction.md`
- Modify: `packages/server/src/skills/loader.ts`
- Test: `packages/server/src/skills/loader.test.ts`

- [ ] **Lépés 1: Írj failing tesztet a loaderhez**

`packages/server/src/skills/loader.test.ts` — add hozzá ezt a describe blokkot a meglévők mellé:

```typescript
describe('loadSkillRecipes — _common brand voice injection', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'marquee-loader-'));
    mkdirSync(join(dir, 'skills', 'copywriter'), { recursive: true });
    mkdirSync(join(dir, 'skills', '_common'), { recursive: true });
    writeFileSync(join(dir, 'skills', 'copywriter', 'blog_post_writer.md'), '---\nname: blog_post_writer\n---\nWrite a blog post.');
    writeFileSync(join(dir, 'skills', '_common', 'brand_voice_instruction.md'), '## Brand voice\nFollow the guidelines.');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('appends brand_voice_instruction to non-guardian roles', async () => {
    const result = await loadSkillRecipes(dir, 'copywriter');
    expect(result).toContain('Write a blog post.');
    expect(result).toContain('Follow the guidelines.');
  });

  it('does NOT append brand_voice_instruction to brand-voice-guardian', async () => {
    mkdirSync(join(dir, 'skills', 'brand-voice-guardian'), { recursive: true });
    writeFileSync(join(dir, 'skills', 'brand-voice-guardian', 'brand_voice_review.md'), '---\nname: brand_voice_review\n---\nReview the content.');
    const result = await loadSkillRecipes(dir, 'brand-voice-guardian');
    expect(result).toContain('Review the content.');
    expect(result).not.toContain('Follow the guidelines.');
  });

  it('works fine when _common/brand_voice_instruction.md does not exist', async () => {
    rmSync(join(dir, 'skills', '_common'), { recursive: true });
    const result = await loadSkillRecipes(dir, 'copywriter');
    expect(result).toContain('Write a blog post.');
  });
});
```

- [ ] **Lépés 2: Futtasd — failelt-e?**

```bash
cd packages/server && npx vitest run src/skills/loader.test.ts
```
Expected: FAIL — a loader jelenleg nem appendeli a _common fájlt.

- [ ] **Lépés 3: Hozd létre a `_common/brand_voice_instruction.md` fájlt**

`packages/server/seed/skills/_common/brand_voice_instruction.md`:
```markdown
## Brand voice szabályok

A `=== BRAND VOICE SZABÁLYOK ===` blokkban átadott brand voice guidelines-t **kötelezően** vedd figyelembe minden outputnál:
- A `tone` és `stilus` szakaszban leírt hangnemet kövesd
- A `tiltott_kifejezesek` listában szereplő szavakat/kifejezéseket **ne használd**
- A `kotelezo_elemek` listáját teljesítsd, ahol releváns az outputban
- A `pelda_jo_mondatok` stílusát utánozd; a `pelda_rossz_mondatok` mintáit kerüld
```

- [ ] **Lépés 4: Implementáld a loader változást**

`packages/server/src/skills/loader.ts` — módosítsd a `loadSkillRecipes` függvényt:

```typescript
export async function loadSkillRecipes(dataDir: string, role: string): Promise<string> {
  const dir = join(dataDir, 'skills', role);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
  const parts: string[] = [];
  for (const f of files) {
    const c = await readFile(join(dir, f), 'utf8');
    parts.push(c);
  }

  if (role !== 'brand-voice-guardian') {
    const commonPath = join(dataDir, 'skills', '_common', 'brand_voice_instruction.md');
    try {
      const common = await readFile(commonPath, 'utf8');
      parts.push(common);
    } catch {
      // _common fájl hiánya nem végzetes
    }
  }

  return parts.join('\n\n---\n\n');
}
```

- [ ] **Lépés 5: Futtasd a tesztet — PASS kell**

```bash
cd packages/server && npx vitest run src/skills/loader.test.ts
```
Expected: PASS.

- [ ] **Lépés 6: Commit**

```bash
git add packages/server/seed/skills/_common packages/server/src/skills/loader.ts packages/server/src/skills/loader.test.ts
git commit -m "feat: loader appends _common/brand_voice_instruction to all non-guardian skills (Fázis 0)"
```

---

## Task 4: Brand voice memory injection a transform-context-ben (Fázis 1 — C)

**Files:**
- Modify: `packages/server/src/agents/transform-context.ts`
- Modify: `packages/server/src/agents/factory.ts`
- Test: `packages/server/src/agents/transform-context.test.ts`

- [ ] **Lépés 1: Írj failing tesztet**

`packages/server/src/agents/transform-context.test.ts` — add hozzá a meglévő `describe` blokkok mellé:

```typescript
describe('renderBrandVoiceBlock', () => {
  it('returns empty string when brand_voice_guidelines.md does not exist', async () => {
    const out = await renderBrandVoiceBlock(dir, 'default', 'copywriter');
    expect(out).toBe('');
  });

  it('wraps brand_voice_guidelines content in the === block', async () => {
    writeFileSync(
      join(dir, 'memory', 'clients', 'default', 'brand_voice_guidelines.md'),
      '---\ntone: professional\n---\nUse clear language.',
    );
    const out = await renderBrandVoiceBlock(dir, 'default', 'copywriter');
    expect(out).toContain('=== BRAND VOICE SZABÁLYOK ===');
    expect(out).toContain('Use clear language.');
    expect(out).toContain('=== / BRAND VOICE SZABÁLYOK VÉGE ===');
  });

  it('returns empty string for brand-voice-guardian (no duplication)', async () => {
    writeFileSync(
      join(dir, 'memory', 'clients', 'default', 'brand_voice_guidelines.md'),
      '---\ntone: professional\n---\nUse clear language.',
    );
    const out = await renderBrandVoiceBlock(dir, 'default', 'brand-voice-guardian');
    expect(out).toBe('');
  });

  it('returns empty string when MARQUEE_BRAND_VOICE_INJECTION=disabled', async () => {
    process.env.MARQUEE_BRAND_VOICE_INJECTION = 'disabled';
    writeFileSync(
      join(dir, 'memory', 'clients', 'default', 'brand_voice_guidelines.md'),
      'Some guidelines.',
    );
    const out = await renderBrandVoiceBlock(dir, 'default', 'copywriter');
    process.env.MARQUEE_BRAND_VOICE_INJECTION = undefined as unknown as string;
    delete process.env.MARQUEE_BRAND_VOICE_INJECTION;
    expect(out).toBe('');
  });
});
```

A `transform-context.test.ts` importjánál add hozzá a `renderBrandVoiceBlock`-ot:
```typescript
import { renderMemoryContext, applyMemoryTemplate, renderBrandVoiceBlock } from './transform-context.js';
```

- [ ] **Lépés 2: Futtasd — failelt-e?**

```bash
cd packages/server && npx vitest run src/agents/transform-context.test.ts
```
Expected: FAIL — `renderBrandVoiceBlock` nem létezik.

- [ ] **Lépés 3: Implementáld a `renderBrandVoiceBlock` függvényt**

`packages/server/src/agents/transform-context.ts` — add hozzá a fájl végéhez:

```typescript
export async function renderBrandVoiceBlock(
  dataDir: string,
  clientSlug: string,
  role: RoleSlug,
): Promise<string> {
  if (role === 'brand-voice-guardian') return '';
  if (process.env.MARQUEE_BRAND_VOICE_INJECTION === 'disabled') return '';
  const r = await readMemoryFile(dataDir, clientSlug, 'brand_voice_guidelines.md' as MemoryFile);
  if (!r) return '';
  return `=== BRAND VOICE SZABÁLYOK ===\n${r.rawContent.trim()}\n=== / BRAND VOICE SZABÁLYOK VÉGE ===`;
}
```

`brand_voice_guidelines.md` már szerepel a `MEMORY_FILES`-ban (`validate.ts`), nincs teendő.

- [ ] **Lépés 4: Futtasd — PASS kell**

```bash
cd packages/server && npx vitest run src/agents/transform-context.test.ts
```
Expected: PASS.

- [ ] **Lépés 5: Csatold be a brand voice blokkot a `factory.ts` system promptjába**

`packages/server/src/agents/factory.ts` — módosítsd az importot és a `spawnAgent` függvényt:

```typescript
import { renderMemoryContext, renderBrandVoiceBlock } from './transform-context.js';
```

A `spawnAgent` függvényben (sor ~97 körül) cseréld le a systemPrompt összerakást:
```typescript
const skills = await loadSkillRecipes(input.dataDir, config.slug);
const memoryBlock = await renderMemoryContext(input.dataDir, input.clientSlug, config.slug);
const brandVoiceBlock = await renderBrandVoiceBlock(input.dataDir, input.clientSlug, config.slug);
const systemPrompt = [memoryBlock, brandVoiceBlock, skills].filter(Boolean).join('\n\n');
```

- [ ] **Lépés 6: TS check**

```bash
cd packages/server && npx tsc --noEmit
```
Expected: 0 hiba.

- [ ] **Lépés 7: Commit**

```bash
git add packages/server/src/agents/transform-context.ts packages/server/src/agents/transform-context.test.ts packages/server/src/agents/factory.ts
git commit -m "feat: inject brand:voice-guidelines into all non-guardian role system prompts (Fázis 1 — C)"
```

---

## Task 5: Handoff endpoint + parent deliverable a promptban (Fázis 2 — F backend)

**Files:**
- Modify: `packages/server/src/server/routes/deliverables.ts`
- Modify: `packages/server/src/broker/router.ts`
- Test: `packages/server/src/server/routes/deliverables.test.ts`
- Test: `packages/server/src/broker/router.test.ts`

- [ ] **Lépés 1: Írj failing tesztet a handoff endpointhoz**

`packages/server/src/server/routes/deliverables.test.ts` — add hozzá a meglévő `describe` blokk végére:

```typescript
describe('POST /api/deliverables/:id/handoff', () => {
  async function seedSeoDeliverable() {
    const now = Date.now();
    const artifactDir = join(baseDir, 'artifacts', 'clients', 'default', 'seo_del');
    await mkdir(artifactDir, { recursive: true });
    const artifactPath = join(artifactDir, 'rev_001.md');
    await writeFile(artifactPath, '# SEO Brief\nprimary_keyword: saas onboarding\n\n## H-struktúra\n- H2: Mi az aktiváció?\n- H2: Mit mérj?');

    await db.insert(schema.briefs).values({
      id: 'br_seo', clientSlug: 'default', sourceThreadId: null,
      contentMd: JSON.stringify({ title: 'SEO brief', body: '', deliverable_type: 'content_brief_seo', target_specialist: 'seo-specialist' }),
      status: 'dispatched', createdAt: now, dispatchedAt: now,
    });
    await db.insert(schema.delegations).values({
      id: 'del_seo', briefId: 'br_seo', clientSlug: 'default', fromAgent: 'director',
      toAgent: 'seo-specialist', payloadJson: '{}', status: 'complete', requestedAt: now, completedAt: now,
    });
    await db.insert(schema.deliverables).values({
      id: 'seo_del', delegationId: 'del_seo', clientSlug: 'default',
      type: 'content_brief_seo', status: 'awaiting_approval',
      currentRevisionId: null, createdAt: now, updatedAt: now,
    });
    await db.insert(schema.deliverableRevisions).values({
      id: 'seo_rev', deliverableId: 'seo_del', revisionNo: 1,
      artifactPath, createdByAgent: 'seo-specialist', feedbackNote: null, ts: now,
    });
    await db.update(schema.deliverables).set({ currentRevisionId: 'seo_rev' }).where(eq(schema.deliverables.id, 'seo_del'));
  }

  it('returns 400 when deliverable type is not content_brief_seo', async () => {
    await seedDeliverable();
    const res = await app.inject({
      method: 'POST', url: '/api/deliverables/d_1/handoff',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ target_role: 'copywriter' }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('not_content_brief_seo');
  });

  it('creates a draft brief with parent_deliverable_id and returns brief_id', async () => {
    await seedSeoDeliverable();
    const res = await app.inject({
      method: 'POST', url: '/api/deliverables/seo_del/handoff',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ target_role: 'copywriter', brief_overrides: { title: 'SEO cikk: saas onboarding' } }),
    });
    expect(res.statusCode).toBe(200);
    const { brief_id } = res.json();
    expect(brief_id).toBeTruthy();

    const brief = (await db.select().from(schema.briefs).where(eq(schema.briefs.id, brief_id)).all())[0];
    expect(brief.status).toBe('draft');
    expect(brief.parentDeliverableId).toBe('seo_del');
    const payload = JSON.parse(brief.contentMd);
    expect(payload.target_specialist).toBe('copywriter');
    expect(payload.skill).toBe('seo_article_writer');
    expect(payload.body).toContain('SEO Brief');
  });
});
```

A teszt fájl tetején szükséges importok hozzáadása: `import { mkdir, writeFile } from 'node:fs/promises';`, `import { eq } from 'drizzle-orm';`.

- [ ] **Lépés 2: Futtasd — failelt-e?**

```bash
cd packages/server && npx vitest run src/server/routes/deliverables.test.ts
```
Expected: FAIL — `POST /api/deliverables/:id/handoff` route nem létezik.

- [ ] **Lépés 3: Implementáld a handoff endpointot**

`packages/server/src/server/routes/deliverables.ts` — a `deliverablesRoutes` függvény végéhez, a záró `}` elé add hozzá:

```typescript
app.post<{
  Params: { id: string };
  Body: {
    target_role: 'copywriter';
    brief_overrides?: { title?: string; description?: string; campaign_name?: string };
  };
}>('/api/deliverables/:id/handoff', async (req, reply) => {
  const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
  if (!d) return reply.code(404).send({ error: 'not_found' });
  if (d.type !== 'content_brief_seo') return reply.code(400).send({ error: 'not_content_brief_seo' });

  const rev = d.currentRevisionId
    ? (await db.select().from(deliverableRevisions).where(eq(deliverableRevisions.id, d.currentRevisionId)).all())[0]
    : null;
  const artifactContent = rev?.artifactPath
    ? await readFile(rev.artifactPath, 'utf-8').catch(() => '')
    : '';

  // Structured data-ból primary keyword kinyerése (ha van)
  const structuredDataMatch = artifactContent.match(/<!--\s*structured_data\s*([\s\S]*?)-->/);
  let primaryKeyword: string | null = null;
  if (structuredDataMatch) {
    try {
      const sd = JSON.parse(structuredDataMatch[1]);
      primaryKeyword = sd.primary_keyword ?? null;
    } catch { /* ignore */ }
  }

  const finalTitle = req.body.brief_overrides?.title
    ?? (primaryKeyword ? `${primaryKeyword} — SEO cikk` : (d.title ?? 'SEO cikk'));

  let campaignId: string | null = d.campaignId ?? null;
  const overrideCampaignName = req.body.brief_overrides?.campaign_name;
  if (overrideCampaignName) {
    const { campaigns } = await import('../../db/schema.js');
    const tentativeId = createId();
    await db.insert(campaigns).values({
      id: tentativeId, clientSlug: 'default', title: overrideCampaignName,
      status: 'active', createdAt: Date.now(),
    }).onConflictDoNothing();
    const rows = await db.select().from(campaigns)
      .where(and(eq(campaigns.clientSlug, 'default'), eq(campaigns.title, overrideCampaignName)))
      .limit(1).all();
    campaignId = rows[0]?.id ?? null;
  }

  const briefBody = req.body.brief_overrides?.description ?? artifactContent;
  const briefId = createId();
  const now = Date.now();

  await db.insert(briefs).values({
    id: briefId,
    clientSlug: 'default',
    sourceThreadId: null,
    campaignId,
    parentDeliverableId: d.id,
    contentMd: JSON.stringify({
      title: finalTitle,
      body: briefBody,
      deliverable_type: 'blog_post',
      target_specialist: 'copywriter',
      skill: 'seo_article_writer',
      platform: null,
    }),
    status: 'draft',
    createdAt: now,
    dispatchedAt: null,
  });

  broker.emit({
    type: 'brief_proposed',
    brief_id: briefId,
    client_slug: 'default',
    thread_id: null,
    title: finalTitle,
    content_md: briefBody,
    deliverable_type: 'blog_post',
    target_specialist: 'copywriter',
    skill: 'seo_article_writer',
    campaign_name: overrideCampaignName ?? null,
  });

  return reply.send({ brief_id: briefId });
});
```

A fájl tetején az importokhoz add hozzá: `import { and } from 'drizzle-orm';`, `import { briefs, campaigns } from '../../db/schema.js';` (ha még nincs).

- [ ] **Lépés 4: Futtasd — PASS kell**

```bash
cd packages/server && npx vitest run src/server/routes/deliverables.test.ts
```
Expected: PASS.

- [ ] **Lépés 5: Írj failing unit tesztet a `composePrompt` parent-injektáláshoz**

`packages/server/src/broker/router.test.ts` — add hozzá (a `composePrompt`-ot exportálni kell `router.ts`-ből `export`-tal):

```typescript
import { composePrompt } from './router.js';

describe('composePrompt', () => {
  it('includes parent deliverable block when parentContent is provided', () => {
    const payload = { title: 'SEO cikk', body: 'Írj cikket', deliverable_type: 'blog_post' as const, target_specialist: 'copywriter' as const, platform: null, skill: 'seo_article_writer' };
    const result = composePrompt(payload, '# SEO Brief\nprimary_keyword: growth hacking');
    expect(result).toContain('=== FORRÁS DELIVERABLE ===');
    expect(result).toContain('primary_keyword: growth hacking');
    expect(result).toContain('=== AKTUÁLIS BRIEF ===');
    expect(result).toContain('SEO cikk');
  });

  it('omits the source block when no parentContent', () => {
    const payload = { title: 'Blog post', body: 'Írj cikket', deliverable_type: 'blog_post' as const, target_specialist: 'copywriter' as const, platform: null, skill: null };
    const result = composePrompt(payload);
    expect(result).not.toContain('=== FORRÁS DELIVERABLE ===');
    expect(result).toContain('=== AKTUÁLIS BRIEF ===');
  });
});
```

- [ ] **Lépés 6: Futtasd — failelt-e?**

```bash
cd packages/server && npx vitest run src/broker/router.test.ts
```
Expected: FAIL — `composePrompt` nincs exportálva, és a logika még nem tartalmazza a blokkokat.

- [ ] **Lépés 7: Implementáld a parent deliverable injektálást a `router.ts`-ben**

`packages/server/src/broker/router.ts` — módosítsd a `dispatchBrief` és `composePrompt` függvényeket:

Az importokhoz add hozzá:
```typescript
import { readFile } from 'node:fs/promises';
import { deliverables, deliverableRevisions } from '../db/schema.js';
```

A `BriefPayload` típusba add hozzá:
```typescript
interface BriefPayload {
  title: string;
  body: string;
  deliverable_type: 'social_post' | 'email' | 'blog_post' | 'ad_copy' | 'content_brief_seo' | 'seo_report';
  target_specialist: 'copywriter' | 'social-manager' | 'paid-specialist' | 'email-marketer' | 'seo-specialist';
  platform?: string | null;
  skill?: string | null;
}
```

A `dispatchBrief` függvényben a `const payload = ...` sor után add hozzá a parent deliverable olvasást és a hard validációt:

```typescript
const payload = JSON.parse(brief.contentMd) as BriefPayload;

// Hard validáció: seo_article_writer csak parent_deliverable_id-vel futhat
if (payload.skill === 'seo_article_writer' && !brief.parentDeliverableId) {
  throw new Error(
    'seo_article_writer skill requires a parent SEO content brief (parent_deliverable_id). ' +
    'Run SEO Specialist with content_brief_seo skill first.',
  );
}

// Parent deliverable tartalmának kiolvasása (ha van)
let parentContent: string | undefined;
if (brief.parentDeliverableId) {
  const parentDel = (await input.db.select().from(deliverables)
    .where(eq(deliverables.id, brief.parentDeliverableId)).limit(1).all())[0];
  if (parentDel?.currentRevisionId) {
    const rev = (await input.db.select().from(deliverableRevisions)
      .where(eq(deliverableRevisions.id, parentDel.currentRevisionId)).limit(1).all())[0];
    if (rev?.artifactPath) {
      parentContent = await readFile(rev.artifactPath, 'utf-8').catch(() => undefined);
    }
  }
}
```

A `agent.prompt(prompt)` hívás előtt módosítsd a prompt összerakást:
```typescript
const prompt = composePrompt(payload, parentContent);
```

A `composePrompt` függvényt cseréld le:
```typescript
function composePrompt(p: BriefPayload, parentContent?: string): string {
  const parts: string[] = [];
  if (parentContent) {
    parts.push(`=== FORRÁS DELIVERABLE ===\n${parentContent.trim()}\n=== / FORRÁS DELIVERABLE VÉGE ===`);
  }
  parts.push(
    `=== AKTUÁLIS BRIEF ===`,
    `# Brief: ${p.title}`,
    ...(p.platform ? [`Platform: ${p.platform}`] : []),
    `Deliverable típus: ${p.deliverable_type}`,
    '',
    p.body,
    `=== / AKTUÁLIS BRIEF VÉGE ===`,
  );
  return parts.join('\n');
}
```

- [ ] **Lépés 8: Futtasd az összes server tesztet — PASS kell**

```bash
cd packages/server && npx vitest run
```
Expected: PASS.

- [ ] **Lépés 9: Commit**

```bash
git add packages/server/src/server/routes/deliverables.ts packages/server/src/server/routes/deliverables.test.ts packages/server/src/broker/router.ts packages/server/src/broker/router.test.ts
git commit -m "feat: handoff endpoint + parent deliverable prompt injection (Fázis 2 — F backend)"
```

---

## Task 6: Handoff frontend (Fázis 2 — F frontend)

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/views/Approvals.tsx`
- Modify: `packages/web/src/components/BriefProposalCard.tsx`
- Modify: `packages/web/src/store/useMarqueeStore.ts`

- [ ] **Lépés 1: Add hozzá a handoff API hívást**

`packages/web/src/lib/api.ts` — a `deliverablesApi` objektumba add hozzá:

```typescript
handoff: (
  id: string,
  body: {
    target_role: 'copywriter';
    brief_overrides?: { title?: string; description?: string; campaign_name?: string };
  },
): Promise<{ brief_id: string }> => post(`/api/deliverables/${id}/handoff`, body),
```

A `DeliverableRow` interface-be add hozzá:
```typescript
campaignId: string | null;
type: string;
```
(Ha már szerepel a `type`, nincs teendő.)

- [ ] **Lépés 2: Add hozzá az "Átadás Copywriter-nek" gombot és a HandoffModal-t az `Approvals.tsx`-be**

`packages/web/src/views/Approvals.tsx` — a `canAct` feltételes gombsor után, ugyanabban a `div`-ben, add hozzá conditionally:

```tsx
{detail.deliverable.type === 'content_brief_seo' && (
  <button
    onClick={() => setShowHandoff(true)}
    className="bg-off-white border border-rule text-ink-2 font-medium text-[12px] px-3 py-1.5 rounded-btn hover:bg-parchment"
  >
    Átadás Copywriter-nek →
  </button>
)}
```

A komponens tetején add hozzá az új state-et:
```typescript
const [showHandoff, setShowHandoff] = useState(false);
```

A JSX végéhez (a `</div>` lezárás előtt) add hozzá a modalt:
```tsx
{showHandoff && detail && (
  <HandoffModal
    deliverable={detail.deliverable}
    onCancel={() => setShowHandoff(false)}
    onSubmit={async (overrides) => {
      const { brief_id } = await deliverablesApi.handoff(detail.deliverable.id, {
        target_role: 'copywriter',
        brief_overrides: overrides,
      });
      setShowHandoff(false);
      // Brief megjelenik a Workshop chatban az SSE brief_proposed event-en keresztül
      navigate('/');
    }}
  />
)}
```

A `HandoffModal` komponenst add hozzá ugyanebbe a fájlba (alul, a `DeliverableListItem` után):

```tsx
function HandoffModal({
  deliverable,
  onCancel,
  onSubmit,
}: {
  deliverable: DeliverableRow;
  onCancel: () => void;
  onSubmit: (overrides: { title?: string; campaign_name?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [campaign, setCampaign] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-parchment rounded-xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold">Átadás Copywriter-nek</h2>
        <p className="text-[12px] text-ink-3">
          Egy Copywriter brief javaslat jön létre a SEO brief alapján. Az operátor jóváhagyja mielőtt a Copywriter megkapja.
        </p>
        <div>
          <label className="text-[11px] font-medium text-ink-2 uppercase tracking-wide">Cím</label>
          <input
            className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white focus:outline-none focus:border-primary"
            placeholder="pl. saas onboarding — SEO cikk"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-ink-2 uppercase tracking-wide">Kampány (opcionális)</label>
          <input
            className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white focus:outline-none focus:border-primary"
            placeholder="Kampány neve…"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            className="px-4 py-2 rounded-md text-sm text-ink-2 hover:bg-cream"
            onClick={onCancel}
          >
            Mégse
          </button>
          <button
            className="px-4 py-2 rounded-md text-sm bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit({
                title: title.trim() || undefined,
                campaign_name: campaign.trim() || undefined,
              });
              setBusy(false);
            }}
          >
            Átadás
          </button>
        </div>
      </div>
    </div>
  );
}
```

Szükséges importok hozzáadása: `import { deliverablesApi } from '../lib/api.js';` (ha még nincs).

- [ ] **Lépés 3: Add hozzá a "Forrás: SEO brief" badge-et a `BriefProposalCard`-ban**

`packages/web/src/components/BriefProposalCard.tsx` — a props interface-be add hozzá:
```typescript
parentDeliverableId?: string | null;
```

A kártya fejlécében (a `Deliverable:` sor után) add hozzá:
```tsx
{parentDeliverableId && (
  <div className="mt-1 text-[11px] text-ink-3">
    Forrás:{' '}
    <a
      href={`/jovahagyas/${parentDeliverableId}`}
      className="text-primary hover:underline"
    >
      SEO content brief →
    </a>
  </div>
)}
```

- [ ] **Lépés 4: Frissítsd a store-t a `parentDeliverableId` kezelésére**

`packages/web/src/store/useMarqueeStore.ts` — a `brief_proposed` SSE handler-ben (sor ~216–254) két helyen kell változtatni:

**a) A `ProposedBrief` típushoz add hozzá** (keresd a `ProposedBrief` interface/type definíciót):
```typescript
parentDeliverableId?: string | null;
```

**b) A handler-ben sor ~232 körül, a `brief` objektum összerakásakor** add hozzá:
```typescript
const parentDeliverableId = (payload as Record<string, unknown>).parent_deliverable_id as string | null ?? null;
const brief: ProposedBrief = { briefId, title, contentMd, deliverableType, targetSpecialist, platform, campaignName, parentDeliverableId };
```

**c) A `ChatThread` vagy `MessageList` komponensben**, ahol a `BriefProposalCard` renderelődik, add át a `parentDeliverableId` prop-ot a `proposedBriefs`-ből:
```tsx
<BriefProposalCard
  ...
  parentDeliverableId={brief.parentDeliverableId}
/>
```

- [ ] **Lépés 5: TS check (mindkét csomag)**

```bash
cd packages/server && npx tsc --noEmit
cd packages/web && npx tsc --noEmit
```
Expected: 0 hiba mindkettőben.

- [ ] **Lépés 6: Commit**

```bash
git add packages/web/src/lib/api.ts packages/web/src/views/Approvals.tsx packages/web/src/components/BriefProposalCard.tsx packages/web/src/store/useMarqueeStore.ts
git commit -m "feat: handoff button/modal in Approvals + Forrás badge on BriefProposalCard (Fázis 2 — F frontend)"
```

---

## Task 7: SEO article writer skill + Director update (Fázis 3 — A)

**Files:**
- Create: `packages/server/seed/skills/copywriter/seo_article_writer.md`

- [ ] **Lépés 1: Hozd létre a `seo_article_writer.md` skill recipe-t**

`packages/server/seed/skills/copywriter/seo_article_writer.md`:

```markdown
---
name: seo_article_writer
when_to_use: SEO-orientált cikk írása — csak akkor, ha a brief kontextusában van egy =\=\= FORRÁS DELIVERABLE =\=\= blokk (SEO Specialist által készített content_brief_seo)
---

## Előfeltétel ellenőrzés

Ha a kapott kontextusban **nincs** `=== FORRÁS DELIVERABLE ===` blokk, NE kezdj el cikket írni. Válaszolj:
> "Ehhez a skill-hez SEO content brief szükséges. Kérlek futtass SEO Specialist-et a content_brief_seo skill-lel, majd használd a handoff funkciót."

## Feladat

Írj SEO-orientált cikket a kapott SEO content brief alapján. A cikk célja: organikus keresési láthatóság + olvasói érték egyensúlya.

## Kötelező elemek az outputban

- **Target keyword** a H1-ben, az első 100 szóban és a meta description-ben
- **H-struktúra**: kövesd pontosan a SEO brief javasolt struktúráját (H2-k és H3-ak)
- **Szóhossz**: a SEO brief által javasolt range-en belül (±10%)
- **Search intent** szerinti mélység:
  - `informational` → magyarázó, edukatív, példákkal
  - `commercial` → összehasonlító, pro/con, döntéstámogató
  - `transactional` → vásárlás-orientált, CTA-val, konkrét következő lépéssel
- **FAQ szekció** — ha a SEO brief tartalmaz FAQ pontokat, ezek kötelezők
- **Internal link placeholder-ek** — legalább 2-3 helyen: `[INTERNAL LINK: <leíró szöveg>]` formátumban

## Output formátum

```
## Meta adatok
**Meta title** (max 60 kar): ...
**Meta description** (max 160 kar): ...

## Cikk

# [H1 — target keyword szerepel]

[Bevezető bekezdés — target keyword az első 100 szóban]

## [H2]
...

## FAQ

**[Kérdés]**
[Válasz]

## Internal link javaslatok
- [INTERNAL LINK: szöveg] → javasolt target oldal típusa
```

## Brand voice

Kövesd a `=== BRAND VOICE SZABÁLYOK ===` blokkban megadott szabályokat. A tiltott kifejezések nem szerepelhetnek az outputban.
```

- [ ] **Lépés 2: Ellenőrizd, hogy a loader felolvassa az új skill-t**

```bash
cd packages/server && node -e "
import('./src/skills/loader.js').then(m =>
  m.loadSkillRecipes(process.env.DATA_DIR || process.env.HOME + '/.marquee-dev', 'copywriter')
).then(s => console.log(s.includes('seo_article_writer') ? 'OK' : 'MISSING'))
"
```
Expected: `OK`.

- [ ] **Lépés 3: Frissítsd a `propose-brief.ts` Director tool description-jét**

`packages/server/src/tools/propose-brief.ts` — a `target_specialist` field description-jét frissítsd, a copywriter sorhoz add hozzá:

```
\n\nCopywriter skill-választás:\n- Általános cikk/blog poszt → skill elhagyható (blog_post deliverable_type)\n- SEO-orientált cikk → skill: seo_article_writer, CSAK HA már van content_brief_seo deliverable a SEO Specialist-tól és a brief-nél parent_deliverable_id ki van töltve. Ha nincs SEO brief: ELŐSZÖR javasolj SEO Specialist briefet content_brief_seo skill-lel, AZTÁN handoff után seo_article_writer skill-lel a Copywriternek.
```

- [ ] **Lépés 4: Futtasd az összes tesztet**

```bash
cd packages/server && npx vitest run
```
Expected: PASS.

- [ ] **Lépés 5: TS check (mindkét csomag)**

```bash
cd packages/server && npx tsc --noEmit && cd ../web && npx tsc --noEmit
```
Expected: 0 hiba.

- [ ] **Lépés 6: Commit**

```bash
git add packages/server/seed/skills/copywriter/seo_article_writer.md packages/server/src/tools/propose-brief.ts
git commit -m "feat: seo_article_writer Copywriter skill + Director tool description update (Fázis 3)"
```

---

## Task 8: Végső ellenőrzés

**Files:** —

- [ ] **Lépés 1: Teljes test suite**

```bash
cd packages/server && npx vitest run
```
Expected: minden teszt PASS, 0 fail.

- [ ] **Lépés 2: TS check mindkét csomag**

```bash
cd packages/server && npx tsc --noEmit
cd packages/web && npx tsc --noEmit
```
Expected: 0 hiba.

- [ ] **Lépés 3: Build ellenőrzés**

```bash
npm run build --workspaces
```
Expected: sikeres build, 0 hiba.

- [ ] **Lépés 4: Dev szerver elindítása, manuális smoke teszt**

```bash
DATA_DIR=~/.marquee-dev npm run dev
```

Ellenőrzési lista:
1. Nyisd meg http://localhost:5173
2. Navigálj Jóváhagyások nézetbe — egy meglévő `content_brief_seo` deliverable-nél megjelenik az **"Átadás Copywriter-nek →"** gomb
3. Más típusú deliverable-nél (social_post, email, blog_post) **nem** jelenik meg a gomb
4. Klikk → modal felugrik (cím, kampány mezők)
5. Submit → navigál `/`-re (Workshop)
6. A Workshop chatban megjelenik a BriefProposalCard a "Forrás: SEO content brief →" badge-dzsel
7. Jóváhagy & Indít → a Copywriter agent elindul

- [ ] **Lépés 5: Ellenőrizd a brand voice injekciót**

```bash
sqlite3 ~/.marquee-dev/state.db \
  "SELECT agent_slug, substr(payload_json, 1, 200) FROM events WHERE type='delegation_started' ORDER BY ts DESC LIMIT 5;"
```

Ellenőrizd, hogy a legutóbbi agent session system promptjában megjelenik-e a `=== BRAND VOICE SZABÁLYOK ===` blokk. Ha a `brand_voice_guidelines.md` ki van töltve a dev adatbázisban, a blokk szerepel.

- [ ] **Lépés 6: Commit (ha van uncommitted változás)**

```bash
git status
# Ha tiszta: nincs teendő
```
