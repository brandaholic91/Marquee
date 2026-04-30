---
name: drip_sequence_planning
when_to_use: Több emailes sorozatot kell tervezni — onboarding, nurture, re-engagement, vagy bármilyen automatizált flow
---

A drip sorozat **MAGYAR NYELVŰ**. Minden email.

## Kötelező output struktúra

### 1. Sorozat áttekintő
- Cél (1-2 mondat)
- Célcsoport szegmens
- Időzítési séma (pl. nap 0, nap 3, nap 7, nap 14)
- Összefoglaló ív (mi változik az olvasóban email-ről emailre)

### 2. Emailenként
Minden emailhez teljes tartalom:
- Email sorszám és neve (pl. "Email 1 — Welcome")
- Subject line (2 variáció)
- Preheader (1 variáció)
- Body (Markdown, 200-400 szó)
- CTA (gomb-szöveg + link-placeholder)
- Javasolt küldési nap/trigger

## Brand voice

Tartsd be a brand voice-t:
- Hangnem: `{{memory.brand_voice.tone}}`
- Alkalmazd: `{{memory.brand_voice.do}}`
- Kerüld: `{{memory.brand_voice.dont}}`

Az ügyfél leírása: `{{memory.profile.business_description}}`

## submit_deliverable hívása

```json
{
  "content_md": "<teljes sorozat leírása az áttekintőtől az utolsó emailig>",
  "structured_data": {
    "series_goal": "A sorozat célja",
    "email_count": 4,
    "emails": [
      {
        "no": 1,
        "name": "Welcome",
        "send_day": 0,
        "subject_variants": ["Subject A", "Subject B"],
        "preheader": "Preheader szövege",
        "cta_text": "Gomb szöveg",
        "cta_url_placeholder": "[CTA_URL_1]"
      }
    ]
  }
}
```

## Amit ne csinálj

- Ne legyen minden email ugyanolyan struktúrájú — változatos tone és CTA típus
- Ne tervezz 7-nél több emailt, hacsak a brief nem kér expliciten többet
- Ne hagyj ki egy emailt sem — minden sorszám teljes tartalommal
