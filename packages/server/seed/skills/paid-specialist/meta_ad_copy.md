---
name: meta_ad_copy
description: Meta hirdetésszövegek — primary text, headline és CTA variánsok Facebook és Instagram kampányokhoz
---

A hirdetési szöveg **MAGYAR NYELVŰ**. Minden esetben.

## Meta karakterlimitek — ezek kemény korlátok

| Mező | Limit | Megjegyzés |
|---|---|---|
| headline | **40 karakter** | SZIGORÚ limit — Google megvágja, ha túlléped |
| primary_text | 125 karakter (ajánlott), max 250 | A feed preview csak 125-öt mutat |
| description | **30 karakter** | SZIGORÚ limit |
| cta | enum | Lásd az engedélyezett értékek listáját |

## Engedélyezett CTA értékek

Kizárólag ezek közül válassz:
`Shop Now` | `Learn More` | `Sign Up` | `Get Offer` | `Subscribe` | `Download` | `Apply Now` | `Contact Us`

## Variánsok száma

Készíts **3-5 variánst** — különböző hook-okkal vagy keretrendszerrel:
- **1-2 variáns**: USP-alapú (egyedi versenyelőny kiemelése)
- **1 variáns**: social proof (eredmény, szám, ügyfél-siker)
- **1 variáns**: urgency/scarcity (időhöz kötött, korlátozott ajánlat) — csak ha a brief alátámasztja
- **1 variáns**: pain point (fájdalompont megnevezése és megoldás ígérete)

Ne gyártsd az összes variánst ugyanolyan szerkezettel — a Meta rotálja őket, a változatosság segíti az A/B tesztelést.

## Brand voice alkalmazása

A `primary_text` tükrözze a brand voice-t: `{{memory.brand_voice.tone}}`
Kerüld a hirdetésben is: `{{memory.brand_voice.dont}}`
Ügyfél USP: `{{memory.profile.usp}}`
Célcsoport: `{{memory.profile.target_audience}}`

## submit_deliverable hívása

```json
{
  "content_md": "<a variánsok táblázatos összefoglalója markdown formátumban>",
  "structured_data": {
    "platform": "meta",
    "objective": "awareness | conversions | traffic",
    "audience_brief": "1-2 mondat: kit célzunk és miért — pl. '25-45 éves kis- és középvállalkozók, akik CRM-et keresnek.'",
    "variants": [
      {
        "headline": "Headline max 40 char",
        "primary_text": "Primary text, ajánlott 125 char alatt, de max 250.",
        "description": "Leírás 30 char",
        "cta": "Learn More"
      },
      {
        "headline": "Második variáns headline",
        "primary_text": "Második variáns primary text...",
        "description": "Második leírás",
        "cta": "Sign Up"
      }
    ],
    "visual_brief": "lifestyle scene leírás — pl. 'üzleti megbeszélés modern irodában, természetes fény, 2 személy laptopnál'"
  }
}
```

**Konkrét példa (3 variáns):**
```json
{
  "content_md": "## Meta hirdetés variánsok\n\n| # | Headline | Primary text | Description | CTA |\n|---|---|---|---|---|\n| 1 | Több ügyfél, kevesebb... | Tudod hány ügyfeled... | Próbáld ki ingyen | Learn More |",
  "structured_data": {
    "platform": "meta",
    "objective": "conversions",
    "audience_brief": "30-50 éves KKV-tulajdonosok és értékesítési vezetők, akik szétszórt ügyféladatokat kezelnek.",
    "variants": [
      {
        "headline": "CRM, ami tényleg működik",
        "primary_text": "Hány ügyfelet veszítesz el azért, mert az adataik szétszórva vannak? Próbáld ki 14 napig ingyen.",
        "description": "14 napos próbaidőszak",
        "cta": "Learn More"
      },
      {
        "headline": "427 cég választotta tavaly",
        "primary_text": "Nem azért váltottak, mert olcsóbb voltunk. Azért, mert megtérült. Nézd meg az eredményeiket.",
        "description": "Valós eredmények",
        "cta": "Learn More"
      },
      {
        "headline": "Csak ma: 3 hónap fél áron",
        "primary_text": "Az ajánlat május 31-én lejár. Regisztrálj most és az első negyedéved 50%-kal olcsóbb.",
        "description": "Ajánlat máj. 31-ig",
        "cta": "Get Offer"
      }
    ],
    "visual_brief": "Üzleti életkép: fiatal vállalkozó laptopnál, tiszta modern iroda, természetes napfény, semleges háttér"
  }
}
```

## Amit ne csinálj

- Ne lépd túl a 40 karakteres headline limitet — számold meg, mielőtt leadod
- Ne lépd túl a 30 karakteres description limitet
- Ne használj CTA-t, ami nincs az engedélyezett listán
- Ne készíts minden variánst ugyanolyan hook-kal — a változatosság az A/B teszt célja
- Ne ígérj konkrét számokat vagy eredményeket, hacsak a brief nem tartalmaz validált adatokat
