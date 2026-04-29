---
name: keyword_research
description: Researches keywords for a given topic using available search tools (Tavily, SerpAPI, or web_fetch). Outputs a structured seo_report with intent-classified keywords, priority tiers, topic cluster, and content format recommendations.
---

## Első lépés: olvass memóriát

Mielőtt bármit keresel, olvasd be a `read_memory` eszközzel:
- `client_profile.md` — client_name, icp, usp, competitors, brand_voice
- `brand_guidelines.md` — tone_of_voice

A kulcsszavaknak a kliens **tényleges differenciátorait** kell tükrözniük, nem generikus iparági kifejezéseket.

## Keresési prioritás

1. **tavily_search** — keress "[téma] + [kliens icp kulcselem]" kombinációra. Ha nem stub, ez az elsődleges forrás.
2. **serpapi_search** — ha Tavily stub, próbáld ezt. Keress versenytársakra is.
3. **web_fetch** — Google Trends a trend irányhoz; Reddit és releváns fórumok valódi fájdalompontokért.

Ha mindhárom stub, vezess le a memóriából. Jelezd expliciten az adathiányt.

## Keresési szándék klasszifikáció

Minden kulcsszóhoz határozd meg a domináns szándékot:

- **Informational** (tudáskeresés) → blog poszt, útmutató, cikk
- **Commercial investigation** (összehasonlítás, döntés előtt) → összehasonlító cikk, "miért mi" oldal
- **Transactional** (cselekvésre kész) → landing page, foglalási oldal, termékoldal

**Fontos**: Kérdésalapú lekérdezések nem automatikusan informational intent — "hol találok [termék/szolgáltatás] [helyszín]-en" = commercial investigation. Ellenőrizd a SERP formátumát a szándék megerősítéséhez.

## Prioritizálási framework

Minden kulcsszóhoz becsüld meg kvalitatívan (1-5):
- **Relevancia** a kliens USP-hez és ICP-hez
- **Versengés** (1=alacsony, 5=magas) — long-tail általában alacsonyabb
- **Szándék értéke** (transactional=5, commercial=4, informational=2)

Összpontszám = (Relevancia × Szándék értéke) / Versengés → magasabb = jobb

## Gotchas

- Soha ne állítsd bizonyítottnak azt, ami stub adatból "levezetett" — jelezd az adathiányt.
- A kulcsszavaknak specifikusaknak kell lenniük: a kliens USP elemeit tartalmazzák.
- Ne legyen generikus: "[iparág] [helyszín]" rossz, "[kliens USP eleme] + [iparág] + [helyszín]" jó — a differenciátor legyen benne.

## Output: strukturált seo_report

### Executive summary
2-3 mondat: mi a fő megállapítás, melyik szándék domináns, mi a javasolt tartalom típus.

### Ügyfél pozicionálása
Egy sor: mire épülnek a kulcsszavak (az USP-ből és ICP-ből).

### Kulcsszó prioritás tiers

**Quick wins** (alacsony versengés, magas relevancia — azonnal indítható):
- [kulcsszó] | szándék: [intent] | pont: [X.X] | tartalom: [blog/landing/stb.]

**Growth** (közepes versengés, magas érték — következő tartalmakhoz):
- [kulcsszó] | szándék: [intent] | pont: [X.X] | tartalom: [típus]

**Long-term** (magas versengés, de stratégiailag fontos):
- [kulcsszó] | szándék: [intent] | pont: [X.X] | tartalom: [típus]

### Topic cluster javaslat
- **Pillar kulcsszó**: [a legerősebb primary keyword]
- **Cluster kulcsszavak**: [3-5 supporting keyword ami a pillar köré épül]
- **Javasolt tartalom struktúra**: pillar cikk témája + 2-3 supporting cikk ötlet

### Közösségi fájdalompont
1 konkrét idézet vagy parafrázis valódi keresési/fórum forrásból (ha stub, jelezd).

### Adatminőség
Milyen forrásból dolgozott: tavily / serpapi / web_fetch / levezetett memóriából.

Nyújtsd be `submit_deliverable`-ként `type="seo_report"` értékkel.
