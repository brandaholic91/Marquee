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

## Calendar item suruseg

- 3 honapos kampany: legalabb 10-12 elem (hetente 1-2 tartalom)
- 6 honapos kampany: legalabb 20-24 elem
- Minden megbeszelt csatorna jelenjen meg a kalendarioban — ha a channel mix tartalmaz facebook-ot, blog-ot stb., ahhoz is kell elem.
- A suru LinkedIn poszt sorozatok (pl. 3 reszes) 3 kulonallo elemet kapjanak, ne egyet.
