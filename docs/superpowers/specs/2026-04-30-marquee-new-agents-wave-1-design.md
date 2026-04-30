# Marquee — Új agentek Wave 1 (Email Marketer, SEO Specialist, Brand Voice Guardian)

**Dátum:** 2026-04-30
**Scope:** Hullám 1 új agent-bővítés a Marquee MVP-hez
**Státusz:** Design — review-ra vár

---

## 1. Háttér és cél

A Marquee MVP jelenleg 4 role-lal működik (Director, Copywriter, Social Manager, Paid Specialist), és a `brief → specialist → deliverable → approval` flow stabil. A következő stratégiai lépés a Marquee-t teljes AI marketing ügynökséggé bővíteni — fokozatosan, hullámokban.

**Üzleti cél:**
- Elsősorban **GrowthFrame** saját marketing-tevékenységéhez (teszt-terep, gyors iteráció)
- Másodsorban **magyar SMB ügyfelekhez** (célpiac, miután GrowthFrame-en bevált)
- E-commerce és B2B SaaS most nem fókusz

**Pozicionálási döntés (korábbi brainstormingból):**
- **Lapos modell** marad (Director → specialist → deliverable), nincs Strategist-réteg
- **Funkció-csoportosítás** (UI-szintű) később, ha 5+ role miatt szükséges
- **Multi-agent kollaboráció** csak indokolt esetben, később

Ez a spec a **Wave 1** scope-ot fedi le. Wave 2 (Content Strategist, Analytics Reporter) és Wave 3 (Landing Page Designer, Video Brief Writer) későbbi spec-ekben jönnek. A meglévő agentek képesség-bővítése **nem ennek a spec-nek a tárgya**, külön körben tárgyaljuk.

---

## 2. Scope

### 2.1 Wave 1 új role-ok

| Role | Típus | Modell | Skills száma | Új memory template |
|---|---|---|---|---|
| **Email Marketer** | Klasszikus deliverable-gyártó | gpt-5.4 (long-form output miatt, mint Copywriter) | 3 | `email:list-segments` |
| **SEO Specialist** | Klasszikus deliverable-gyártó | gpt-5.4-mini (strukturált output, listák) | 4 | `seo:keyword-bank` |
| **Brand Voice Guardian** | Review role (új minta) | gpt-5.4-mini (strukturált review JSON) | 1 | `brand:voice-guidelines` |

**Összesen:** 3 új role, 8 új skill recipe, 3 új memory template.

### 2.2 Mit **nem** csinálunk ebben a spec-ben

- ❌ Wave 2-3 role-ok (Content Strategist, Analytics Reporter, Landing Page Designer, Video Brief Writer)
- ❌ Multi-agent kollaboráció
- ❌ Funkció-csoportosítás UI-ban
- ❌ Meglévő agentek (Copywriter, Social Manager, Paid Specialist) képesség-bővítése
- ❌ Director auto-trigger Guardian javaslatra
- ❌ n8n integráció külön bővítése — a meglévő `deliverable_shipped` webhook az új role-ok deliverable-jeire automatikusan működik
- ❌ Új provider/model váltás
- ❌ Memory proposal flow bővítése új role-oknak (egyelőre csak olvasnak)

---

## 3. Architektúra

### 3.1 Email Marketer és SEO Specialist — klasszikus minta

Mindkét role pontosan ugyanúgy illeszkedik a jelenlegi flow-ba, mint a Copywriter / Social Manager / Paid Specialist. Az architektúra változatlan:

```
Director (chat) → propose-brief tool → operátor approve →
specialist agent (Email Marketer | SEO Specialist) → submit-deliverable tool →
deliverable → approval queue → operátor jóváhagy → n8n webhook
```

**Érintett komponensek:**

| Komponens | Változtatás |
|---|---|
| `agents/config.ts` | 2 új role config (név, model, role description) |
| `providers/openai-codex.ts` (`modelForRole`) | 2 új mapping: `email_marketer` → `gpt-5.4` (long-form, mint Copywriter), `seo_specialist` → `gpt-5.4-mini` (strukturált output) |
| `seed/skills/` | 7 új skill recipe magyarul (Email: 3, SEO: 4) |
| `seed/memory/` | 2 új memory template (`email:list-segments`, `seo:keyword-bank`) |
| `broker/router.ts` (`dispatchBrief`) | A 2 új role mint érvényes `target_role` érték |
| `tools/propose-brief.ts` | Tool description bővítés (mikor melyik role-t javasolja) |
| `tools/submit-deliverable.ts` | Változatlan |
| Frontend (`StatusBadge`, `ChatThread`, `BriefProposalCard`, `DeliverableDetail`, `Approvals`) | Új role label/color/icon |
| DB séma | **Nincs változás** — `target_role` és `role` mezők string-ek, csak új értéket vesznek fel |

