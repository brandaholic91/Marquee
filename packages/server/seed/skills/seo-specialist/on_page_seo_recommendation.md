---
name: on_page_seo_recommendation
description: On-page SEO elemzés — title tag, meta description, H-struktúra, belső linking és tartalmi javaslatok
---

Az on-page SEO recommendation **MAGYAR NYELVŰ**.

## Output struktúra

### 1. Meta elemek
- **Meta title javaslat** (3 variáció, max 60 karakter, tartalmazza a target keyword-öt)
- **Meta description javaslat** (2 variáció, max 160 karakter, tartalmazza a keyword-öt, cselekvésre ösztönöz)

### 2. H-struktúra elemzés
- Jelenlegi H1 (ha inputban van): megfelelő-e?
- Javasolt H1 (ha módosítani kell)
- H2 javaslatok (min. 3 H2, keyword és variánsok természetes elhelyezése)

### 3. Tartalmi hiányosságok
- Mi hiányzik a cikkből, amit a felhasználó keres ennél a keyword-nél?
- Javasolt belső linkek (ha a brief tartalmaz utalást más oldalakra)

### 4. Képek és médiatartalom
- Alt text javaslatok (ha relevánsan képekről van szó)

## submit_deliverable hívása

```json
{
  "content_md": "<teljes on-page SEO ajánlás dokumentum>",
  "structured_data": {
    "target_keyword": "kulcsszó",
    "meta_title_variants": ["Variant 1", "Variant 2", "Variant 3"],
    "meta_description_variants": ["Desc 1", "Desc 2"],
    "suggested_h1": "Javasolt H1"
  }
}
```

## Amit ne csinálj

- Ne ígérj konkrét ranking-javulást (nincs garancia)
- Ne hagyj el meta title/description variációkat — ezek a legfontosabb actionable output-ok
