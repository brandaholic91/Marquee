# Marquee — Capability Wave 1 (Brand-konzisztens kollaboráció)

**Dátum:** 2026-04-30
**Scope:** Meglévő agentek képesség-bővítése — első hullám
**Státusz:** Design — review-ra vár

---

## 1. Háttér és cél

A Marquee MVP brainstorming során kettéválasztottuk a következő fejlesztési kört:
- **Új agentek** → `2026-04-30-marquee-new-agents-wave-1-design.md` (külön spec, már jóváhagyva)
- **Meglévő agentek képesség-bővítése** → ez a spec

A képesség-bővítési irányokat strukturáló körben rendeztük 6 irányba (A: új skill-ek, B: új tool-ok, C: memory-bővítés, E: kontextus-átadás javítása, F: inter-agent handoff, G: Director intelligence), és 3 hullámra bontottuk:

- **Capability Wave 1** (ez a spec): C + F + A részben
- **Capability Wave 2** (későbbi spec): G — Director intelligence
- **Capability Wave 3** (későbbi spec): B + E + A maradék

A Capability Wave 1 **közvetlenül a new-agents Wave 1 deploy után** indul — a függőségek (Brand Voice Guardian + `brand:voice-guidelines` template + SEO Specialist) addigra elérhetők lesznek.

**Üzleti érték:** A hullám koherens értéket szállít: **minden deliverable brand-konzisztens lesz a forrásnál** (nem csak utólag Guardian review-ban), és **a content gyártás SEO-tudatos workflow-ban** megy (SEO brief → Copywriter cikk).

---

## 2. Scope

### 2.1 Capability Wave 1 tartalma

| Komponens | Mit jelent | Becsült munka |
|---|---|---|
| **C — Memory-megosztás** | A `brand:voice-guidelines` template-et a 6 érintett role olvassa (Director + 5 deliverable-gyártó) | ~0.5-1 nap |
| **F — Inter-agent handoff** | SEO `content_brief_seo` deliverable → Copywriter brief automatikus generálás (operátor review-val) | ~1-2 nap |
| **A részben — Új skill** | `seo-orientalt-cikk-iras` skill a Copywriter-nek (csak SEO brief-fel működik) | ~1 nap |

**Összesen:** ~3-4 nap fejlesztési munka, fázisos sorrendben.

### 2.2 Mit **nem** csinálunk ebben a spec-ben

- ❌ Más handoff párok (Copywriter → Email Marketer, stb.) — későbbi hullám
- ❌ Auto-handoff (operátor approve nélküli) — nem most
- ❌ Brand voice update javaslatok role-októl (memory proposal bővítés) — későbbi hullám
- ❌ Egyéb új skill-ek meglévő role-okhoz (case study, white paper, video script, stb.) — Capability Wave 3
- ❌ Director képesség-bővítés (proaktív javaslatok, deadline tracking, performance feedback) — Capability Wave 2
- ❌ Új tool-ok meglévő role-oknak — Capability Wave 3
- ❌ Kontextus-átadás további javítása (pl. korábbi deliverable-ek auto-becsatolása) — Capability Wave 3 (E-irány)
- ❌ `brand:voice-guidelines` automatikus learning (jóváhagyott deliverable-ekből példa-extrakció) — későbbi hullám

### 2.3 Előfeltételek

A Capability Wave 1 implementáció elindítása **előtt** a következő dolgoknak kész kell lenniük:

1. **new-agents Wave 1 deploy** — Email Marketer, SEO Specialist, Brand Voice Guardian production-ben fut
2. **`brand:voice-guidelines` template kalibrálva GrowthFrame-re** — minimum:
   - `tone` szekció kitöltve (3-5 sor)
   - `stilus` szekció kitöltve (3-5 sor)
   - `tiltott_kifejezesek` lista — minimum 10 kifejezés
   - `kotelezo_elemek` lista — minimum 3-5 elem
   - `pelda_jo_mondatok` — **minimum 5-10 mondat** GrowthFrame valós content-ből
   - `pelda_rossz_mondatok` — **minimum 5-10 mondat**, ami "AI-szagú", elcsépelt vagy off-brand
3. **2-3 GrowthFrame SEO-aware példa-cikk** — a `seo-orientalt-cikk-iras` skill recipe-jében few-shot anyagként

A 2. és 3. előfeltételt **Balázs kézzel készíti elő**, nem a fejlesztés része.

---

## 3. Architektúra

### 3.1 C — Memory-megosztás

