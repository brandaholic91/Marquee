---
name: keyword_research
description: Researches keywords for a given topic using available search tools (Tavily, SerpAPI, or web_fetch). Outputs a structured seo_report with intent-classified keywords, priority tiers, topic cluster, and content format recommendations.
---

## Memória beolvasása

Mielőtt bármit keresel, olvasd be a `read_memory` eszközzel:
- `client_profile.md` — client_name, icp, usp, competitors, brand_voice
- `brand_guidelines.md` — tone_of_voice

A kulcsszavaknak a kliens **tényleges differenciátorait** kell tükrözniük, nem generikus iparági kifejezéseket.

## Keresési prioritás

1. **tavily_search** — keress "[téma] + [kliens icp kulcselem]" kombinációra. Ha nem stub, ez az elsődleges forrás.
2. **serpapi_search** — ha Tavily stub, próbáld ezt. Keress versenytársakra is.
3. **web_fetch** — Google Trends a trend irányhoz; Reddit és releváns fórumok valódi fájdalompontokért.

Ha mindhárom stub, vezess le a memóriából — de jelezd egyértelműen, hogy nincs valódi keresési adat.

## Keresési szándék

Minden kulcsszóhoz határozd meg a domináns szándékot, és rendeld hozzá a megfelelő tartalom formátumot:

| Szándék | Mikor releváns | Ajánlott deliverable típusok |
|---|---|---|
| **Informational** | Tudáskeresés, "hogyan", "mi az" | blog_post, útmutató, video_script, newsletter |
| **Commercial investigation** | Összehasonlítás, döntés előtt | blog_post (összehasonlító), case_study, linkedin_post, landing_page |
| **Transactional** | Cselekvésre kész, vásárlás/foglalás | landing_page, termékoldal, ad_copy, email |
| **Navigational** | Konkrét márkát keres | brand keyword, homepage copy |

**A kért deliverable típusa határozza meg a fókuszt.** Példák:
- `landing_page` → transactional és commercial kulcsszavak
- `blog_post` → informational és commercial investigation
- `linkedin_post` / `twitter_thread` → a téma szöge és fájdalompont (nem exact-match ranking)
- `ad_copy` / `email` → transactional

## Prioritizálás

Minden kulcsszóhoz becsüld meg kvalitatívan (1–5):
- **Relevancia** — mennyire illeszkedik a kliens USP-jéhez és ICP-jéhez
- **Versengés** — 1=alacsony, 5=magas (long-tail általában 1–2)
- **Szándék értéke** — transactional=5, commercial=4, informational=2

**Pontszám = (Relevancia × Szándék értéke) / Versengés**
Eredmény skála: ~0.4 (gyenge) → ~12.5 (kiváló). Magasabb = jobb prioritás.

## Tipikus hibák

- Stub adatból ne állíts bizonyított trendet vagy volumet — jelezd az adathiányt.
- Specifikusan kell: "[kliens USP eleme] + [iparág] + [helyszín]" jobb, mint "[iparág] + [helyszín]".
- A differenciátor legyen benne a kulcsszóban — a kliens USP az, ami megkülönbözteti a versenytársaktól.

## Output formátum

### Executive summary
2–3 mondat: fő megállapítás, domináns szándék, és hogyan illeszkedik a kért deliverable típushoz.

### Ügyfél pozicionálása
Egy mondat: mire épülnek a kulcsszavak (az USP-ből és ICP-ből levezetve).

### Kulcsszó prioritások

**Quick wins** (alacsony versengés, magas relevancia):
- [kulcsszó] | szándék: [intent] | pont: [X.X] | tartalom: [deliverable típus]

**Growth** (közepes versengés, magas érték):
- [kulcsszó] | szándék: [intent] | pont: [X.X] | tartalom: [típus]

**Long-term** (magas versengés, stratégiailag fontos):
- [kulcsszó] | szándék: [intent] | pont: [X.X] | tartalom: [típus]

### Topic cluster
- **Pillar kulcsszó**: a legerősebb primary keyword
- **Cluster kulcsszavak**: 3–5 supporting keyword a pillar köré
- **Tartalom térkép**: melyik kulcsszó melyik deliverable típushoz illik (blog, landing page, social, ad copy, email)

### Fájdalompont
1 konkrét idézet vagy parafrázis valódi keresési/fórum forrásból. Ha stub: jelezd és vezess le a kliens ICP-jéből.

### Adatminőség
Forrás: tavily / serpapi / web_fetch / memóriából levezetett.

---

**Zárd le: `submit_deliverable` hívással, `type="seo_report"`.**
