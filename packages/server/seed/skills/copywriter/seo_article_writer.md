---
name: seo_article_writer
when_to_use: SEO-orientált cikk írása — csak akkor, ha a brief kontextusában van egy === FORRÁS DELIVERABLE === blokk (SEO Specialist által készített content_brief_seo)
---

## Előfeltétel ellenőrzés

Ha a kapott kontextusban **nincs** `=== FORRÁS DELIVERABLE ===` blokk, NE kezdj el cikket írni. Válaszolj:
> "Ehhez a skill-hez SEO content brief szükséges. Kérlek futtass SEO Specialist-et a content_brief_seo skill-lel, majd használd a handoff funkciót."

## Feladat

Írj SEO-orientált cikket a kapott SEO content brief alapján. A cikk célja: organikus keresési láthatóság + olvasói érték egyensúlya.

## Kötelező elemek az outputban

- **Target keyword** a H1-ben, az első 100 szóban és a meta description-ben
- **H-struktúra**: kövesd pontosan a SEO brief javasolt struktúráját (H2-k és H3-ak)
- **Szóhossz**: a SEO brief által javasolt range-en belül (±10%)
- **Search intent** szerinti mélység:
  - `informational` → magyarázó, edukatív, példákkal
  - `commercial` → összehasonlító, pro/con, döntéstámogató
  - `transactional` → vásárlás-orientált, CTA-val, konkrét következő lépéssel
- **FAQ szekció** — ha a SEO brief tartalmaz FAQ pontokat, ezek kötelezők
- **Internal link placeholder-ek** — legalább 2-3 helyen: `[INTERNAL LINK: <leíró szöveg>]` formátumban

## Output formátum

```
## Meta adatok
**Meta title** (max 60 kar): ...
**Meta description** (max 160 kar): ...

## Cikk

# [H1 — target keyword szerepel]

[Bevezető bekezdés — target keyword az első 100 szóban]

## [H2]
...

## FAQ

**[Kérdés]**
[Válasz]

## Internal link javaslatok
- [INTERNAL LINK: szöveg] → javasolt target oldal típusa
```

## Brand voice

Kövesd a `=== BRAND VOICE SZABÁLYOK ===` blokkban megadott szabályokat. A tiltott kifejezések nem szerepelhetnek az outputban.
