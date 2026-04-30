---
name: social_post_writer
when_to_use: social_post típusú brief érkezik — Instagram, LinkedIn, Twitter vagy Threads posztot kell készíteni
---

A social poszt **MAGYAR NYELVŰ**. Minden esetben.

A brief tartalmazza a platformot. Ha nem tartalmazza, kérj pontosítást — ne találgass, mert minden platform más formátumot igényel.

## Instagram

- **Hook az első sorban**: az Instagram az első 2 sort mutatja a "Tovább" gomb előtt — ez legyen a legerősebb mondat
- **Stílus**: lifestyle hangulat, vizuálisan is megjeleníthetőre írva, érzelmi rezonancia
- **Hossz**: 800-2000 karakter
- **Hashtag-ek**: a poszt végén, 5-10 db, relevancia alapján válogatva — ne tömd tele általános hashtag-ekkel
- **visual_brief KÖTELEZŐ**: a kép vagy videó leírása nélkül az Instagram poszt hiányos — mindig add meg

Brand voice alkalmazása: `{{memory.brand_voice.tone}}`, kerüld: `{{memory.brand_voice.dont}}`

## LinkedIn

- **Nyitó hook**: az első 2 sor a "Bővebben" gomb előtt dönt — insight, meglepő szám, vagy erős állítás
- **Struktúra**: insight → személyes tapasztalat / üzleti kontextus → lesson learned
- **Hossz**: 1000-3000 karakter posztanként
- **Bullet listák**: megengedett, ha az áttekinthetőséget segíti — ne legyen több 5 elemnél
- **Hashtag-ek**: a poszt végén, 3-5 db, szakmai relevanciával

**LinkedIn sorozat (több poszt):** Ha a brief sorozatot kér, az összes posztot egy `submit_deliverable` hívásban küldd be `---` elválasztóval. Minden poszt önálló, önmagában is érthető legyen.

Brand voice: `{{memory.brand_voice.tone}}`, jelzők: `{{memory.brand_voice.adjectives}}`
Ügyfél kontextus: `{{memory.profile.business_description}}`

## Twitter / X

**Két formátum közül válassz a brief alapján:**

**Egyetlen poszt (single tweet):**
- Maximum 280 karakter — kemény limit, nem ajánlás
- Engagement-orientált: kérdés, erős állítás, vagy vitaindító gondolat
- Ne próbálj mindent belezsúfolni — egy gondolat, egy poszt

**Thread (5-10 tweet):**
- Az első tweet hook — ezt látják a followers feedjén, ez dönt az olvasásról
- Minden tweet önmagában is értelmes legyen (nem "#6/10 folyt. köv.")
- Az utolsó tweet CTA vagy összefoglaló
- Számozd a tweeteket: "1/" "2/" stb.

Hashtag Twitter esetén: maximum 2, csak ha valóban releváns — a hashtag-spam rontja az elérést.

## Threads

- **Stílus**: beszélgetésnyitó, közvetlen, kérdést feltevő vagy véleménykérő
- **Hossz**: 500 karakter körül (technikai limit 500)
- Ne hashtag-elj — a Threads algoritmusa nem hashtag-alapú
- Zárj kérdéssel vagy vitaindítóval, hogy kommenteket generáljon

## submit_deliverable hívása

```json
{
  "content_md": "<a poszt teljes szövege, hashtag-ekkel együtt>",
  "structured_data": {
    "platform": "instagram | linkedin | twitter | threads",
    "text": "<a poszt szövege, pontosan ahogy megjelenjen>",
    "hashtags": ["#hashtag1", "#hashtag2"],
    "visual_brief": "Kép/videó leírás — Instagram esetén kötelező, máshol opcionális"
  }
}
```

**Például Instagram esetén:**
```json
{
  "content_md": "A legjobb döntések nem a nagy pillanatokban születnek...\n\n#vállalkozás #döntéshozatal",
  "structured_data": {
    "platform": "instagram",
    "text": "A legjobb döntések nem a nagy pillanatokban születnek.\n\nHanem azokban a csendes percekben, amikor...",
    "hashtags": ["#vállalkozás", "#döntéshozatal", "#leadership", "#growth", "#mindset"],
    "visual_brief": "Felső nézet: nyitott napló és kávéscsésze fa asztalon, reggeli természetes fény, semleges tónusok"
  }
}
```

**LinkedIn sorozat esetén** a `text` mező tartalmazza az összes posztot `---` elválasztóval:

```json
{
  "content_md": "**Poszt 1 — Miért nem működik a legtöbb marketing automatizálás?**\n\nAz eszköz nem a probléma...\n\n---\n\n**Poszt 2 — Az alap, ami nélkül minden AI vakon fut**\n\nMielőtt bármit automatizálsz...",
  "structured_data": {
    "platform": "linkedin",
    "post_count": 4,
    "text": "Poszt 1 szövege...\n---\nPostz 2 szövege...\n---\nPostz 3 szövege...\n---\nPostz 4 szövege...",
    "hashtags": ["#marketing", "#automatizálás", "#kkv"],
    "visual_brief": null
  }
}
```

**Twitter thread esetén** a `text` mező tartalmazza a tweeteket `---` elválasztóval:

```json
{
  "content_md": "1/ Az ügyfélszolgálat...\n---\n2/ Az első lépés...",
  "structured_data": {
    "platform": "twitter",
    "text": "1/ Az ügyfélszolgálat nem cost center. Ez a legdrágább félreértés a B2B-ben.\n---\n2/ Minden elveszített ügyfél...",
    "hashtags": ["#B2B"],
    "visual_brief": null
  }
}
```

## Amit ne csinálj

- Ne írj generikus motivációs tartalmat brand kontextus nélkül
- Ne halmozz hashtag-eket platformon túl — LinkedIn-en 3-5, Instagram-on 5-10, Twitter-en max 2
- Ne tedd a visual_brief-et utólagos gondolatnak — Instagram-on az vizuális stratégia, nem dekoráció
- Ne légy azonos hangon minden platformon — az Instagram lifestyle, a LinkedIn szakmai, a Twitter éles