### 3.2 Brand Voice Guardian — review role (új minta)

A Guardian új interakciós mintát vezet be. Nem briefből gyárt deliverable-t, hanem egy **meglévő deliverable-t kap inputként** és visszajelzést ad.

```
brief → specialist → deliverable
                          ↓
                  [operátor a UI-ban triggereli]
                          ↓
              Brand Voice Guardian agent
                          ↓
                  submit-review tool
                          ↓
            deliverable_reviews tábla (új)
                          ↓
        DeliverableDetail panel (új) — score + észrevételek + javaslatok
```

**Trigger-mód:** **operátor-trigger** (γ opció). A Guardian **kizárólag** a UI-ból indítható egy "Brand Voice ellenőrzés" gombbal a `DeliverableDetail` view-ban. Sem a Director nem javasolja chat-ben, sem automatikus futás nincs.

**Indok:** Token-költség kontroll, operátor-felügyelet, kezdeti fázisban kalibrálás-igény. Később áttehető automatikusra (α/β), ha bevált.

#### 3.2.1 Új DB tábla: `deliverable_reviews`

```sql
CREATE TABLE deliverable_reviews (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL,           -- jelenleg csak 'brand_voice_guardian'
  score INTEGER NOT NULL,                -- 1-10
  comments JSON NOT NULL,                -- structured észrevételek (ld. lent)
  suggestions JSON NOT NULL,             -- javítási javaslatok
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_reviews_deliverable ON deliverable_reviews(deliverable_id);
```

**`comments` JSON struktúra:**

```json
[
  {
    "quote": "az érintett mondat / kifejezés a deliverable szövegéből",
    "issue": "mi a probléma röviden",
    "severity": "info" | "warn" | "error"
  }
]
```

**`suggestions` JSON struktúra:**

```json
[
  {
    "original": "eredeti mondat",
    "suggested": "javasolt alternatíva",
    "reasoning": "miért jobb"
  }
]
```

**Drizzle migration:** új migration fájl (`drizzle/0001_add_deliverable_reviews.sql`), lokálisan tesztelve mielőtt VM 260-ra menne.

#### 3.2.2 Új tool: `submit-review`

A `submit-deliverable` mintájára készül. A Guardian agent ezt hívja a deliverable elemzése után.

**Tool input schema:**

```typescript
{
  deliverable_id: string,
  score: number,           // 1-10
  comments: Array<{
    quote: string,
    issue: string,
    severity: "info" | "warn" | "error"
  }>,
  suggestions: Array<{
    original: string,
    suggested: string,
    reasoning: string
  }>,
  summary: string          // 1-2 mondatos összefoglaló (UI fejlécben jelenik meg)
}
```

**Tool kimenet:** `{ review_id: string }`. A backend írja a `deliverable_reviews` táblába és visszaadja az ID-t.

#### 3.2.3 Frontend: új panel a `DeliverableDetail`-ben

Új komponens: `BrandVoiceReviewPanel`. A `DeliverableDetail` view-ba kerül, a deliverable szöveg alatt.

**Megjelenés:**

- Ha még nem futott review: egy "Brand Voice ellenőrzés" gomb látszik, klikkre indul a Guardian agent
- Ha futott legalább egy review: a legfrissebb review látszik default-ban (score badge + summary + collapsible észrevételek és javaslatok)
- Ha többször futott: dropdown-ból választható a korábbi review-k közül

**Score megjelenítés:**

- 1-3: piros badge ("Jelentős eltérés")
- 4-6: sárga badge ("Részleges eltérés")
- 7-8: világoszöld badge ("Kisebb finomítások")
- 9-10: sötétzöld badge ("Brand voice OK")

#### 3.2.4 Backend orchestration a Guardian-hoz

A jelenlegi flow brief-alapú (a `dispatchBrief` egy briefet ad át a specialist agent-nek). A Guardian **nem** brief-alapú — egy meglévő deliverable szövegét kapja inputként.

**Új broker funkció: `dispatchReview`**

