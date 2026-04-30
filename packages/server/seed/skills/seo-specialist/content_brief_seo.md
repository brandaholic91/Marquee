---
name: content_brief_seo
description: SEO content brief Copywriternek — kulcsszó, javasolt cím, H2 struktúra, szószám és belső link javaslatok
---

Az SEO content brief **MAGYAR NYELVŰ**.

## Output struktúra

### 1. Kulcsszó stratégia
- Primary keyword
- Secondary keywords (3-5 db)
- Search intent (informational / commercial / transactional)

### 2. Javasolt struktúra
- H1 javaslat
- H2-k listája (min. 4, max 8)
- Opcionális H3 pontok ahol szükséges

### 3. Tartalmi követelmények
- Javasolt szóhossz
- Kötelező elemek: FAQ, táblázatok, példák, belső linkek (mit érdemes hozzáadni)
- Kerülendők: mi rontja az SEO-t ennél a témánál

### 4. Versenytárs-elemzés pontok
3-5 megfigyelés arról, milyen tartalmak rankolnak most ennél a témánál, és mi az a hozzáadott érték amit egy jó cikk adhat.

## submit_deliverable hívása

```json
{
  "content_md": "<teljes content brief dokumentum>",
  "structured_data": {
    "primary_keyword": "fő kulcsszó",
    "content_type": "article",
    "suggested_word_count": 1800,
    "h2_outline": ["H2 1", "H2 2", "H2 3"]
  }
}
```

## Amit ne csinálj

- Ne írj a Copywriter helyett tényleges cikket — ez egy brief, nem a végső tartalom
- Ne hagyj ki H-struktúra javaslatot — ez az SEO brief legfontosabb eleme