**Mit változtat:** a `transform-context` réteg, amikor egy role-nak kontextust épít, mostantól a `brand:voice-guidelines` template-et is becsatolja a system promptba.

#### 3.1.1 Memory hozzáférési táblázat (Capability Wave 1 után)

| Role | Olvas |
|---|---|
| Director | minden közös + összes role-specifikus + `brand:voice-guidelines` |
| Copywriter | közös + `brand:voice-guidelines` |
| Social Manager | közös + `brand:voice-guidelines` |
| Paid Specialist | közös + `brand:voice-guidelines` |
| Email Marketer | közös + `email:list-segments` + `brand:voice-guidelines` |
| SEO Specialist | közös + `seo:keyword-bank` + `brand:voice-guidelines` |
| Brand Voice Guardian | közös + `brand:voice-guidelines` (változatlan) |

#### 3.1.2 System prompt szerkezet

A `transform-context` a brand voice template tartalmát egy dedikált blokkban csatolja a system prompthoz:

```
=== BRAND VOICE SZABÁLYOK ===
[brand:voice-guidelines tartalma — tone, stilus, tiltott_kifejezesek,
kotelezo_elemek, pelda_jo_mondatok, pelda_rossz_mondatok]
=== / BRAND VOICE SZABÁLYOK VÉGE ===
```

#### 3.1.3 Rollback kapcsoló (env var)

**Új env var:** `MARQUEE_BRAND_VOICE_INJECTION` (default: `enabled`).

Ha `disabled` értékre állítjuk, a `transform-context` **nem** csatolja be a `brand:voice-guidelines` template-et egyik role-hoz sem. A Brand Voice Guardian kivétel — annál a template továbbra is bekerül, mert a Guardian **alapfeltétele** (review-zni a guidelines alapján kell).

**Indok:** ha élesben token-robbanást okoz vagy minőség-romlást, gyors visszaállás lehetséges anélkül, hogy a kódot módosítanánk vagy újra deployolnánk a regressziót.

**Gyakorlat:** `.env`-be `MARQUEE_BRAND_VOICE_INJECTION=disabled`, `sudo systemctl restart marquee`, kész.

#### 3.1.4 Skill recipe-k frissítése — közös brand voice bekezdés injekció

A `seed/skills/` loader-be új viselkedés kerül: minden deliverable-gyártó role skill recipe-je **automatikusan kiegészül** egy közös brand voice bekezdéssel, amit egy helyen szerkesztünk.

**Helye:** `seed/skills/_common/brand-voice-instruction.md` (új fájl, `_common` előtaggal jelölve, hogy a loader speciálisan kezelje).

**Tartalma (egy helyen szerkeszthető):**

> **Brand voice szabályok:**
> A `brand:voice-guidelines` memory template tartalmát kötelezően vedd figyelembe minden output-nál:
> - A `tone` és `stilus` szakaszban leírt hangnemet kövesd
> - A `tiltott_kifejezesek` listában szereplő szavakat / kifejezéseket **ne használd**
> - A `kotelezo_elemek` listáját ellenőrizd, és teljesítsd, ahol releváns az output-ban
> - A `pelda_jo_mondatok` és `pelda_rossz_mondatok` szekciók kalibrációs anyagok — utánozd a jó példák stílusát, kerüld a rossz példákban szereplő mintákat

**Loader-logika változás (`seed/skills/loader.ts`):**

A loader minden deliverable-gyártó role skill recipe-jébe automatikusan **appendeli** a `_common/brand-voice-instruction.md` tartalmát. A Director skill-jeibe is bekerül (mert brief proposal-okat generál). A Brand Voice Guardian skill-jébe **nem** kerül (felesleges duplikáció — a Guardian eleve a guidelines alapján működik).

**Refactor scope:** ez egy mini-refactor a loader-en. Külön kicsi PR, smoke teszt minden meglévő role-on (Director, Copywriter, Social Manager, Paid Specialist) **a Capability Wave 1 többi részének elindítása előtt**.

#### 3.1.5 Token-költség

A `brand:voice-guidelines` kalibrált tartalma kb. 500-1000 token. Minden deliverable-gyártó és Director hívásnál benne lesz a system promptban.

**Becslés:** +15-25% input token / hívás. Tudatos költség-növelés a kimenet-minőség javításáért. Smoke teszt token-counter-rel ellenőrzi a becslést deploy után.

### 3.2 F — Inter-agent handoff (SEO → Copywriter)

#### 3.2.1 Új DB mező

A `briefs` táblához új nullable mező:

