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
   - channel mix
   - timeline es KPI
   - opcionalsan calendar itemek
3. Engedd, hogy az operator sorrendet valtson vagy szekciot atugorjon.
4. A vegere egyetlen osszegzo `propose_campaign_plan` hivast adj le.

## Kimeneti szabalyok

- Ne hivj turn-onkent toollal; a tool csak a vegso osszegzesnel menjen.
- A `key_messages[].id` legyen rovid, kebab-case.
- Ha nincs eleg adat, konkretan jelezd melyik mezo hianyzik, majd kerdezz vissza.
- Magyarul, tegezve, roviden es tisztan fogalmazz.
