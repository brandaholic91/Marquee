---
name: delegate
when_to_use: emlékeztetőként és referencia táblázatként arra, hogy melyik deliverable_type-hoz melyik specialist tartozik
---

Ez a skill egy referencia tábla. Használd minden alkalommal, amikor `propose_brief`-et adsz le, hogy biztosan a helyes `target_specialist` mezőt töltsd ki.

## Routing tábla

| Feladat típusa | deliverable_type | target_specialist |
|---|---|---|
| Blog poszt, landing page szöveg, cikk, white paper | `blog_post` | `copywriter` |
| SEO-fókuszú cikk, content brief Copywriter-nek | `blog_post` | `seo-specialist` |
| Kulcsszó-kutatás, on-page audit, technikai SEO checklist | `blog_post` | `seo-specialist` |
| Hírlevél, drip sorozat, transactional email, re-engagement email | `email` | `email-marketer` |
| Social poszt: Instagram, LinkedIn, Twitter, Threads | `social_post` | `social-manager` |
| Fizetett hirdetés: Meta, Google, LinkedIn ads | `ad_copy` | `paid-specialist` |

**Kulcsszabály emaileknél:** Minden email jellegű feladathoz (`email` deliverable_type) az `email-marketer`-t válaszd — nem a `copywriter`-t. A copywriter csak blog poszthoz és landing page szöveghez való.

## Specialist képességek röviden

**copywriter** — hosszabb formátumú, SEO-tudatos szövegek: blog poszt, landing page, cikk. Strukturált `structured_data`-t ad vissza (title, slug, meta description stb.).

**email-marketer** — minden email típus: hírlevél, drip/nurture sorozat, welcome email, abandoned cart, re-engagement. Subject line variációkat, preheadert és CTA-t ad vissza.

**seo-specialist** — SEO-feladatok: kulcsszó-kutatás (disclaimer-rel), on-page ajánlás, technikai SEO audit, SEO content brief Copywriter-nek.

**social-manager** — rövid, platform-natív posztok. Ismeri az Instagram hook-kultúrát, a LinkedIn gondolatvezér formátumot, a Twitter 280 char-os korlátját. Minden poszthoz `visual_brief`-et is ad (Instagram esetén kötelező).

**paid-specialist** — hirdetési szövegek karakterlimiten belül. Meta headline 40 char, Google RSA 15 headline (30 char/db) + 4 description (90 char/db). Több variánst (3-5) készít egyszerre.

## Fontos szabályok

1. A `target_specialist` mezőt a fenti táblázat alapján mindig töltsd ki a `propose_brief` hívásban.
2. Ha az operátor nem adja meg a `deliverable_type`-ot, kérdezz rá a `brief_intake` skill szerint.
3. Ha a platform nem egyértelmű (`social_post` vagy `ad_copy` esetén), kérdezz rá — a specialist szüksége van rá a megfelelő formátumhoz.
4. `brand_voice_guardian` soha nem kerülhet `target_specialist`-ként a `propose_brief`-be — ez review role, kizárólag az operátor indítja a UI-ból.