```sql
ALTER TABLE briefs ADD COLUMN parent_deliverable_id TEXT
  REFERENCES deliverables(id) ON DELETE SET NULL;
CREATE INDEX idx_briefs_parent_deliverable ON briefs(parent_deliverable_id);
```

**Drizzle migration:** `drizzle/0002_add_brief_parent_deliverable.sql` (a 0001 a new-agents Wave 1 `deliverable_reviews` táblája).

**ON DELETE SET NULL** — ha a parent deliverable törlődik, a brief megmarad, csak elveszti a parent referenciát. Biztonságosabb, mint CASCADE.

**Általánosság:** a mező neve `parent_deliverable_id`, nem `seo_brief_id`. Capability Wave 3-ban más handoff párok ugyanezt a mezőt használhatják.

#### 3.2.2 Új REST endpoint: `POST /api/deliverables/:id/handoff`

**Request body:**

```typescript
{
  target_role: 'copywriter',          // egyelőre csak ez
  brief_overrides?: {                  // opcionális finomhangolás
    title?: string,
    description?: string,
    campaign_name?: string,
  }
}
```

**Response:**

```typescript
{ brief_id: string }                   // a létrejött brief ID-je (proposal állapotban)
```

**Logika:**

1. Lehúzza a forrás deliverable-t (`role = seo_specialist`, `deliverable_type = content_brief_seo`)
2. Generál egy új brief-et **proposal állapotban** (nem auto-approve!):
   - `target_role = copywriter`
   - `parent_deliverable_id` = forrás deliverable ID
   - `description` = a forrás deliverable szövegéből összeállított brief-leírás (vagy a `brief_overrides.description`)
   - `title` = a `brief_overrides.title` vagy auto-generált a forrás deliverable target keyword-jéből
   - `campaign_name` = a `brief_overrides.campaign_name` vagy a forrás deliverable kampánya
3. Frontend navigál a brief proposal nézetre — operátor reviewzhatja, szerkesztheti, approve-olja vagy elveti
4. Approve után a meglévő `dispatchBrief` flow indul el (változatlan)

**Lényeges:** a handoff **nem** auto-approve — az operátor még egyszer megnézi/szerkeszti, mielőtt approve-olja. Ez biztosítja a review-pontot.

#### 3.2.3 Frontend változások

**`DeliverableDetail` view bővítés:**

Conditional rendering: ha a deliverable `role === 'seo_specialist'` **és** `deliverable_type === 'content_brief_seo'`, akkor megjelenik egy új gomb: **"Átadás Copywriter-nek"**.

Más deliverable-eknél a gomb **nem** látszik (regresszió-mentes).

**Mini-űrlap modal:** klikkre felugrik egy modal:
- Cím (alapértelmezett: SEO brief target keyword-jéből)
- Kampány-név (alapértelmezett: parent deliverable kampánya)
- Opcionális leírás-felülírás (textarea, default: auto-generated)

Submit után POST `/api/deliverables/:id/handoff`, navigáció a brief proposal részleteihez.

**Brief részletek nézet bővítése:**

Ha a brief-nek van `parent_deliverable_id`, megjelenik egy "Forrás deliverable" badge / link, ami a parent deliverable-re mutat. Ez segíti az operátort visszaugrani az eredeti SEO brief-re.

#### 3.2.4 `transform-context` változás — parent deliverable becsatolása

Amikor a Copywriter (vagy bármilyen jövőbeli handoff-target) agent kontextust kap, és a brief-nek van `parent_deliverable_id`, a `transform-context` lehúzza a parent deliverable szövegét és becsatolja a system promptba dedikált blokkban:

```
=== FORRÁS DELIVERABLE ===
[parent deliverable szövege — a SEO content brief]
=== / FORRÁS DELIVERABLE VÉGE ===

=== AKTUÁLIS BRIEF ===
[a Copywriter brief leírása]
=== / AKTUÁLIS BRIEF VÉGE ===
```

**Általános struktúra:** a `=== FORRÁS DELIVERABLE ===` blokk-elnevezés szándékosan általános, hogy későbbi handoff párok is használhassák.

### 3.3 A részben — `seo-orientalt-cikk-iras` skill (Copywriter)

#### 3.3.1 Skill recipe

**Helye:** `seed/skills/copywriter/seo-orientalt-cikk-iras.md`

**Struktúra:**

