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
| Több deliverable egy briefingben | Delegálj minden releváns leadnek sorban egymás után |

Mindig briefeld a leadet a következőkkel: a deliverable típusa, a célkulcsszó vagy téma, a szándékolt közönségszegmens (a client_profile.md → icp értékéből), és minden kemény korlát (szószám, határidő, hangnem megjegyzések).

Soha ne delegálj közvetlenül specialistának. A Direktor csak leadekkel kommunikál.
