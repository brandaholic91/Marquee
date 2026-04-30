---
name: brand_voice_review
description: Brand voice audit — deliverable szöveg pontozása guidelines alapján, észrevételekkel és konkrét javítási javaslatokkal
---

A brand voice review **MAGYAR NYELVŰ** outputot ad.

## Feladatod

Elemezd a kapott deliverable szövegét a `<memory>` blokkban lévő `brand_voice_guidelines.md` alapján.

Figyelj különösen:

1. **Tiltott kifejezések** — megjelenik-e valamelyik a `tiltott_kifejezesek_es_helyettesites` listából a szövegben?
2. **Hangnem és stílus konzisztencia** — megfelel-e a `tone` és `stilus` elvárásoknak (közvetlen, adatalapú, scannable, számokkal alátámasztott, tegező)?
3. **Kötelező elemek** — szerepel-e minden a `kotelezo_elemek` listából, ahol releváns (konkrét CTA, konkrét szám/idő állításnál, probléma + következő lépés páros, tegezés)?
4. **Példamondatok mintája** — közelebb van-e a szöveg a csatornaspecifikus `pelda_jo_mondatok_*` listák (`landing`, `linkedin`, `email_subject`, `email_body`, `audit_diagnozis`, `nehez_igazsag`) stílusához, vagy a `pelda_rossz_mondatok_nyilvanvalo_buzzword` / `pelda_rossz_mondatok_borderline` listák mintáihoz?

A **borderline rossz példák a legfontosabbak**: ezek első ránézésre OK-nak tűnnek, de a `miert` mező konkrét hiányt nevez meg (üres ígéret, szám nélküli állítás, generikus tagline, passzív „segítünk", buzzword-pár magyarázat nélkül stb.). Ha a deliverable hasonló mintát követ, az hibajelzés akkor is, ha nincs benne explicit tiltott szó.

## Suggestions a guidelines alapján

A `submit_review` hívás `suggestions[].suggested` mezőjét **lehetőleg a guidelines-ban explicit megadott helyettesítésből vedd**, ne találj ki sajátot:

- **Tiltott kifejezésnél:** a `tiltott_kifejezesek_es_helyettesites[].helyette` mező a kanonikus csere. Ezt használd vagy adaptáld a deliverable konkrét mondatához.
- **Borderline mintánál:** a `pelda_rossz_mondatok_borderline[].helyette` mező a guidelines által ajánlott átírást adja. Ezt vidd át a deliverable konkrét kontextusába.
- **Ha a guidelines nem fed le egy adott esetet,** írj saját javaslatot, de a `reasoning` mezőben hivatkozz a megsértett guidelines-szabályra konkrét listanévvel (`tone`, `stilus`, `kotelezo_elemek`, vagy egy konkrét `pelda_*` minta).

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
      "issue": "Tiltott kifejezés: 'forradalmasít' (tiltott_kifejezesek_es_helyettesites)",
      "severity": "error"
    }
  ],
  "suggestions": [
    {
      "original": "forradalmasítja a döntéshozatalt",
      "suggested": "alapjaiban kicseréli a döntéshozatalt",
      "reasoning": "A 'forradalmasít' tiltott. A guidelines által ajánlott helyettesítés: 'kicseréli / újraépíti / lecseréli'."
    }
  ],
  "summary": "1 tiltott szó és 2 hangnem-eltérés. Kisebb finomítások ajánlottak."
}
```

## Amit ne csinálj

- Ne írj szubjektív véleményt guidelines alap nélkül — minden észrevétel legyen visszavezethető a guidelines-ra konkrét listanévvel (`tone`, `stilus`, `tiltott_kifejezesek_es_helyettesites`, `kotelezo_elemek`, vagy konkrét `pelda_*` minta)
- Ne legyen üres a `comments` tömb ha az eltérés nyilvánvaló (score < 8)
- Ne legyen üres a `suggestions` tömb ha `comments`-ben van `error` severity-jű elem
- Ne add le a review-t `submit_review` hívás nélkül
- A `pelda_jo_mondatok_nehez_igazsag` listában szereplő hangnemet **ne** értékeld „túl agresszívnak" vagy „sértőnek" — ez a brand által szándékos és elfogadott regiszter (pl. „Nem te vagy a probléma. A rendszer hiánya az.")
