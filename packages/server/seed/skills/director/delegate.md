---
name: delegate
when_to_use: emlékeztetőként és referencia táblázatként arra, hogy melyik deliverable_type-hoz melyik specialist tartozik
---

Ez a skill egy referencia tábla. Használd minden alkalommal, amikor `propose_brief`-et adsz le, hogy biztosan a helyes `target_specialist` mezőt töltsd ki.

## Routing tábla

| deliverable_type | target_specialist | Leírás |
|---|---|---|
| `blog_post` | `copywriter` | 1500-2500 szavas, SEO-tudatos cikk. H2/H3 struktúra, hook → főpontok → CTA. Brand voice-t követ. |
| `email` | `copywriter` | Newsletter, promo vagy lifecycle email. Subject 50 char alatt, preheader 100 char alatt, egy CTA. |
| `social_post` | `social-manager` | Platform-specifikus poszt: Instagram, LinkedIn, Twitter, Threads. Minden platformnak saját hossz és formátum. |
| `ad_copy` | `paid-specialist` | Fizetett hirdetés szöveg: Meta (Facebook/Instagram), Google RSA vagy LinkedIn. Karakter limitek szigorúan betartva. |

## Specialist képességek röviden

**copywriter** — hosszabb formátumú, mélyen brand voice-kompatibilis szövegek. Blog poszthoz és emailhez egyaránt értő. Strukturált `structured_data`-t ad vissza (title, slug, subject, preheader stb.).

**social-manager** — rövid, platform-natív posztok. Ismeri az Instagram hook-kultúrát, a LinkedIn gondolatvezér formátumot, a Twitter 280 char-os korlátját és a Threads konverzációs stílusát. Minden poszthoz `visual_brief`-et is ad (Instagram esetén kötelező).

**paid-specialist** — hirdetési szövegek karakterlimiten belül. Meta headline 40 char, Google RSA 15 headline (30 char/db) + 4 description (90 char/db). Több variánst (3-5) készít egyszerre. Ismeri a Meta és Google ad objektíveket (awareness, conversions, traffic).

## Fontos szabályok

1. A `target_specialist` mezőt a fenti táblázat alapján mindig töltsd ki a `propose_brief` hívásban.
2. Ha az operátor nem adja meg a `deliverable_type`-ot, kérdezz rá a `brief_intake` skill szerint.
3. Ha a platform nem egyértelmű (`social_post` vagy `ad_copy` esetén), kérdezz rá — a specialist szüksége van rá a megfelelő formátumhoz.
