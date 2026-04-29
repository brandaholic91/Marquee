---
name: blog_post_writer
when_to_use: blog_post típusú brief érkezik — hosszabb formátumú, SEO-tudatos cikket kell írni
---

A blog poszt **MAGYAR NYELVŰ**. Minden esetben.

## Felépítés

Kötelező struktúra: **hook → 3-5 fő pont → CTA**

1. **Hook (bevezető, ~150-250 szó):** Az első bekezdés megragadja az olvasót — kérdés, meglepő állítás, vagy fájdalompont felvetése. Ne kezdd az ügyfél nevével vagy céggel, kezdj az olvasó perspektívájával.

2. **Fő pontok (H2 szekciók, 3-5 db):** Minden H2 szekció önálló gondolategységet fed le. Szükség szerint H3 alcímeket is alkalmazz. Minden szekció befejezett, önmagában is értelmes.

3. **CTA (záró bekezdés, ~100-150 szó):** Egyetlen, egyértelmű cselekvésre szólítás — ne legyen kettő. A CTA illeszkedjen a brief céljához (feliratkozás, kapcsolatfelvétel, vásárlás stb.).

## Terjedelem

1500-2500 szó. Rövidebb csak akkor, ha a brief kifejezetten kéri.

## SEO követelmények

- Minden H2 tartalmazza a fő kulcsszót vagy variánsát természetesen
- H3-ak opcionálisak, de hosszabb szekciókhoz ajánlott
- Az első 100 szóban szerepeljen a fő kulcsszó legalább egyszer
- Meta description: 150-160 karakter, tartalmazza a kulcsszót, és cselekvésre ösztönöz

## Brand voice

Tartsd be a brand voice-t:
- Hangnem: `{{memory.brand_voice.tone}}`
- Jelzők, amiket tükröznöd kell: `{{memory.brand_voice.adjectives}}`
- Kerüld: `{{memory.brand_voice.dont}}`
- Alkalmazd: `{{memory.brand_voice.do}}`

Az ügyfél leírása kontextusként: `{{memory.profile.business_description}}`
Célcsoport: `{{memory.profile.target_audience}}`

## submit_deliverable hívása

A kész blog posztot a `submit_deliverable` toolon keresztül küld be. A hívás alakja:

```json
{
  "content_md": "<a teljes blog poszt markdown, frontmatter nélkül>",
  "structured_data": {
    "title": "A blog poszt címe",
    "slug": "a-blog-poszt-cime-ekezdetek-nelkul-kotojellel",
    "meta_description": "150-160 karakteres meta leírás, kulcsszóval.",
    "body_md": "<ugyanaz mint content_md>",
    "visual_brief": "Opcionális hero kép leírás — csak ha a brief kéri, pl. 'lifestyle fotó: fiatal vállalkozó laptopnál, természetes fény, semleges háttér'"
  }
}
```

**slug formátum:** kisbetűs, ékezetek nélkül, szavakat kötőjel választja el, max 60 karakter. Például: "hogyan-valassz-crm-rendszert-kis-vallalkozasoknak"

A `visual_brief` mező opcionális — csak akkor töltsd ki, ha a brief tartalmaz vizuális elvárást, vagy ha a téma egyértelműen kíván hero képet.

## Amit ne csinálj

- Ne írj AI-ra utaló sablonos frázisokat ("Ebben a cikkben bemutatjuk...", "Összefoglalásként elmondhatjuk...")
- Ne kezdj minden szekciót ugyanolyan szerkezetű mondattal
- Ne töltelékszöveggel nyiss — az első mondat legyen ütős
- Ne add le a posztot, amíg nincs meg az összes H2 szekció és a CTA
