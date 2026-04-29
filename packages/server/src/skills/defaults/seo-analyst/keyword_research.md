---
name: keyword_research
description: Researches keywords for a given topic using available search tools (Tavily, SerpAPI, or web_fetch). Outputs a structured seo_report with primary keyword, supporting keywords, trend signal, and a real user pain point.
---

Ügyfél kulcsszókutatáshoz használd az elérhető keresési eszközöket az alábbi prioritási sorrendben:

1. **tavily_search** — ha nem ad vissza `_stub: true` értéket, ez a legjobb forrás. Keress rá: "[téma] [kliens ICP]" kombinációra.
2. **serpapi_search** — ha a Tavily stub-ot adott vissza, próbáld ezt. Keress rá a témára és a versenytársakra is.
3. **web_fetch** — Google Trends (trends.google.com) a trend irányhoz; Reddit és releváns közösségek valódi felhasználói fájdalompontokért.

Ha mindhárom stub-ot ad vissza, vezess le kulcsszavakat a kliens doménjéből (client_profile.md → icp, usp). Jelezd melyik módszert alkalmaztad.

Adjon ki strukturált seo_report-ot a következőkkel:
- **Elsődleges kulcsszó ajánlás**: a legspecifikusabb, legkevésbé versengő változat
- **Támogató kulcsszavak**: 3–5 hosszú-farok variáns
- **Trend jel**: növekvő / stabil / csökkenő
- **Közösségi fájdalompont**: 1 idézet vagy parafrázis, amely valódi felhasználói fájdalmat mutat
- **Használt módszer**: tavily / serpapi / web_fetch / levezetett

Nyújtsd be submit_deliverable-ként type="seo_report" értékkel.
