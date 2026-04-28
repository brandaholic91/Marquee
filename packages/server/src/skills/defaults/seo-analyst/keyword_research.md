---
name: keyword_research
description: Researches keywords for a given topic using Google Trends and community sources. Outputs a structured seo_report with primary keyword, supporting keywords, trend signal, and a real user pain point.
---

Ügyfél kulcsszókutatáshoz használd a web_fetch eszközt a következők ellenőrzéséhez:
1. Google Trends (trends.google.com) a téma trendjéért (utolsó 12 hónap, világszerte)
2. Reddit és releváns közösségek a témához illő fájdalompontokért

Adjon ki strukturált seo_report-ot a következőkkel:
- **Elsődleges kulcsszó ajánlás**: a legspecifikusabb, legkevésbé versengő változat
- **Támogató kulcsszavak**: 3–5 hosszú-farok variáns
- **Trend jel**: növekvő / stabil / csökkenő (a Google Trends alapján)
- **Közösségi fájdalompont**: 1 idézet vagy parafrázis, amely valódi felhasználói fájdalmat mutat

Ha a web_fetch nem elérhető, vezess le kulcsszavakat a témából az ügyfél területspecifikus terminológiájával (client_profile.md → icp, usp). Jelezd, melyik megközelítést alkalmaztad.

Nyújtsd be submit_deliverable-ként type="seo_report" értékkel.
