---
name: brief_intake
when_to_use: az operátor tartalomigényt ír le chatben, bármilyen formában — akár pontosan meghatározva, akár csak egy ötletként jelezve
---

Amikor az operátor tartalomigényt fogalmaz meg, a következő lépéseket kövesd szigorúan.

## 1. Hiányzó scope tisztázása

Ha bármelyik adat hiányzik, kérdezz rá — de **egyszerre legfeljebb 2-3 kérdést** tegyél fel, ne egyszerre az összes ismeretlent.

Szükséges adatok:
- **deliverable_type**: social_post / email / blog_post / ad_copy — ha nem egyértelmű, kérdezz rá direkten
- **célcsoport**: kinek szól a tartalom (ha eltér az általános profiltól)
- **hangnem hint**: van-e speciális elvárás a tone-ra (ha eltér a brand voice-tól)
- **hossz / terjedelem**: ha releváns (pl. blog postnál)

Ha a deliverable_type nem nyilvánvaló az operátor üzenetéből, kérdezz rá: "Milyen típusú tartalmat szeretnél? (blog post / email / social post / hirdetés szöveg)"

## 2. Platform azonosítása (ha releváns)

Ha a deliverable_type `social_post`, kérdezz rá a platformra: instagram / linkedin / twitter / threads

Ha a deliverable_type `ad_copy`, kérdezz rá a platformra: meta / google / linkedin

Ezt mindig kérdezd meg, mert a specialist más formátumban dolgozik platformonként.

## 3. Target specialist meghatározása

| deliverable_type | target_specialist |
|---|---|
| social_post | social-manager |
| email | copywriter |
| blog_post | copywriter |
| ad_copy | paid-specialist |

## 4. propose_brief hívása

Hívd meg a `propose_brief` toolt. A `title` legyen tömör (5-10 szó). A `content_md` strukturált legyen — tartalmazza az alábbi blokkokat:

```markdown
**Cél:** <mit akarunk elérni ezzel a tartalommal>

**Célcsoport:** <kinek szól — hivatkozhatsz a profilra: {{memory.profile.target_audience}}>

**Hangnem:** <{{memory.brand_voice.tone}} — plusz bármilyen specifikus elvárás>

**Platform:** <ha releváns>

**Kötelező elemek:** <amit mindenképp tartalmaznia kell>

**Kerülendő:** <{{memory.brand_voice.dont}} — plusz bármilyen specifikus tiltás>

**Terjedelem / formátum:** <ha meghatározott>
```

A `target_specialist` mezőt töltsd ki a fenti táblázat alapján.

## 5. Több brief egymás után

Ha az operátor egy üzenetben több tartalomigényt fogalmaz meg (pl. "kell egy email és 3 social post"), **NE szintetizálj** egyetlen brief-be. Minden deliverable_type önálló brief — adj le annyi `propose_brief` hívást egymás után, ahány különböző deliverable van.

Például:
- "Kell egy email és 3 Instagram poszt" → 2 propose_brief hívás: egy email brief (copywriter) + egy social_post brief (social-manager, platform: instagram)
- "Blog post és egy Meta hirdetés ugyanarra a témára" → 2 propose_brief hívás: blog_post (copywriter) + ad_copy (paid-specialist, platform: meta)

Minden brief önálló dispatch egységet jelent.

## 6. Mikor NE aktiváld ezt a skillt

Ha az operátor nem tartalomigényt ír, hanem általános kérdést tesz fel, visszajelzést ad, vagy a brand profilt akarja szerkeszteni — ne hívj `propose_brief`-et. Ez a skill kizárólag tartalomgyártási igényekre vonatkozik.
