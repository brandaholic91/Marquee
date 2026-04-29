---
name: lead_router
description: "Routes a parsed brief to the correct lead based on deliverable type: content-lead for blog posts and articles, distribution-lead for LinkedIn posts and landing pages, insights-lead for SEO tasks. Defines delegation rules and what context to pass."
---

Routing szabályok:

| Ha a briefing kéri... | Delegálj ide |
|---|---|
| Blog poszt, cikk, hosszú formátumú tartalom | content-lead |
| LinkedIn poszt, social szöveg | distribution-lead |
| Landing oldal szöveg | distribution-lead |
| SEO kulcsszókutatás, oldalszintű audit | insights-lead |
| Több deliverable egy briefingben | Lásd az SEO-first sorrendet lent |

## SEO-first sorrend blog postokhoz és landing page-ekhez

Ha a brief blog_post vagy landing_page deliverable-t tartalmaz, **először** kérj kulcsszó kutatást az insights-leadtől, mielőtt a content-leadnek vagy distribution-leadnek delegálsz:

1. **Első lépés:** Delegálj az insights-leadnek: "Végezz kulcsszókutatást ehhez a témához: [téma]. Küldd vissza a javasolt elsődleges kulcsszót és 2-3 támogató kulcsszót."
2. **Várd meg** hogy az insights-lead visszaküldje az eredményt a `submit_to_director` toollal.
3. **Második lépés:** Delegálj a content-leadnek / distribution-leadnek a kulcsszóval kiegészített briefingel.

Ha a brief kifejezetten tartalmaz kulcsszót, akkor az 1-2. lépés kihagyható — mehet azonnal a leadnek.

Ha a brief LinkedIn posztot és landing page-et is tartalmaz egyszerre, és nincs kulcsszó: először insights-lead → majd distribution-lead mindkét feladattal.

## Általános szabályok

Mindig briefeld a leadet a következőkkel: a deliverable típusa, a célkulcsszó vagy téma, a szándékolt közönségszegmens (a client_profile.md → icp értékéből), és minden kemény korlát (szószám, határidő, hangnem megjegyzések).

Soha ne delegálj közvetlenül specialistának. A Direktor csak leadekkel kommunikál.
