# SEO Specialist — Web Toolok (Tavily)

**Státusz:** draft
**Dátum:** 2026-04-30

## Cél

Az SEO Specialist agent kapjon valós webes hozzáférést kulcsszó-kutatáshoz és weboldal tartalom kiolvasásához. A `keyword_research.md` skill prompt már hivatkozik `tavily_search`-re és `web_fetch`-re, de ezek a toolok nem léteznek.

## Architektúra

Két új tool a `packages/server/src/tools/` könyvtárban, a meglévő pattern szerint:

```
packages/server/src/tools/
  tavily-search.ts    — Tavily /search API wrappere
  web-fetch.ts        — Tavily /extract API wrappere
```

Mindkettő a `TAVILY_API_KEY` környezeti változót használja. Hiányzó kulcs esetén a tool emberi olvasható hibát ad vissza.

### `tavily_search`

| Mező | Érték |
|------|-------|
| API | `POST https://api.tavily.com/search` |
| Input | `{ query: string, search_depth?: "basic"|"advanced", max_results?: number }` |
| Output | `{ results: [{ title, url, content, score }], response_time }` |
| Implementáció | `fetch` hívás, `TAVILY_API_KEY` header-ben, válasz JSON parse |

### `web_fetch`

| Mező | Érték |
|------|-------|
| API | `POST https://api.tavily.com/extract` |
| Input | `{ urls: string[] }` (1-5 URL) |
| Output | `{ results: [{ url, raw_content }], failed_results: [...] }` |
| Implementáció | `fetch` hívás, globális telepítésű `undici` fetch (Node.js 22 beépített) |

## Role mapping

Csak az `seo-specialist` kapja meg mindkét toolt:

```typescript
'seo-specialist': {
  tools: ['read_memory', 'submit_deliverable', 'tavily_search', 'web_fetch'],
  // ...
}
```

## Hibakezelés

- Hiányzó `TAVILY_API_KEY` → a tool regisztrálódik, de híváskor `"TAVILY_API_KEY környezeti változó nincs beállítva"` hibát ad. Így az LLM értelmes hibaüzenetet kap, nem "tool not found"-ot.
- Tavily API timeout (10s) → `"Tavily API nem válaszolt időben"`
- Tavily API hiba (4xx/5xx) → `"Tavily API hiba: {status}"`

## Ami NEM része

- Rate limiting / quota tracking — Tavily oldalán kezelve
- Creditegyenleg ellenőrzés — nem a tool felelőssége
- Más role-ok web hozzáférése — explicit scope: csak SEO Specialist
- Saját HTML parser — a Tavily extract végzi
- SerpAPI / Google Custom Search — nincs rá igény jelenleg

## Tesztelés

- Unit teszt mindkét tool factory-re (mock-olt fetch-csel)
- Integrációs teszt: valós Tavily API hívás, ha `TAVILY_API_KEY` elérhető (skip ha nincs)
- `seo-specialist` konfig teszt: ellenőrizni, hogy a `tools` lista tartalmazza az új neveket
