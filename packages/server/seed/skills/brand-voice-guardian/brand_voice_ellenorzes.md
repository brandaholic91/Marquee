---
name: brand_voice_ellenorzes
when_to_use: Egy meglévő deliverable szövegét kell összevetni a brand voice guidelines-szal és strukturált review-t adni
---

A brand voice review **MAGYAR NYELVŰ** outputot ad.

## Feladatod

Elemezd a kapott deliverable szövegét a `<memory>` blokkban lévő `brand_voice_guidelines.md` alapján.

Figyelj különösen:
1. **Tiltott kifejezések** — megjelenik-e valamelyik a szövegben?
2. **Hangnem konzisztencia** — megfelel-e a `tone` elvárásoknak?
3. **Kötelező elemek** — szerepel-e minden aminek szerepelnie kell?
4. **Példamondatok mintáját** — közelebb van-e a `pelda_jo_mondatok` vagy a `pelda_rossz_mondatok` stílusához?

## Score kalibrálás

- **9-10:** Nincs eltérés. Brand voice-konzisztens.
- **7-8:** 1-2 kisebb finomítás kellene, de alapvetően OK.
- **4-6:** Több helyen eltér. Visszaküldés javasolt.
- **1-3:** Jelentős brand voice hiba. Azonnali visszaküldés.

## submit_review hívása

Hívd meg a `submit_review` tool-t az elemzés után:

```json
{
  "score": 7,
  "comments": [
    {
      "quote": "az érintett mondat a szövegből",
      "issue": "Tiltott kifejezés: 'forradalmasít'",
      "severity": "error"
    }
  ],
  "suggestions": [
    {
      "original": "forradalmasítja a piacot",
      "suggested": "alapjaiban alakítja át a döntéshozatalt",
      "reasoning": "A brand voice nem forradalmi retorikát használ, hanem konkrét, értékalapú megfogalmazást."
    }
  ],
  "summary": "1 tiltott szó és 2 hangnem-eltérés. Kisebb finomítások ajánlottak."
}
```

## Amit ne csinálj

- Ne írj subjektív véleményt guidelines alap nélkül — minden észrevétel legyen visszavezethető a guidelines-ra
- Ne legyen üres a comments tömb ha az eltérés nyilvánvaló (score < 8)
- Ne legyen üres a suggestions tömb ha comments-ben van `error` severity-jű elem
- Ne add le a review-t `submit_review` hívás nélkül
