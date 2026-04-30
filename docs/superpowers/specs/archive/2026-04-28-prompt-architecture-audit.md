# Marquee Prompt Architecture Audit

**Dátum:** 2026-04-28
**Státusz:** review note / architectural recommendation
**Típus:** jelenlegi agent system prompt felépítés auditja és refaktor javaslat

---

## 1. Cél

Ez a dokumentum a Marquee jelenlegi prompt-architektúráját vizsgálja a szerveroldali agent runtime alapján. A cél:

- feltérképezni, hogyan áll össze ma egy agent system promptja,
- elkülöníteni a valódi system promptot a cron vagy user-oldali task promptoktól,
- értékelni a mostani szerkezet működőképességét,
- javaslatot tenni egy kis kockázatú, fokozatos refaktor irányra.

Ez a dokumentum nem implementáció, hanem állapotleírás és ajánlás.

---

## 2. Jelenlegi állapot

### 2.1 A system prompt összerakásának helye

A tényleges agent system prompt központilag itt épül:

- `packages/server/src/agents/factory.ts`

A `buildSystemPrompt(role, dataDir)` függvény jelenleg az alábbi részekből építkezik:

1. fix alap instrukciók,
2. role-hoz tartozó skill recipe blokkok,
3. opcionális behavior/config blokk.

Jelenlegi fix alapszöveg:

```text
You are the <role> agent of the AI marketing agency.

Use only the tools provided. Do not attempt actions outside your toolset.

Read memory before making client-specific decisions.
```

Ezután a role összes betöltött skillje `## Skill: ...` blokkokként kerül a promptba.

### 2.2 A skill recipe-k forrása

A skill-ek a runtime `dataDir/skills/<role>/*.md` útvonalról töltődnek be.

Kód:

- `packages/server/src/skills/loader.ts`

Default seed források:

- `packages/server/src/skills/defaults/**`

Ez azt jelenti, hogy a promptok nagy része nem TS stringként, hanem markdown recipe-ként él.

### 2.3 Memory és system prompt szétválasztása

Fontos, hogy a memory jelenleg nem a system prompt része. A memory külön context blokk formájában injektálódik a model input elejére.

Kód:

- `packages/server/src/agents/transform-context.ts`

Ennek a működése:

1. role alapján kiválaszt releváns memory fájlokat,
2. ezekből `<memory_block>` szerkezetet készít,
3. ezt a blokkot a promptoláskor a model felé menő üzenetek elejére teszi.

Tehát a jelenlegi architektúrában:

- a system prompt = szerep + szabályok + skill recipe-k,
- a memory = külön user-context blokk.

Ez alapvetően jó szétválasztás.

### 2.4 Opcionális config / behavior réteg

Van támogatás role-specifikus config alapú viselkedési blokkokra:

- `packages/server/src/agents/config.ts`

Támogatott mezők:

- `style`
- `tone`
- `response_length`
- `language`
- `model`
- `thinking_level`
- `system_prompt_override`

Az override helye runtime szinten:

- `dataDir/agents/<role>/config.md`

Jelenlegi fontos megfigyelés:

- a repóban nincs check-inelt `config.md`,
- ezért a mostani repo-állapot alapján nincs aktív prompt override.

### 2.5 Mi számít system promptnak, és mi nem

Valódi system prompt források jelenleg:

- `packages/server/src/agents/factory.ts`
- `packages/server/src/skills/defaults/**`
- opcionálisan `dataDir/agents/<role>/config.md`

Nem system prompt, hanem fix task prompt vagy emberi input példák:

- `packages/server/src/cron/morning-brief.ts`
- `packages/server/src/cron/monthly-review.ts`
- `packages/server/src/cron/weekly-report.ts`

Ezek agentnek küldött task üzenetek, nem az agent tartós identitásának részei.

---

## 3. Jelenlegi prompt-struktúra role-onként

### 3.1 Director

A Director prompt jelenleg két fő skillből áll:

- `brief_parser`
- `lead_router`

Tartalmi funkciók:

- brief strukturálás,
- Stackly-specifikus ICP validáció,
- deliverable típus alapú lead routing,
- direkt specialist delegálás tiltása.

### 3.2 Content Lead

A `content-lead` prompt főként egy átadási recipe-re épül:

- `editorial_brief_handoff`

Tartalmazza:

- a blog brief szerkezetét,
- keyword és angle megadásának szabályát,
- brand voice elvárást,
- CTA és USP beemelési elveket.

### 3.3 Copywriter

A `copywriter` prompt jelenleg erősen deliverable-specifikus:

- `blog_post_writer`

Tartalmazza:

- teljes blogposzt-szerkezet,
- H1 / intro / body / CTA elvárások,
- hangnem és tiltások,
- `submit_deliverable` output contract.

### 3.4 Eval Judge

Az `eval-judge` jelenleg két skillt kap egyszerre:

- `three_dim_review`
- `three_dim_review_extended`

Ez jelenleg együtt kerül a system promptba, explicit kiválasztási logika nélkül.

Következmény:

- az agent egyszerre lát egy általános és egy LinkedIn-specifikus rubricot,
- a prompt nem mondja ki strukturáltan, hogy melyik mikor elsődleges.

### 3.5 Distribution Lead

Jelenlegi skill-ek:

- `linkedin_brief_coordinator`
- `landing_page_coordinator`

Ezek egyszerre fednek le:

- workflow utasítást,
- specialist brief struktúrát,
- tartalmi minőségi guideline-okat.

### 3.6 Social Manager

Jelenlegi skill:

- `linkedin_post_writer`

Ez lényegében egy egyetlen deliverable-formátumra optimalizált prompt.

### 3.7 Insights Lead

Jelenlegi skill-ek:

- `seo_insights_coordinator`
- `keyword_brief`

Feladatkörei:

- seo-analyst koordinálása,
- visszaérkező `seo_report` tömörítése,
- a content team számára rövid keyword brief előállítása.

### 3.8 SEO Analyst

Jelenlegi skill-ek:

- `keyword_research`
- `on_page_audit`

Jelleg:

- részben research recipe,
- részben audit checklist,
- részben output szerződés.

### 3.9 Későbbi szerepkörök promptjai

A repóban már jelen vannak későbbi role-ok default skilljei is:

- `analytics-analyst/performance_report.md`
- `paid-specialist/campaign_brief_writer.md`
- `repurposer/content_repurposer.md`

Ezek ugyanabba a prompt-összeállítási mechanizmusba esnek.

---

## 4. Erősségek

### 4.1 Központi összeállítás

A system prompt központi építése jó döntés.

Előnyök:

- egy helyen látszik a prompt assembly,
- könnyebb tesztelni,
- könnyebb később finomítani a teljes szerkezetet.

### 4.2 Markdown-alapú role skill-ek

A role-onkénti markdown recipe felosztás jó kompromisszum.

Előnyök:

- a promptszöveg nem szóródik szét a runtime logikában,
- könnyebb promptokat iterálni TS-kód változtatás nélkül,
- jobban olvasható, mint egy nagy, hardcode-olt prompt factory.

### 4.3 Toolset mint valódi határ

A jogosultsági határ nem csak promptban jelenik meg, hanem a tool registry szintjén is.

Ez nagyon fontos előny, mert:

- a tiltások nem csak instrukciók,
- a modell tényleg nem kap hozzáférést olyan műveletekhez, amiket nem kell végeznie.

### 4.4 Memory külön rétegben

A memory elkülönítése a system prompttól jó architekturális döntés.

Előnyök:

- kisebb a system prompt állandó zajszintje,
- a kliens-specifikus adat nem keveredik teljesen a viselkedési szabályokkal,
- role-onként differenciált memory injection lehetséges.

### 4.5 MVP-szinten jól működő egyszerűség

A jelenlegi felépítés kis szerepkörszám mellett, egyetlen domináns klienssel és néhány deliverable típussal használható és viszonylag könnyen érthető.

---

## 5. Gyengeségek és kockázatok

### 5.1 Túl sok Stackly-hardcode a recipe-kben

Számos skill body tartalmaz fix üzleti feltételezéseket:

- Stackly mint kliensnév,
- PLG SaaS mint ICP,
- konkrét USP,
- konkrét reference voice,
- konkrét kulcsszófókusz.

Ez addig működik jól, amíg a rendszer gyakorlatilag egyetlen account / ügyfél / világkép köré szervezett.

Kockázat:

- nehezebb több kliensre vagy több brandre általánosítani,
- a kliensspecifikus tudás nem kizárólag memoryban él,
- a recipe és a memory felelősségi köre összemosódik.

### 5.2 Skill-típusok keveredése

Egy-egy skill egyszerre hordoz:

- identitást,
- workflow policy-t,
- tartalmi minőségi elvárást,
- output formátumot.

Ennek következménye:

- nehezebb célzottan finomítani csak egy viselkedési dimenziót,
- nehezebb kiszedni vagy újrahasznosítani egy-egy szabályt,
- egy recipe-ben sok különböző felelősség keveredik.

### 5.3 Nincs explicit skill-prioritás vagy sorrend

A `loadSkillsForRole()` a fájlokat egyszerűen `readdirSync()` alapján tölti be.

Ez azt jelenti, hogy:

