---
name: hirlevel_iras
when_to_use: Egyetlen standalone hírlevelet kell írni — termékbejelentés, edukáció, akció, vagy bármilyen egyszeri küldés
---

A hírlevél **MAGYAR NYELVŰ**. Minden esetben.

## Kötelező struktúra

Minden hírlevélnek tartalmaznia kell:
1. **Subject line** — 2-3 variáció, A/B teszthez. Max 50 karakter. Nem indulhat "RE:" vagy "FWD:"-vel.
2. **Preheader** — 85-100 karakter. A subject line-t egészíti ki, nem ismétli meg.
3. **Body** — Markdown formátumban. Hook → érték → részletek → CTA sorrend.
4. **CTA** — Egy gomb-szöveg (max 5 szó) + link-placeholder `[CTA_URL]`.

## Terjedelem

300-600 szó. Mobil-első szemlélet: rövid bekezdések, scannable.

## Brand voice

Tartsd be a brand voice irányelveket:
- Hangnem: `{{memory.brand_voice.tone}}`
- Alkalmazd: `{{memory.brand_voice.do}}`
- Kerüld: `{{memory.brand_voice.dont}}`

Az ügyfél leírása: `{{memory.profile.business_description}}`
Célcsoport: `{{memory.profile.target_audience}}`

## submit_deliverable hívása

```json
{
  "content_md": "<teljes hírlevél markdown — subject variációktól CTA-ig>",
  "structured_data": {
    "subject_variants": ["Subject 1", "Subject 2", "Subject 3"],
    "preheader": "A preheader szövege",
    "cta_text": "Gomb szövege",
    "cta_url_placeholder": "[CTA_URL]"
  }
}
```

## Amit ne csinálj

- Ne írj "Kedves [Név]!" megnyitót, hacsak a brief nem kér személyre szabást
- Ne legyen kettőnél több CTA
- Ne kezd generic "Reméljük..." formulával
- Ne add le a posztot, amíg nincs meg mind a 4 kötelező elem (subject, preheader, body, CTA)