```typescript
async function dispatchReview(params: {
  deliverable_id: string,
  reviewer_role: 'brand_voice_guardian'
}): Promise<{ review_id: string }>
```

Lépések:
1. Lehúzza a deliverable szövegét és metaadatait a DB-ből
2. Lehúzza a `brand:voice-guidelines` memory template-et
3. A `transform-context` réteg összerakja a Guardian agent kontextusát: deliverable szöveg + brand voice guidelines + role skill recipe
4. Az agent fut, hívja a `submit-review` tool-t
5. A review elmentődik, az ID visszatér

**Új REST endpoint:** `POST /api/deliverables/:id/review`. A frontend gomb ezt hívja. **A `dispatchReview` funkciót kizárólag ez az endpoint hívja** — a Director agent nem fér hozzá, és nem is tudja triggerelni a Guardian-t a chat-ből.

---

## 4. Skills (mit tud a role)

Minden új role-hoz magyar nyelvű skill recipe a `seed/skills/` mappában. A recipe-k tartalma: feladat-leírás, input-elvárás, output-formátum, **2-3 példa output** (few-shot, GrowthFrame content-ből merítve).

### 4.1 Email Marketer — 3 skill

#### `hirlevel-iras`
- **Feladat:** Egyetlen hírlevél szövegének megírása (subject + preheader + body + CTA).
- **Input:** Téma, cél (pl. termékbejelentés, edukáció, akció), audience-leírás, hangnem.
- **Output:**
  - Subject line (több variáció, A/B teszthez)
  - Preheader szöveg
  - Body (markdown formátumban)
  - CTA (gomb-szöveg + link-placeholder)

#### `drip-sorozat-tervezes`
- **Feladat:** Több emailes onboarding vagy nurture sorozat tervezése.
- **Input:** Sorozat célja, email-szám, időzítési séma (pl. nap 1, nap 3, nap 7), audience.
- **Output:**
  - Sorozat áttekintő (cél + ívvonal)
  - Minden emailhez: subject + 1 mondatos cél + body + CTA + javasolt időzítés

#### `transactional-email-szoveg`
- **Feladat:** Egyetlen tranzakciós email szövegének megírása (welcome, abandoned cart, password reset, order confirmation, stb.).
- **Input:** Tranzakció típusa, brand voice, esetleges személyre szabási placeholder-ek.
- **Output:** Subject + body + CTA, brand voice-konzisztensen.

### 4.2 SEO Specialist — 4 skill

#### `kulcsszo-kutatas`
- **Feladat:** Adott témára magyar nyelvű kulcsszó-javaslat lista, search intent-tel.
- **Input:** Téma vagy seed kulcsszó, célpiac (alapértelmezetten: magyar), business-cél.
- **Output:**
  - Primary keyword javaslat (1 db)
  - Secondary keyword-ök (5-10 db)
  - Long-tail variációk (5-10 db)
  - Mindegyikhez: search intent (informational/commercial/transactional/navigational), becsült nehézség (low/med/high — disclaimerrel, hogy ez LLM-becslés, nem tényleges adat)

#### `on-page-seo-recommendation`
- **Feladat:** Adott landing page vagy cikk URL-jére (vagy beillesztett szövegre) on-page SEO javaslat.
- **Input:** URL vagy szöveg, target keyword (opcionális).
- **Output:**
  - Meta title javaslat (több variáció, max 60 karakter)
  - Meta description javaslat (max 160 karakter)
  - H-struktúra elemzés és javaslat
  - Internal linking ötletek
  - Tartalmi hiányosságok (mit lehetne hozzátenni)

#### `content-brief-seo`
- **Feladat:** Copywriter-nek átadható SEO-orientált content brief.
- **Input:** Target keyword, audience, content típus (cikk, landing page, guide).
- **Output:**
  - Target + secondary keyword-ök
  - Search intent elemzés
  - Javasolt H-struktúra (H1, H2-k, H3-ak)
  - Javasolt szóhossz
  - Kötelező elemek (FAQ, példák, képek típusa)
  - Competitor analysis pointok

#### `technikai-seo-audit`
- **Feladat:** Adott weboldalra technikai SEO checklist + javaslat.
- **Input:** URL, esetleges már ismert problémák.
- **Output:** Strukturált checklist a következő területeken (mindegyikhez: státusz + javaslat + prioritás):
  - Site speed (Core Web Vitals)
  - Indexálhatóság (robots.txt, sitemap, noindex tag-ek)
  - Mobile usability
  - Structured data (schema.org)
  - Crawl issues (broken link, redirect chain)
  - HTTPS / biztonság
  - URL struktúra
