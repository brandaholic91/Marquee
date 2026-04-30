---
name: terv_kontextusu_brief
description: Calendar itembol brief szarmaztatas kampanyterv kontextussal, propose_brief hivassal
---

Aktivald ezt a skillt, ha a Plan-chat threadben egy konkret calendar itemhez kell briefet generalni.

## Folyamat

1. Olvasd ki az item adatait: channel, deliverable_type, target_date, intent, key_message_ref.
2. Hivd a `get_campaign_plan` toolt, es ha van `key_message_ref`, keresd ki a megfelelo uzenetet.
3. Tisztazd a legfontosabb nyitott pontokat egy rovid kerdeskorrel (max 1-2 kerdes).
4. Hivd a `propose_brief` toolt `calendar_item_id`-vel.

## Brief szabalyok

- A brief legyen konkret, vegrehajthato, platformhoz illo.
- A `rationale` jelezze, hogy tervbol szarmaztatott briefrol van szo.
- Ha ad-hoc brief keszul ugyanebben a kampanyban item nelkul, ezt kulon jelold.
