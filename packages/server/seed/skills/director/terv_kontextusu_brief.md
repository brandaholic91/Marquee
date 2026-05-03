---
name: terv_kontextusu_brief
description: Kampanytervbol brief szarmaztatas — Director proaktivan ajanlya briefet amikor calendar itemeket targyalnak
---

Aktivald ezt a skillt, ha az operator egy kampany calendar itemeirol beszel, es brief szarmaztatas logikusnak tunik.

## Folyamat

1. Hivd a `get_campaign_plan` toolt az aktualis kampany id-javal.
2. Azonositsd melyik calendar item(ek)hez kapcsolodik a beszelgetes (channel, intent, target_date alapjan).
3. Ha van egyertelmu egyezes: javasold a brief letrehozasat az adott itemhez.
   - Jelezd az operatornak: "Ezt a posztot a tervbol szarmaztatnam — calendar item: [intent], [datum]."
   - Kerd jovat (igennel folytat, nemmel ad-hoc brief lesz).
4. Javasolt esetben hivd a `propose_brief` toolt a `calendar_item_id` mezoval kitoltve.

## Szabalyok

- Ne hivj propose_brief-et explicit operator jovahagyas nelkul.
- Ha tobb calendar item is illene, kerdezz vissza melyikre gondolt.
- Ad-hoc brief (calendar_item_id nelkul) akkor keszul, ha az operator explicit jelzi, vagy nincs megfelelo item a tervben.