- **Disclaimer a recipe-ben:** Az audit LLM-elemzés alapján készül; valós adatokhoz Search Console / PageSpeed Insights / Screaming Frog kell. Az output **kiindulási checklist**, nem helyettesíti a tényleges crawl-t.

### 4.3 Brand Voice Guardian — 1 skill

#### `brand-voice-ellenorzes`
- **Feladat:** Egy meglévő deliverable szövegét összevetni a brand voice guidelines-szal, és strukturált review-t adni.
- **Input:** Deliverable szövege + `brand:voice-guidelines` memory template tartalma.
- **Output:** Pontosan a `submit-review` tool input schema szerinti struktúra (score + comments + suggestions + summary).
- **Recipe-ben kötelező elem:** példa "jó" és "rossz" mondatpárok GrowthFrame brand voice-ból (kalibrációs anyag).

---

## 5. Memory template-ek

Hibrid struktúra: meglévő közös memory + 3 új role-specifikus template.

### 5.1 `brand:voice-guidelines` (Brand Voice Guardian-hoz **kötelező**)

Ez a Wave 1 **legkritikusabb** memory eszköze. A Guardian értelmes működéséhez ezt **manuálisan kalibrálni kell GrowthFrame brand voice-ra**, mielőtt élesben használnánk.

**Tartalom-struktúra:**

```yaml
tone:
  - professzionális, de közvetlen
  - tegező vagy magázó (GrowthFrame: <kitölteni>)
  - magabiztos, de nem arrogáns

stilus:
  - rövid, scannable mondatok
  - konkrét példák, nem absztrakciók
  - magyar nyelv, idegen szakszavak csak indokolt esetben

tiltott_kifejezesek:
  - "forradalmasít"
  - "next-level"
  - "game-changer"
  - <GrowthFrame-specifikus listát kitölteni>

kotelezo_elemek:
  - CTA mindig konkrét cselekvés
  - <GrowthFrame-specifikus listát kitölteni>

pelda_jo_mondatok:
  - "Az MDIP a magyar SMB-knek építjük, akik napi szinten döntenek marketing-költésről."
  - <több példa kitöltendő>

pelda_rossz_mondatok:
  - "Forradalmasítjuk a marketing decision intelligence-t."
  - <több példa kitöltendő>
```

**Megjegyzés a fenti template-hez:** a `<kitölteni>` és `<GrowthFrame-specifikus listát kitölteni>` jelölések a memory template **kitöltendő mezői**, nem spec-szintű hiányosságok. A template feltöltése a Wave 1 része, nem a spec módosításáé.

**Akceptálási kritérium a Guardian éles használatához:** legalább **5-10 jó és 5-10 rossz példa** mondat a template-ben, különben a Guardian random véleményt fog adni.

### 5.2 `seo:keyword-bank` (SEO Specialist-hez)

Tartalom: korábban használt kulcsszavak listája, ranking adatok (ha vannak), competitor keyword-ök, már elkészített content-ek és azok target keyword-jei. Cél: hogy a SEO Specialist ne dobjon vissza már korábban lefedett kulcsszavakat új javaslatként.

Wave 1-nél **opcionálisan tölthető** (ha üres, a SEO Specialist működik, csak a context-aware javaslatok minősége gyengébb).

### 5.3 `email:list-segments` (Email Marketer-hez)

Tartalom: audience szegmensek leírása (pl. "Free trial users — 14 napja regisztrált", "Active customers — havi vásárló"), korábbi kampány-teljesítmény (open rate, CTR), preferált küldési idők.

Wave 1-nél **opcionálisan tölthető**, de GrowthFrame email lista-építéshez ajánlott.

### 5.4 Memory hozzáférési szabályok

| Role | Olvas |
|---|---|
| Director | minden közös + összes role-specifikus (kontextus-építéshez) |
| Email Marketer | közös + `email:list-segments` |
| SEO Specialist | közös + `seo:keyword-bank` |
| Brand Voice Guardian | közös + `brand:voice-guidelines` (**kötelezően**) |
| Copywriter, Social Manager, Paid Specialist | változatlan (ha akarjuk hogy `brand:voice-guidelines`-ot olvassák, az **későbbi capability-bővítés spec tárgya**) |

---

