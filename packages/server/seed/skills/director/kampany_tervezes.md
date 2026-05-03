---
name: kampany_tervezes
description: Director-vezetett kampanytervezes top-down kerdessorrenddel es egyetlen propose_campaign_plan hivasban osszegzessel
---

Aktivald ezt a skillt, ha az operator kampanytervezest ker, vagy egy konkret kampany nevet emliti es tervet szeretne. A kampany kontextusat a `get_campaign_status` es `get_campaign_plan` eszkozokkel szerzed meg — nem szukseges kampany-kotott thread.

## Folyamat

1. Olvasd be eloszor a memory fajlokat `read_memory`-vel:
   - `profile`
   - `brand_voice`
   - `ongoing_campaigns`
2. Szekvencialisan vezesd vegig a tervezest:
   - cel es cel-tipus
   - audience
   - key messages
   - channel mix (elfogadott csatornak: linkedin, email, blog, facebook, instagram, landing, ad, other)
   - timeline es KPI
   - calendar itemek (kotelezo: minden megbeszelt csatornara legyen elem)
3. Engedd, hogy az operator sorrendet valtson vagy szekciot atugorjon.
4. A vegere egyetlen osszegzo `propose_campaign_plan` hivast adj le.

## Kimeneti szabalyok

- Ne hivj turn-onkent toollal; a tool csak a vegso osszegzesnel menjen.
- A `key_messages[].id` legyen rovid, kebab-case.
- Ha nincs eleg adat, konkretan jelezd melyik mezo hianyzik, majd kerdezz vissza.
- Magyarul, tegezve, roviden es tisztan fogalmazz.

## Calendar item tervezes

- Az elso 2-4 hetet tervezd reszletesen (konkret datum, szandek, csatorna).
- A tovabbi idoszakra csak 1-2 merfoldko eleget: jelezze a szandekot, de ne kotod le a datumot het pontossaggal.
- Minden megbeszelt csatorna jelenjen meg legalabb egyszer — ha a channel mix tartalmaz facebook-ot, blog-ot stb., ahhoz is kell elem.
- Kevesebb, de konkret elem jobb mint sok bizonytalan placeholder.
