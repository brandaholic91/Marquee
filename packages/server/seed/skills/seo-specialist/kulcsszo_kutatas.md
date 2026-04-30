---
name: kulcsszo_kutatas
when_to_use: Adott témára magyar nyelvű kulcsszó-kutatást kell végezni search intent analízissel
---

A kulcsszó-kutatás output **MAGYAR NYELVŰ**.

## Output struktúra

### 1. Primary keyword (1 db)
- A kulcsszó
- Search intent: informational / commercial / transactional / navigational
- Becsült nehézség: alacsony / közepes / magas *(LLM-becslés, lásd disclaimer)*

### 2. Secondary keywords (5-10 db)
| Kulcsszó | Search intent | Becsült nehézség |
|---|---|---|
| ... | ... | ... |

### 3. Long-tail variációk (5-10 db)
| Long-tail kulcsszó | Search intent | Becsült nehézség |
|---|---|---|
| ... | ... | ... |

### 4. Versenyképességi kontextus
Rövid (3-5 mondat) elemzés: milyen tartalom típusok uralják ezt a témát, mire érdemes fókuszálni.

## Disclaimer (kötelező az outputban)

> **Fontos:** Ez az elemzés LLM-tudás alapján készült. A tényleges keresési volumenekhez és versenyképességhez Google Search Console, Ahrefs, SEMrush, vagy Ubersuggest adataira van szükség. Az output **kiindulási lista**, nem helyettesíti az eszközalapú kutatást.

## submit_deliverable hívása

```json
{
  "content_md": "<teljes kulcsszó-kutatás dokumentum>",
  "structured_data": {
    "primary_keyword": "fő kulcsszó",
    "secondary_keywords": ["kw1", "kw2"],
    "longtail_keywords": ["long-tail 1", "long-tail 2"],
    "target_market": "magyar"
  }
}
```

## Amit ne csinálj

- Ne adj meg tényleges keresési volumen számokat (nincs valós adat)
- Ne hagyj el disclaimer-t — az LLM-becslés vs. valós adat megkülönböztetés kötelező
- Ne javasolj már a keyword_bank-ban szereplő kulcsszavakat (ha a bank tartalmaz adatot): `{{memory.seo_keyword_bank.keywords}}`