## 6. Director tool description bővítés

A `propose-brief` tool description-be be kell írni a 2 új klasszikus role-t (Email Marketer és SEO Specialist). A Brand Voice Guardian **nem** kerül a propose-brief körbe.

**Javasolt szöveg-pótlás (magyar, mert a Director magyarul gondolkodik):**

> A `target_role` lehetséges értékei és mikor használd melyiket:
>
> - `copywriter` — long-form szöveg: cikk, landing page szöveg, blog poszt, white paper.
> - `social_manager` — közösségi média poszt: LinkedIn, Facebook, Instagram caption, Twitter/X.
> - `paid_specialist` — fizetett hirdetés creative: Meta ads, Google ads szöveg + targeting javaslat.
> - `email_marketer` — bármilyen email: hírlevél, drip sorozat, transactional email (welcome, abandoned cart, stb.). Akkor is ezt válaszd, ha a felhasználó "automatizált sorozat"-ról beszél.
> - `seo_specialist` — SEO-feladat: kulcsszó-kutatás, on-page audit, technikai SEO checklist, vagy SEO-orientált content brief Copywriter-nek.
>
> **Tilos** target_role-ként: `brand_voice_guardian` — ez review role, kizárólag operátor triggereli a UI-ból.
>
> Ha a felhasználó kérése egyszerre több role-t érintene, **egy briefet javasolj egyszerre, a legkritikusabb role-ra**, a többit külön körben.

---

## 7. Frontend változások

### 7.1 Role-megjelenítés központosítása

A Wave 1 első lépése (Fázis 1 előtt): **`lib/roles.ts` állapot-ellenőrzés**. Ha még nincs ilyen központi mapping, vagy ha van de nem mindenhol használják (StatusBadge, BriefProposalCard, DeliverableDetail), akkor **rövid refactor**: minden role-megjelenítés egyetlen helyről jöjjön. Ez kötelező lépés, nem opcionális — különben az új role-ok hozzáadása szétszórt diff-eket eredményezne.

**Központi struktúra:**

```typescript
export const ROLES = {
  director: { label: 'Director', icon: '...', color: '...' },
  copywriter: { label: 'Copywriter', icon: '...', color: '...' },
  social_manager: { label: 'Social Manager', icon: '...', color: '...' },
  paid_specialist: { label: 'Paid Specialist', icon: '...', color: '...' },
  email_marketer: { label: 'Email Marketer', icon: '...', color: '...' },
  seo_specialist: { label: 'SEO Specialist', icon: '...', color: '...' },
  brand_voice_guardian: { label: 'Brand Voice Guardian', icon: '...', color: '...' },
} as const;
```

A token-megjegyzés a CLAUDE.md-ből (`border-rule`, `text-ink-2`, `bg-off-white` használata) érvényes az új role-okra is.

### 7.2 BrandVoiceReviewPanel komponens

Új komponens a `DeliverableDetail` view-ban. Részletek a 3.2.3 szakaszban.

### 7.3 Approvals view szűrés

A meglévő `Approvals` view szűrőjébe (ha van role-szűrés) bekerül a 2 új deliverable-gyártó role. A Guardian review-k **nem jelennek meg** az approval queue-ban (nincsenek külön jóváhagyásra váró elemek; a review csak információ a deliverable-en).

---

## 8. Implementációs sorrend

| Fázis | Tartalom | Kockázat | Becsült idő |
|---|---|---|---|
| **1. Email Marketer** | Klasszikus minta, 3 skill, 1 memory template, role config, frontend label | Alacsony | ~1 nap |
| **2. SEO Specialist** | Klasszikus minta, 4 skill (köztük `technikai-seo-audit`), 1 memory template, role config, frontend label | Közepes (technikai SEO output minőség) | ~1 nap |
| **3. Brand Voice Guardian** | Új minta: DB migration, új tool (`submit-review`), új broker funkció (`dispatchReview`), új REST endpoint, új frontend panel, kötelező memory template kalibrálás | Magas (új minta + új DB tábla + frontend új komponens) | ~2-3 nap |

**Összesen:** kb. 4-5 nap fejlesztési munka.

**Indok a sorrendre:** Email és SEO klasszikus minta — gyors win, regresszió-validáció a meglévő flow-ra. Guardian a végén, mert új minta és nagyobb felület.

---

## 9. Kockázatok és mitigáció

