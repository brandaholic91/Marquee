# AI Marketing Agency — Orchestration UI v0.2 Design Spec

**Dátum:** 2026-04-28
**Státusz:** jóváhagyva
**Típus:** Marquee v0.2 feature spec
**Kapcsolódó:**
- [`2026-04-27-orchestration-ui-design.md`](./2026-04-27-orchestration-ui-design.md) — v0.1 alap design spec
- [`2026-04-27-orchestration-ui-v0.1.md`](../plans/2026-04-27-orchestration-ui-v0.1.md) — v0.1 implementation plan

---

## 1. Összefoglalás

A Marquee v0.2 három fázisban bővíti a v0.1 alapot:

1. **Phase 1 — v0.1 gap-ek lezárása**: Pipeline view, Eval tab, Revisions lista, Memory inline editor, Skill recipe-k meglévő role-okhoz
2. **Phase 2 — Expand**: 4 új role (Distribution Lead, Insights Lead, Social Manager, SEO Analyst), új deliverable típusok (`linkedin_post`, `landing_page`), skill recipe-k az új role-okhoz
3. **Phase 3 — Integration + polish**: n8n kétirányú integráció alapjai, kanban drag-and-drop

**Deferred (v0.3-ra tolva):** Budget widget, Quality trend widget, OpenRouter/Helicone, Playwright E2E, Paid Specialist/Repurposer/Analytics Analyst role-ok, memory auto-commit cron, revision diff view.

---

## 2. Phase 1 — v0.1 gap-ek

### 2.1 Pipeline view

**Probléma:** A nav gomb no-op, nincs deliverable lista.

**Megoldás:**
- Új `GET /api/deliverables` endpoint — visszaadja az összes deliverable-t `status` szerint csoportosítva
- Frontend `/pipeline` route: deliverable kártyák státuszoszloponként (drafting / awaiting_eval / awaiting_approval / shipped / archived)
- Ez az alap, amire Phase 3-ban ráépül a drag-drop

### 2.2 Eval tab

**Probléma:** Placeholder UI, `GET /api/deliverables/:id/eval` endpoint hiányzik.

**Megoldás:**
- Új `GET /api/deliverables/:id/eval` endpoint — visszaadja a legutóbbi eval rekordot (`scores_json` + `summary_md`) az `evals` táblából
- Deliverable detail view Eval tab: 3 dimenzió megjelenítve (brand voice illeszkedés, factual accuracy, USP használat) numerikus score-ral (1–5) + szöveges összefoglaló
- Ha még nincs eval: "Pending evaluation" placeholder

### 2.3 Revisions tab

**Probléma:** Csak az aktuális revíziót mutatja, listázó endpoint hiányzik.

**Megoldás:**
- Új `GET /api/deliverables/:id/revisions` endpoint — összes revision időrendben
- UI: revision lista (dátum + létrehozó agent), kattintásra az artifact tartalma betöltődik
- Diff view nincs (v0.3-ra tolva) — csak revision switching

### 2.4 Memory inline editor

**Probléma:** Read-only UI, szerkesztés csak agent proposal-on keresztül lehetséges.

**Megoldás:**
- Új `PUT /api/memory/:filename` endpoint (teljes fájltartalom érkezik, nem patch):
  1. YAML frontmatter validáció (kötelező kulcsok meglétének ellenőrzése)
  2. Fájl kiírása diskre
  3. `git add <file> && git commit -m "memory: update <filename>"`
  4. Hiba esetén: `git checkout -- <file>` rollback
- Frontend: minden memory fájlnál "Edit" gomb → inline textarea/markdown editor → Mentés gomb = API hívás
- A proposal queue változatlan marad az agent-javaslatokhoz

**Két szerkesztési útvonal (párhuzamosan él):**
- **Felhasználó** → inline editor → `PUT /api/memory/:filename` → git commit közvetlenül
- **Agent** → `propose_memory_update` tool → proposal queue → felhasználó jóváhagyja → git commit

### 2.5 Skill recipe-k — meglévő 4 role

**Probléma:** `dataDir/skills/` mappa üres — az agenteknek nincs role-specifikus instrukciójuk, viselkedésük nem konzisztens.

**Megoldás:** 5 skill recipe markdown fájl a Stackly ügyfélre szabva:

| Fájl | Role | Tartalom |
|---|---|---|
| `director/brief_parser.md` | Director | Brief struktúra, Stackly ICP validálás, lead routing döntési fa |
| `director/lead_router.md` | Director | Mikor melyik lead kap delegációt, prioritizálási szabályok |
| `content-lead/editorial_brief_handoff.md` | Content Lead | Copywriter briefelés sablonja, brand voice elvárások |
| `copywriter/blog_post_writer.md` | Copywriter | Blog poszt struktúra, Stackly brand voice, PLG témák |
| `eval-judge/three_dim_review.md` | Eval Judge | 3-dim értékelési rubrika (brand voice / factual accuracy / USP) |

---

## 3. Phase 2 — 4 új role + új deliverable típusok

### 3.1 Új role-ok

| Role | Lifecycle | Felelősség |
|---|---|---|
| Distribution Lead | warm | `linkedin_post` és `landing_page` delegáció koordinálása |
| Insights Lead | warm | SEO kutatás koordinálása, keyword brief összeállítása |
| Social Manager | spawn-per-task | `linkedin_post` draftoló specialist |
| SEO Analyst | spawn-per-task | Keyword research, on-page javaslatok |