```yaml
skill: seo-orientalt-cikk-iras
role: copywriter
elofeltetel: parent_deliverable_id (SEO content brief) kötelező

feladat: |
  Egy SEO-orientált cikk megírása a kapott SEO content brief alapján.
  A cikk célja: organikus keresési láthatóság + olvasói érték.

input:
  - parent_deliverable: SEO Specialist által készített content_brief_seo deliverable
    (target keyword, H-struktúra, szóhossz, intent, FAQ pontok)
  - brief.description: Copywriter-specifikus további instrukciók
  - memory: brand:voice-guidelines (kötelezően alkalmazva — ld. brand voice bekezdés)

kotelezo_elemek_az_outputban:
  - Target keyword a H1-ben, az első 100 szóban, és a meta description-ben
  - H-struktúra kövesse a SEO brief-ben javasolt struktúrát (H2-k, H3-ak)
  - Szóhossz a SEO brief-ben javasolt range-en belül (±10%)
  - Search intent-nek megfelelő tartalmi mélység:
    * informational = magyarázó
    * commercial = összehasonlító
    * transactional = vásárlás-orientált
  - FAQ szekció, ha a SEO brief tartalmaz FAQ pontokat
  - Internal linking placeholder-ek (legalább 2-3 helyen jelölve)

llm_szintu_validacio:
  Ha a megkapott kontextusban nincs `=== FORRÁS DELIVERABLE ===` blokk
  vagy az nem SEO content brief-et tartalmaz, ne kezdj el írni —
  válaszolj egy hibaüzenettel, hogy SEO brief szükséges ehhez a skill-hez.

output_formatum:
  - Meta title (max 60 karakter)
  - Meta description (max 160 karakter)
  - H1 cím
  - Cikk teljes szövege markdown-ban (H2-k, H3-ak, bekezdések)
  - FAQ szekció (ha alkalmazható)
  - Internal link javaslatok listája (linkelendő-szöveg + ajánlott target oldal típusa)

pelda_outputok:
  # Balázs készíti a Capability Wave 1 előfeltételeként
  # 2-3 példa GrowthFrame content-ből
```

#### 3.3.2 Backend hard validáció

A `dispatchBrief` (vagy az agent-spawn helyen) hozzáadunk egy ellenőrzést:

```typescript
if (brief.skill === 'seo-orientalt-cikk-iras' && !brief.parent_deliverable_id) {
  throw new Error(
    'A seo-orientalt-cikk-iras skill csak SEO content brief parent deliverable-lel ' +
    'használható. Tölts ki egy SEO content brief-et SEO Specialist-tal, vagy válassz ' +
    'másik skillt (cikk-iras).'
  );
}
```

Ez **hard validáció** — az LLM hívás nem indul el, ha a feltétel nem teljesül.

#### 3.3.3 LLM szintű védőháló

A skill recipe-ben (3.3.1) szereplő `llm_szintu_validacio` szekció redundáns védőháló: ha valamilyen módon mégis fut az agent SEO brief nélkül (pl. emberi hiba a skill-választásban, futás közbeni adatromlás), az LLM maga is hibát ad vissza.

**γ minta:** backend hard + recipe instrukció együtt.

#### 3.3.4 Director `propose-brief` tool description bővítés

A Director `propose-brief` tool description-jébe bekerül az új skill ismertetése (a Copywriter szekciónál):

> **Copywriter skill-választás:**
> - `cikk-iras` — általános cikk vagy blog poszt, SEO-szempont nélkül vagy laza SEO-val
> - `seo-orientalt-cikk-iras` — SEO-orientált cikk **csak akkor**, ha van már egy SEO content brief deliverable (és a brief-nél a `parent_deliverable_id` ki van töltve). Ha a felhasználó SEO-aware cikket szeretne, de még nincs SEO brief, **először** javasolj egy SEO Specialist briefet a `content-brief-seo` skill-lel.

---

## 4. Implementációs sorrend

Fázisos sorrend (α opció):

| Fázis | Tartalom | Becsült idő |
|---|---|---|
| **Előfeltétel-ellenőrzés** | `brand:voice-guidelines` kalibrált, SEO példa-cikkek megvannak, new-agents Wave 1 deploy kész | (Balázs feladata, fejlesztés-előtti) |
| **Fázis 0 — Loader refactor** | `seed/skills/loader.ts` bővítése a `_common/brand-voice-instruction.md` injekcióval. Smoke teszt minden meglévő role-on (regresszió-ellenőrzés). | ~0.5 nap |
| **Fázis 1 — C: Memory-megosztás** | `transform-context` bővítése, env var rollback kapcsoló (`MARQUEE_BRAND_VOICE_INJECTION`), 6 role kontextusába injekció, smoke teszt token-counter-rel | ~0.5-1 nap |
| **Fázis 2 — F: Handoff** | DB migration (`0002_add_brief_parent_deliverable.sql`), REST endpoint, frontend gomb + modal, brief részletek bővítés, `transform-context` parent deliverable becsatolás | ~1-2 nap |
| **Fázis 3 — A részben: új skill** | `seo-orientalt-cikk-iras` skill recipe (példák Balázstól), backend hard validáció, Director tool description bővítés, end-to-end teszt | ~1 nap |