| # | Kockázat | Mitigáció |
|---|---|---|
| 1 | **Director kontextus-zavar** — 5 specialist role között több a döntési felület, rosszul választhat | Egyértelmű elválasztó szabályok a `propose-brief` tool description-ben (ld. 6. szakasz). Smoke teszt mindkét új role-ra a `smoke.ts`-ben. |
| 2 | **Magyar nyelvű skill recipe minőség** — gyenge recipe = gyenge output | Minden recipe-ben **2-3 példa output** (few-shot), GrowthFrame saját content-ből. |
| 3 | **Brand Voice Guardian "véleménye" túl szigorú vagy túl elnéző** | Mielőtt élesbe kerül, a `brand:voice-guidelines` memory template-be **5-10 jó és 5-10 rossz példa mondat** kalibrálva GrowthFrame brand voice-ra. |
| 4 | **DB migráció új `deliverable_reviews` táblához** — production VM-en migration hiba kockázat | Új migration fájl (`drizzle/0001_add_deliverable_reviews.sql`), lokálisan teljes teszt mielőtt VM 260-ra menne. |
| 5 | **Frontend regresszió** — több role = több badge/icon, könnyű elrontani | `lib/roles.ts` központosítás (ha még nincs, refactor a Fázis 1 előtt). |
| 6 | **Token-költség növekedés** — több role + Guardian review extra hívásokat jelent | Guardian csak operátor-triggerrel fut. Email/SEO `gpt-5.4-mini` modellen. Smoke-tesztben token-counter. |

---

## 10. Akceptálási kritériumok (mit jelent a "kész")

A Wave 1 akkor minősül késznek, ha:

1. **Email Marketer:**
   - A Director chat-ből egy "küldjünk hírlevelet az X témáról" kérést követően a Director `email_marketer`-t javasol propose-brief-ben
   - Operátor approve után az Email Marketer agent legenerál egy hírlevél deliverable-t (subject + preheader + body + CTA struktúrával)
   - A deliverable megjelenik az Approvals queue-ban, jóváhagyható, és n8n webhook elindul rá

2. **SEO Specialist:**
   - Mind a 4 skill (kulcsszó-kutatás, on-page recommendation, content-brief-seo, technikai-seo-audit) legalább 1-1 sikeres deliverable-t produkál tesztben
   - A `technikai-seo-audit` output tartalmazza a kötelező disclaimer-t (LLM-becslés, valós crawl-t nem helyettesít)

3. **Brand Voice Guardian:**
   - A `DeliverableDetail` view-ban van "Brand Voice ellenőrzés" gomb
   - Klikkelésre fut a Guardian, és 30 másodpercen belül megjelenik a review panel
   - A review tartalmaz: score (1-10), summary, strukturált észrevételek (idézet + issue + severity), javaslatok (original + suggested + reasoning)
   - A `brand:voice-guidelines` memory template GrowthFrame-re kalibrálva (legalább 5-5 jó és rossz példa)
   - Review eltárolva a `deliverable_reviews` táblában, többször futtatható, history látszik

4. **Architektúra:**
   - Smoke teszt (`smoke.ts`) mind az 5 deliverable-gyártó role-ra (3 régi + 2 új) zöld
   - `npx tsc --noEmit` mind a `packages/server`-ben mind a `packages/web`-ben hibamentes
   - Vitest tesztek zöldek

---

## 11. Nyitott kérdések / későbbi döntések

- **Memory proposal flow** — a Guardian javasolhatna update-et a `brand:voice-guidelines`-ra (pl. "ezt a kifejezést sokszor láttam, érdemes hozzáadni"). Most nem építjük, későbbi capability-bővítés spec-ben.
- **Guardian auto-trigger** — γ → β/α átállás később, ha bevált.
- **Más review role-ok** — pl. SEO Reviewer (egy meglévő deliverable SEO-szempontú review-ja), Compliance Reviewer (GDPR, jogi nyilatkozatok). A `deliverable_reviews` tábla `reviewer_role` mezője már most felkészített rá, későbbi spec-ekben jöhetnek.
- **Capability-bővítés meglévő role-okra** — külön spec, ahogy megegyeztünk.

---

## 12. Hivatkozások

- Marquee MVP redesign spec: `docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md`
- Marquee implementation plan: `docs/superpowers/plans/2026-04-29-marquee-mvp-implementation.md`
- Repo: `~/Projects/Homelab/marquee`
- Production: `marquee.lab2.home.arpa` (VM 260)