**Tool-szett bővítések:**

| Role | Új tool jogosultságok |
|---|---|
| Director | `delegate_to_lead("distribution")`, `delegate_to_lead("insights")` |
| Distribution Lead | `delegate_to_specialist("social-manager")` |
| Insights Lead | `delegate_to_specialist("seo-analyst")` |
| Social Manager | `submit_deliverable` (type: `linkedin_post`), `read_memory`, `propose_memory_update`, `web_fetch` |
| SEO Analyst | `submit_deliverable` (type: `seo_report`), `read_memory`, `web_fetch` |

**Implementáció:** Agent factory, tool registry, broker routing bővítése — a keretrendszer már megvan.

### 3.2 Új deliverable típusok

| Típus | Leírás | Max hossz |
|---|---|---|
| `linkedin_post` | LinkedIn thought leadership poszt | ~3000 karakter |
| `landing_page` | Strukturált landing page copy | Korlátlan, markdown |
| `seo_report` | Keyword research + on-page audit összefoglaló | Korlátlan, markdown |

Mindkettő az artifact rendszeren keresztül tárolódik (`dataDir/artifacts/<id>/rev_001.md`), azonos revision logikával mint a `blog_post`.

**DB változás:** `deliverables.type` enum bővítés — Drizzle migráció, nincs strukturális változás.

### 3.3 Skill recipe-k — 4 új role

8 új fájl:

| Fájl | Role |
|---|---|
| `distribution-lead/linkedin_brief_coordinator.md` | Distribution Lead |
| `distribution-lead/landing_page_coordinator.md` | Distribution Lead |
| `insights-lead/seo_insights_coordinator.md` | Insights Lead |
| `insights-lead/keyword_brief.md` | Insights Lead |
| `social-manager/linkedin_post_writer.md` | Social Manager |
| `seo-analyst/keyword_research.md` | SEO Analyst |
| `seo-analyst/on_page_audit.md` | SEO Analyst |
| `eval-judge/three_dim_review_extended.md` | Eval Judge (kiterjesztés `linkedin_post`-ra) |

---

## 4. Phase 3 — n8n foundation + kanban drag-drop

### 4.1 n8n kétirányú integráció

**Outbound (Marquee → n8n):**

- `N8N_WEBHOOK_URL` env var. Ha be van állítva, a broker minden broker eventet POST-ol rá JSON-ban — ugyanaz a payload, amit az SSE kliensnek küld.
- n8n oldalon: "Webhook" trigger node fogadja, a felhasználó épít rá workflow-t tetszés szerint.
- Nincs event filtering UI — szűrés n8n oldalon végezhető.

**Inbound (n8n → Marquee):**

- Meglévő REST write endpointok (`POST /api/briefs`, `POST /api/messages`, stb.) védve lesznek `MARQUEE_API_TOKEN` env var + `Authorization: Bearer <token>` header ellenőrzéssel.
- n8n "HTTP Request" node-dal hívható.
- GET endpointok autentikáció nélkül maradnak (single-user LAN-only tool).

**Implementáció:** Broker webhook dispatch + Fastify middleware auth guard — mindkettő egyszerű, nem igényel DB változást.

### 4.2 Kanban drag-and-drop

**Library:** `dnd-kit` (könnyű, accessibility-ready, React 19 kompatibilis).

**Működés:**
- A Pipeline view deliverable kártyái státuszoszlopok között húzhatók
- Húzás végén: `PATCH /api/deliverables/:id/status` hívás
- Érvényes státuszátmenetek (ugyanazok, mint az agent-driven flow-ban):

| Forrás státusz | Célba mehet |
|---|---|
| `drafting` | `awaiting_eval` |
| `awaiting_eval` | `awaiting_approval`, `drafting` |
| `awaiting_approval` | `shipped`, `drafting` |
| `shipped` | `archived` |
| `archived` | — |

- `shipped → drafting` és hasonló "visszafelé" nem megengedett — a UI vizuálisan jelzi (kártya visszaugrik).

---

## 5. Tesztelési stratégia

A v0.1 tesztelési elvek érvényben maradnak:

- **Unit tesztek (vitest):** Új endpointok, tool registry bővítések, érvényes/érvénytelen státuszátmenetek, API token auth guard
- **Smoke teszt:** Meglévő `npm run smoke` kiterjesztése: Director delegál Distribution Lead-nek → Social Manager `linkedin_post`-ot draftol → shipped
- **Playwright E2E:** v0.3-ra tolva

---

## 6. Deploy / ops

Nincs VM vagy infra változás. Ugyanaz a `marquee.service` systemd unit, ugyanaz a `scripts/deploy.sh`.

Új env varok (mind opcionális, csak ha szükséges):

```bash
N8N_WEBHOOK_URL=http://192.168.2.30:5678/webhook/<id>   # outbound webhook
MARQUEE_API_TOKEN=<random-string>                        # inbound API auth
```

---

## 7. Deferred (v0.3)

| Feature | Indok |
|---|---|
| Budget widget + Quality trend widget | Nem prioritás ebben a körben |
| OpenRouter / Helicone integráció | Flat mode elegendő |
| Playwright E2E | Manuális smoke teszt elegendő most |
| Paid Specialist, Repurposer, Analytics Analyst | v0.3 role-ok |
| Memory auto-commit cron (02:00) | v0.3 |
| Revision diff view | v0.3 |
| Cron rutinok (morning_brief, weekly_report) | v0.3 |