**Összesen:** ~3-4 nap fejlesztés + Balázs előfeltétel-munkája.

**Indok a sorrendre:**
- A Fázis 0 (loader refactor) izolált, regresszió-ellenőrzés után megy tovább
- C az első érdemi fázis, mert "no-brainer" win, validálja a brand voice template kalibrációját élesben
- F utána, mert nagyobb felület (DB + frontend + új flow)
- A részben a végén, mert F nélkül nem értelmes

---

## 5. Kockázatok és mitigáció

| # | Kockázat | Mitigáció |
|---|---|---|
| 1 | **`brand:voice-guidelines` rosszul kalibrálva → minden role rosszabb lesz** | (a) Előfeltétel-ellenőrzés: kalibrált template kötelező. (b) Smoke teszt minden role-ra a Capability Wave 1 deploy után, összehasonlítva a Wave 1-előtti kimenetekkel. (c) **Rollback kapcsoló:** `MARQUEE_BRAND_VOICE_INJECTION=disabled` env var → instant kikapcsolás restart-tal. |
| 2 | **Token-költség robbanás** — minden hívás +500-1000 token | Becslés: +15-25% input token. Smoke teszt token-counter-rel deploy után. Ha lényegesen több, optimalizáció: csak top 5-5 példa, nem mind. Rollback kapcsoló (#1) szükség esetén. |
| 3 | **Handoff "elveszett" parent deliverable** — ha a parent deliverable törlődik, a brief broken state-be kerülne | DB-szinten `ON DELETE SET NULL`: a brief megmarad, csak elveszti a parent referenciát. Frontend-en jelölve, hogy a parent deliverable nem elérhető. |
| 4 | **`seo-orientalt-cikk-iras` validáció false-positive** — operátor szándékosan a meglévő `cikk-iras` skillt használja, és a rendszer hibásan reject-eli | Egyértelmű skill-választás a brief proposal-ban (nem auto-detect). Director tool description (3.3.4) világos elválasztó szabályokkal. Hard validáció csak az új skill-re érvényes, a meglévőre nem. |
| 5 | **Frontend regresszió** — új gomb a `DeliverableDetail`-en, új mező a brief proposal-on | Conditional rendering: az "Átadás Copywriter-nek" gomb csak akkor jelenik meg, ha `role === 'seo_specialist' && deliverable_type === 'content_brief_seo'`. Más deliverable-eknél nem zavar. |
| 6 | **Common skill-text-injection refactor breaking change** — ha rosszul nyúlunk a `seed/skills/` loader-be, az összes meglévő recipe sérülhet | Külön kis PR a refactor-ra (Fázis 0), smoke teszt minden meglévő role-on (Director, Copywriter, Social Manager, Paid Specialist) **a többi fázis elindítása előtt**. |
| 7 | **Director kontextus-zavar** — a brand voice szabályok növelik a Director system prompt-ját | Smoke teszt: Director chat üzenetek minőségének összehasonlítása előtte/utána. Ha rosszabb, rollback kapcsoló (#1). |

---

## 6. Akceptálási kritériumok (mit jelent a "kész")

A Capability Wave 1 akkor minősül késznek, ha:

### 6.1 C — Memory-megosztás

- A 6 érintett role (Director, Copywriter, Social Manager, Paid Specialist, Email Marketer, SEO Specialist) kontextusában megjelenik a `brand:voice-guidelines` template a `=== BRAND VOICE SZABÁLYOK ===` blokkban
- A `MARQUEE_BRAND_VOICE_INJECTION=disabled` env var helyesen kikapcsolja az injekciót minden role-nál (kivéve Brand Voice Guardian)
- Smoke teszt mindegyik role-on: a generált deliverable-ek **mérhetően** követik a brand voice szabályokat — konkrétan: a `tiltott_kifejezesek` listából **egyik sem fordul elő** a smoke teszt outputjaiban (string-match check)
- A token-költés a becsült +15-25% sávban van
- A `seed/skills/loader.ts` minden deliverable-gyártó és Director role skill-jébe automatikusan appendeli a `_common/brand-voice-instruction.md` tartalmát

### 6.2 F — Handoff

- SEO Specialist `content_brief_seo` deliverable-en megjelenik az "Átadás Copywriter-nek" gomb
- Más deliverable-en (Email, Social, Paid, Copywriter) **nem** jelenik meg
- Klikkre felugrik a mini-űrlap modal (cím, kampány, opcionális leírás-felülírás)
- Submit után létrejön egy brief proposal `parent_deliverable_id`-vel
- Operátor reviewzhatja, szerkesztheti, approve-olja vagy elveti a brief proposal-t (meglévő flow)
- Approve után a Copywriter agent kontextusában megjelenik a parent deliverable szövege a `=== FORRÁS DELIVERABLE ===` blokkban
- A `briefs.parent_deliverable_id` mező megjelenik a DB-ben, helyesen indexelve, `ON DELETE SET NULL` policy-val
- A brief részletek nézetben látszik a "Forrás deliverable" hivatkozás (ha van parent)

### 6.3 A részben — `seo-orientalt-cikk-iras` skill

- A skill recipe a `seed/skills/copywriter/seo-orientalt-cikk-iras.md` alatt
- 2-3 GrowthFrame példa output benne (Balázs előfeltételként készítette)
- Backend hard validáció: ha `parent_deliverable_id` üres és a skill `seo-orientalt-cikk-iras`, a `dispatchBrief` reject-el a felhasználói üzenettel
- Recipe-szintű (LLM) validáció: ha kontextusban nincs `=== FORRÁS DELIVERABLE ===` blokk, az LLM hibát ad
- Director tool description tartalmazza az új skill-elválasztó szabályokat
- End-to-end teszt: SEO content brief → handoff → Copywriter brief approve → cikk deliverable, ahol:
  - Target keyword H1-ben szerepel
  - H-struktúra követi a SEO brief-ben javasoltat
  - Szóhossz ±10%-on belül a javasolt range-hez képest
  - FAQ szekció jelen van (ha a SEO brief tartalmazott FAQ pontokat)

### 6.4 Általános

- `npx tsc --noEmit` mind a `packages/server`-ben, mind a `packages/web`-ben hibamentes
- Vitest tesztek zöldek
- Smoke teszt frissítve a `smoke.ts`-ben — konkrétan az alábbiakkal:
  - SEO Specialist `content_brief_seo` deliverable generálás (Wave 1-ből megvan, csak validálva)
  - Handoff endpoint hívás (SEO deliverable → Copywriter brief proposal)
  - Brief proposal approve → Copywriter `seo-orientalt-cikk-iras` skill futtatás
  - End-to-end tiltott kifejezés-check: a generált cikkben egyik tiltott kifejezés sem fordul elő
- Token-költség mérés: smoke teszt deploy után összehasonlítja a brand voice injekció előtti és utáni token-felhasználást
- A 6.1-6.3 szakaszokban szereplő minden pont validálva éles VM 260 deploy-on

---

## 7. Nyitott kérdések / későbbi döntések

- **Más handoff párok** (Copywriter → Email Marketer, Copywriter → Social Manager) — Capability Wave 3 vagy később. A `parent_deliverable_id` mező már általános, nem kell újra DB migration.
- **Brand voice update javaslatok role-októl** — pl. Copywriter javasolhat új példa-mondatot a `brand:voice-guidelines`-ba a saját jó deliverable-jeiből. Capability Wave 3 vagy később, memory proposal flow bővítéssel együtt.
- **Auto-handoff** — operátor approve nélküli automatikus átadás SEO → Copywriter között, ha a SEO brief teljes és a Director jóváhagyta. Csak akkor jöhet, ha sok manuális handoff után látható, hogy az operátor mindig csak rábólint, sosem szerkeszt.
- **`brand:voice-guidelines` automatikus learning** — a jóváhagyott deliverable-ekből automatikusan kinyert új példa-mondatok a guidelines-ba. Önálló későbbi spec.

---

## 8. Hivatkozások

- Marquee MVP redesign spec: `docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md`
- Marquee implementation plan: `docs/superpowers/plans/2026-04-29-marquee-mvp-implementation.md`
- new-agents Wave 1 design: `docs/superpowers/specs/2026-04-30-marquee-new-agents-wave-1-design.md`
- Repo: `~/Projects/Homelab/marquee`
- Production: `marquee.lab2.home.arpa` (VM 260)
