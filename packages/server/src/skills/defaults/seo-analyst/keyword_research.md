---
name: keyword_research
description: Researches keywords for a given topic using available search tools (Tavily, SerpAPI, or web_fetch). Outputs a structured seo_report with primary keyword, supporting keywords, trend signal, and a real user pain point.
---

## Első lépés: olvasd el a kliens memóriát

Mielőtt bármit keresel, olvasd be a `read_memory` eszközzel:
- `client_profile.md` — client_name, icp, usp, competitors, brand_voice
- `brand_guidelines.md` — tone_of_voice, reference_posts

A kulcsszavaknak a kliens **tényleges differenciátorait** kell tükrözniük (usp, icp fájdalompontjai), nem generikus iparági kifejezéseket.

## Keresési prioritás

1. **tavily_search** — keress rá: "[téma] + [kliens icp kulcselem]" kombinációra. Ha nem stub, ez az elsődleges forrás.
2. **serpapi_search** — ha Tavily stub, próbáld ezt. Keress versenytársakra is (client_profile.md → competitors).
3. **web_fetch** — Google Trends a trend irányhoz; Reddit és releváns fórumok valódi felhasználói fájdalompontokért.

Ha mindhárom stub, vezess le kulcsszavakat a memóriából. Jelezd egyértelműen, hogy nincs valódi keresési adat.

## Gotchas

- Soha ne állítsd bizonyítottnak azt, amit stub adatból "vezettél le" — jelezd az adathiányt.
- A kulcsszavaknak specifikusaknak kell lenniük: "hagyományos pécsi étterem helyi alapanyag" jobb, mint "étterem Pécs".
- A kliens USP-je és ICP fájdalompontjai legyenek beépítve a kulcsszójavaslatokba — ne legyen generikus.

## Output: strukturált seo_report

- **Ügyfél pozicionálása** (1 sor: mire épülnek a kulcsszavak)
- **Elsődleges kulcsszó**: legspecifikusabb, legkevésbé versengő, USP-re épülő variáns
- **Támogató kulcsszavak**: 3–5 hosszú-farok variáns, mindegyik a kliens differenciátorait tükrözi
- **Trend jel**: növekvő / stabil / csökkenő (forrással)
- **Közösségi fájdalompont**: 1 konkrét idézet vagy parafrázis valódi keresési/fórum forrásból
- **Adatminőség**: milyen forrásból dolgozott (tavily / serpapi / web_fetch / levezetett memóriából)

Nyújtsd be `submit_deliverable`-ként `type="seo_report"` értékkel.
