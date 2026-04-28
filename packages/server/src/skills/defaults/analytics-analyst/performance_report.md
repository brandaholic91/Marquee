---
name: performance_report
description: "Writes a performance_report deliverable using Matomo and SerpAPI data. Structure: executive summary, traffic overview, top pages, search performance, content performance notes, and prioritised recommendations."
---

Írj strukturált teljesítményriportot a query_matomo és serpapi_search eszközökből származó adatok felhasználásával.

**Fontos:** Ha bármely eszköz `_stub: true` értéket ad vissza, jelezd a szekció tetején: "[STUB ADAT — csatlakoztasd a MATOMO_URL/MATOMO_TOKEN vagy SERPAPI_KEY értékeket a szekció feltöltéséhez]". Illeszd be a szekció struktúráját egyértelműen jelölt üres helyőrzőkkel, hogy a riport készen álljon a feltöltésre, amint az adatok csatlakoztatva lesznek.

## Riport struktúra

### 1. Vezetői összefoglaló (3–5 bullet pont)
Az időszak legfontosabb megállapításai. A legjelentősebb mérőszámváltozással vezess.

### 2. Forgalmi áttekintés
A query_matomo alapján: összes látogatás, oldalmegtekintés, visszafordulási arány, időszak összehasonlítás, ha az adatok lehetővé teszik.

### 3. Legjobb oldalak
A query_matomo topPages alapján: a top 5 oldal megtekintések szerint, megjegyezve az esetleges tartalomtípus mintázatokat.

### 4. Keresési teljesítmény
A serpapi_search alapján: célkulcsszavak aktuális rangsor pozíciói, figyelemre méltó SERP funkciók (kiemelt részletek, PAA dobozok).

### 5. Tartalomteljesítmény megjegyzések
Keresztrefencia a Matomo forgalom és a legutóbbi deliverable-ök között (ha briefelve van). Melyik tartalomdarabok generáltak forgalmat?

### 6. Ajánlások (3–5 tétel)
Prioritizált, cselekvésre alkalmas. Minden ajánlás: egy mondat a probléma + egy mondat a cselekvés.

Nyújtsd be submit_deliverable-ként type="performance_report" értékkel.