- nincs külön prioritásmező,
- nincs deklarált ordering policy,
- a prompt blokksorrend implicit.

Kockázat:

- a végső system prompt stabilitása romlik,
- új skill hozzáadása megváltoztathatja a prompt hangsúlyait,
- a prompt evolúció kevésbé kontrollálható.

### 5.4 Eval Judge prompt zajossága

Az `eval-judge` egyszerre látja:

- az általános deliverable-rubricot,
- a LinkedIn-specifikus külön rubricot.

Mivel nincs explicit conditional assembly, az agentnek magának kell eldöntenie, melyik blokkot tekinti elsődlegesnek.

Kockázat:

- kevésbé konzisztens scoring,
- nehezebb bővíthetőség új deliverable típusok esetén,
- növekvő prompt-zaj.

### 5.5 Workflow policy és orchestration részben promptba van kódolva

Például a Director routingja ma részben prompt recipe szintjén van leírva.

Ez MVP-ben teljesen elfogadható, de hosszabb távon kérdéses, hogy mi maradjon:

- policy a kódban,
- és mi maradjon:
- rugalmas instrukció a promptban.

Ha a routing logika nő vagy bonyolódik, a prompt-only policy törékenyebbé válhat.

### 5.6 A prompt jelenleg túl sokat bíz az implicit model-értelmezésre

A jelenlegi recipe-k többsége deklaratív, de kevés helyen van világosan elkülönítve:

- mi kötelező szabály,
- mi ajánlás,
- mi példa,
- mi fallback viselkedés.

Ez kis promptnál még működik, de nagyobb rendszerben konzisztenciavesztést okozhat.

---

## 6. Értékelés

### 6.1 Működőképesség

A jelenlegi architektúra működőképes.

Különösen jó rá:

- MVP iterációra,
- egy ügyfélre optimalizált agency proof-of-conceptre,
- néhány role és kevés deliverable típus kezelésére.

### 6.2 Optimalitás

Nem tekinthető optimális végállapotnak.

Korlátai leginkább itt jelennek meg:

- bővíthetőség,
- kliensfüggetlenítés,
- promptok stabil karbantarthatósága,
- deliverable-specifikus prompt szelekció.

### 6.3 Rövid minősítés

- működőképesség: erős,
- egyszerűség: erős,
- bővíthetőség: közepes,
- több klienses jövőállóság: gyenge-közepes.

---

## 7. Javasolt célállapot

### 7.1 Alapelv

A legjobb közeli célállapot nem egy teljes prompt engine bevezetése, hanem a jelenlegi rendszer fokozatos tisztítása.

Ajánlott irány:

1. a központi builder maradjon,
2. a markdown skill-ek maradjanak,
3. a felelősségi körök legyenek tisztábban szétválasztva,
4. a kliensspecifikus tudás kerüljön inkább memory/config szintre,
5. a deliverable-specifikus prompt-részek csak akkor töltődjenek be, amikor relevánsak.

### 7.2 Javasolt prompt-blokk kategóriák

Minden role system promptját érdemes 3-4 explicit kategóriára bontani.

Javasolt kategóriák:

- `identity`
- `workflow`
- `quality`
- `output`

Leírásuk:

#### identity

Az agent szerepe, döntési szemlélete, felelősségi határai.

Példa:

- ki vagy,
- kinek dolgozol,
- milyen típusú döntéseket hozhatsz,
- milyen típusú döntéseket nem.

#### workflow

Az agent működési folyamata.

Példa:

- briefet hogyan bonts fel,
- mikor delegálj,
- mikor kérj pontosítást,
- mikor submit-olj.

#### quality

A minőségi elvárások és stilisztikai szabályok.

Példa:

- brand voice,
- no-fluff szabály,
- hook minőség,
- factuality elvárás.

#### output

Pontosan milyen struktúrában vagy milyen toolhívással kell zárni a munkát.

Példa:

- `submit_deliverable type="blog_post"`,
- `submit_eval_report`,
- adott rövid kimeneti sablon.

Ez a bontás tisztábban szétválasztja a szerepidentitást, a folyamatot és a tartalmi minőséget.

---

## 8. Konkrét refaktor javaslatok

### 8.1 Tartsuk meg a központi `buildSystemPrompt()` modellt

Nem javasolt:

- a prompt-assembly szétszórása,
- role-onként külön kódszintű prompt builder-ek bevezetése.

Javasolt:

- a jelenlegi központi builder megtartása,
- de a skill-eket strukturáltabban rendezni.

### 8.2 Stabil skill-ordering bevezetése

Ez a legkisebb kockázatú és legnagyobb hozamú javítás.

Lehetséges megoldások:

