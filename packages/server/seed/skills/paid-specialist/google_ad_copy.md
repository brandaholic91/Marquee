---
name: google_ad_copy
when_to_use: ad_copy típusú brief érkezik Google Ads platformra — Responsive Search Ad (RSA) szövegezése szükséges
---

A hirdetési szöveg **MAGYAR NYELVŰ**. Minden esetben.

## Google RSA struktúra

A Google Responsive Search Ad automatikusan kombinálja a headline-okat és description-öket. Pontosan ennyi szöveget kell leadnod:

| Elem | Darabszám | Karakter limit / db |
|---|---|---|
| Headlines | **15 db** | **30 karakter** (SZIGORÚ) |
| Descriptions | **4 db** | **90 karakter** (SZIGORÚ) |

Mindkét limit KEMÉNY — a Google levágja a hosszabb szövegeket, és rontja az ad strength értékelést.

## Headlines — 15 különböző angle

A Google rotálja a headline-okat és egyszerre max 3-at mutat egymás után. Ezért minden headline más szögből közelítsen — **ne ismételj** lényeges tartalmat 2 headline-ban.

Kötelező angle-ök (legalább egyet adj mindegyikből):

1. **USP** — mi a legfőbb egyedi előny? (`{{memory.profile.usp}}`)
2. **Termék/Szolgáltatás neve vagy kategóriája** — egyértelmű azonosítás
3. **Social proof** — szám, eredmény, ügyfélszám (csak ha a brief tartalmaz validált adatot)
4. **Urgency** — határidő, korlátozott ajánlat (csak ha a brief alátámasztja)
5. **Pain point megoldás** — a fájdalom nevén nevezve, megoldás ígéretével
6. **Kulcsszó-alapú** — a keresési szándékra reflektáló headline (pl. "Legjobb CRM kis cégeknek")
7. **CTA-headline** — cselekvésre szólítás (pl. "Próbáld ki ingyen 14 napig")
8. **Benefit-alapú** — nem a termék, hanem az eredmény (pl. "Több idő az ügyfeleidre")
9. **Kérdés** — a célcsoport fejében lévő kérdés (pl. "Rengeteg ügyfeled elveszik?")
10. **Versenyelőny** — miért jobb mint az alternatíva (pl. "Nincs beüzemelési díj")

Töltsd fel a maradék 5 headline-t a legerősebb angle-ök variációival.

## Descriptions — 4 db, 90 char/db

A Google egyszerre 2 description-t mutat. Mindegyik legyen önálló, teljes gondolat — ne feltételezze, hogy a másik is megjelenik mellette.

- 1. description: USP + CTA
- 2. description: social proof vagy eredmény + CTA
- 3. description: pain point megoldás + CTA
- 4. description: ajánlat (ha van) vagy bizalomépítő elem (garancia, ingyenes próba) + CTA

## Brand voice

Hangnem: `{{memory.brand_voice.tone}}`
Kerüld: `{{memory.brand_voice.dont}}`
Célcsoport: `{{memory.profile.target_audience}}`
USP forrás: `{{memory.profile.usp}}`

## submit_deliverable hívása

```json
{
  "content_md": "<a headlines és descriptions felsorolása markdown formátumban>",
  "structured_data": {
    "platform": "google",
    "objective": "awareness | conversions | traffic",
    "audience_brief": "1-2 mondat: kit célzunk és milyen keresési szándékkal",
    "headlines": [
      "Headline 1 (max 30 char)",
      "Headline 2 (max 30 char)",
      "Headline 3 (max 30 char)",
      "Headline 4 (max 30 char)",
      "Headline 5 (max 30 char)",
      "Headline 6 (max 30 char)",
      "Headline 7 (max 30 char)",
      "Headline 8 (max 30 char)",
      "Headline 9 (max 30 char)",
      "Headline 10 (max 30 char)",
      "Headline 11 (max 30 char)",
      "Headline 12 (max 30 char)",
      "Headline 13 (max 30 char)",
      "Headline 14 (max 30 char)",
      "Headline 15 (max 30 char)"
    ],
    "descriptions": [
      "Description 1 — max 90 karakter, önálló gondolat CTA-val.",
      "Description 2 — max 90 karakter, önálló gondolat CTA-val.",
      "Description 3 — max 90 karakter, önálló gondolat CTA-val.",
      "Description 4 — max 90 karakter, önálló gondolat CTA-val."
    ]
  }
}
```

**Konkrét példa (CRM szoftver):**
```json
{
  "content_md": "## Google RSA — CRM szoftver\n\n### Headlines\n1. CRM kis cégeknek (19)\n2. Ügyfeleid egy helyen (20)...",
  "structured_data": {
    "platform": "google",
    "objective": "conversions",
    "audience_brief": "KKV-tulajdonosok és értékesítési csapatok, akik 'CRM szoftver' és kapcsolódó kulcsszavakra keresnek.",
    "headlines": [
      "CRM kis cégeknek",
      "Ügyfeleid egy helyen",
      "14 nap ingyen — regisztrálj",
      "427 cég már használja",
      "Nincs telepítés, nincs díj",
      "Több értékesítés, kevesebb munka",
      "Elvész egy-egy ügyfél?",
      "Egyszerű CRM rendszer",
      "Próbáld ki kockázat nélkül",
      "Integráció e-maillel és naptárral",
      "Magyar ügyfélszolgálat",
      "Havi 5 990 Ft-tól",
      "Indulj el 10 perc alatt",
      "Legjobb CRM KKV-knak",
      "Ingyenes próba most"
    ],
    "descriptions": [
      "Kezeld az összes ügyfeledet egyetlen felületen. 14 napos próba, kártyaadatok nélkül.",
      "427 kis cég növelte 30%-kal az értékesítését. Nézd meg, hogyan — regisztrálj ingyen.",
      "Rengeteg ügyfél elveszik a papírok között? Mi rendszert adunk. Próbáld ki most.",
      "Nincs beüzemelési díj, nincs éves kötelezettség. Kezdd el ingyen, állj le bármikor."
    ]
  }
}
```

## Amit ne csinálj

- Ne lépd túl a 30 karakteres headline limitet — számold meg karakterenként, mielőtt leadod
- Ne lépd túl a 90 karakteres description limitet
- Ne írj 2 headline-t ugyanolyan lényeges tartalommal — a Google rontja az ad strength-et ismétlés esetén
- Ne feltételezd, hogy a descriptions egymás mellett jelennek meg — mindegyik önálló, teljes gondolat legyen
- Ne ígérj konkrét számokat (pl. "30% növekedés"), hacsak a brief nem tartalmaz hitelesített adatot