1. fájlnév prefix:
   - `01_identity.md`
   - `02_workflow.md`
   - `03_quality.md`
   - `04_output.md`

2. frontmatter priority mező:
   - `priority: 10`
   - `priority: 20`

Ajánlás:

- rövid távon a fájlnév-prefix egyszerűbb,
- később frontmatter priority elegánsabb.

### 8.3 Stackly-hardcode csökkentése

Nem szükséges teljesen generikussá tenni a rendszert azonnal.

Elég első körben ezeket a fix elemeket kivonni:

- kliensnév,
- ICP,
- USP,
- brand voice fő kulcsai,
- keyword focus listák.

Javasolt helyük:

- `client_profile.md`
- `brand_guidelines.md`
- szükség esetén role config.

Az új recipe nyelv inkább így fogalmazzon:

- “validate against the client ICP from memory”
- “use the client USP naturally when relevant”
- “follow the brand voice in memory”

Így a rendszer továbbra is Stackly-first maradhat, de nem lesz minden skillbe beégetve ugyanaz az üzleti tartalom.

### 8.4 Eval Judge conditional prompt szétválasztása

Az eval réteg különösen jó jelölt célzott javításra.

Ajánlott felosztás:

- `eval_base.md`
- `eval_blog_post.md`
- `eval_linkedin_post.md`
- később `eval_landing_page.md`, `eval_seo_report.md`

Ideális működés:

1. mindig betöltődik az általános eval base,
2. a konkrét deliverable típus alapján betöltődik egy extra quality/rubric blokk.

Ennek eredménye:

- kisebb prompt-zaj,
- jobb konzisztencia,
- könnyebb bővítés.

### 8.5 Workflow policy és content guideline részleges szétválasztása

Különösen ezeknél fontos:

- `director`
- `distribution-lead`
- `content-lead`

Javaslat:

- a routing és delegation folyamat menjen külön workflow skillbe,
- a content minőség és brief formátum menjen külön quality/output skillbe.

Ez segít abban, hogy később a workflow-t anélkül lehessen módosítani, hogy közben a content guideline-hoz is hozzá kelljen nyúlni.

### 8.6 Strukturáltabb kötelező vs ajánlott szabálynyelv

Javasolt, hogy a recipe-kben világosabban különüljön el:

- kötelező szabály,
- ajánlás,
- példa,
- fallback.

Példa mintázat:

- `Required:`
- `Preferred:`
- `Example:`
- `Fallback:`

Ez növeli a model számára a prompt értelmezhetőségét és csökkenti a szürke zónákat.

---

## 9. Mit nem javasolt most megtenni

### 9.1 Teljes prompt engine bevezetése

Nem javasolt egy nagy, bonyolult dinamikus prompt-rendszer bevezetése ebben a fázisban.

Miért:

- túl nagy kockázat,
- a jelenlegi probléma még nem indokol ilyen szintű komplexitást,
- a kis, célzott refaktorok valószínűleg elégségesek.

### 9.2 Minden orchestration szabály kódszintre mozgatása

Nem érdemes mindent promptból policy-kódba áttolni.

Érdemesebb elválasztani:

- mi valódi rendszerkényszer,
- mi rugalmas agent-instrukció.

### 9.3 Teljes kliensfüggetlenítés egy lépésben

Nem szükséges rögtön teljes multi-client architektúrát erőltetni.

Elég:

- a legdurvább hardcode-ok fokozatos kivonása,
- a kliensidentitás memoryba terelése,
- az általánosítható recipe-nyelv bevezetése.

---

## 10. Ajánlott prioritási sorrend

### 10.1 Első kör

1. skill ordering stabilizálása,
2. `eval-judge` prompt szétválasztása base + deliverable-specifikus blokkokra.

### 10.2 Második kör

3. Stackly-hardcode csökkentése,
4. workflow és quality guideline részleges szétválasztása.

### 10.3 Harmadik kör

5. strukturáltabb routing policy,
6. deliverable- és context-aware skill assembly finomítása.

---

## 11. Rövid végső ajánlás

A jelenlegi prompt-architektúra MVP-re megfelelő, és nem igényel teljes újraírást.

A legjobb következő lépés nem egy radikális redesign, hanem három kis, biztonságos javítás:

1. stabil skill-sorrend,
2. `eval-judge` promptok szeparálása,
3. kliensspecifikus hardcode-ok fokozatos kivonása memory/config szintre.

Ez megőrzi a jelenlegi rendszer egyszerűségét, miközben jelentősen javítja:

- a promptok kiszámíthatóságát,
- a bővíthetőséget,
- a jövőbeli multi-client vagy multi-deliverable irány támogatását.
