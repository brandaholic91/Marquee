# Marquee — AI Marketing Agency Orchestration UI

## Projekt összefoglaló

Marquee egy AI marketing ügynökség orchestration felület, amely a WUPHF-et váltotta fel. A backend `pi-agent-core`-on alapul, a frontend React + Vite SPA. Jelenlegi verzió: **v0.1.0**.

## Technológiai stack

| Réteg | Technológia |
|---|---|
| Backend runtime | Node.js 22, TypeScript, `tsx watch` (dev), `tsc` (prod) |
| Agent framework | `@mariozechner/pi-agent-core` v0.70.2 + `@mariozechner/pi-ai` v0.70.2 |
| LLM provider | opencode-go (kimi-k2.6 / minimax-m2.7) — `OPENCODE_API_KEY` env var |
| HTTP server | Fastify 5 |
| Adatbázis | SQLite (better-sqlite3) + Drizzle ORM, WAL mode |
| Frontend | React 19, Vite, Tailwind 3, Zustand |
| Monorepo | npm workspaces (`packages/server`, `packages/web`) |

## Lokális fejlesztés

```bash
# Gyökérmappából:
set -a && source .env && set +a && DATA_DIR=~/.marquee-dev npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:7892
- A Vite `/api/*` kéréseket proxy-zza a backendre

### .env fájl (repo gyökér, gitignore-ban)

```
OPENCODE_API_KEY=<kulcs>
DATA_DIR=/home/balazs/.marquee       # VM-en; lokálisan ~/.marquee-dev ajánlott
PORT=7892
MARQUEE_PROVIDER_MODE=flat           # flat = opencode-go, api = openrouter
WEB_ROOT=/opt/marquee/packages/web/dist   # csak prod
```

## Deploy

```bash
bash scripts/deploy.sh
```

Rsync → VM 260 (192.168.2.60) → `npm install --omit=dev` → `systemctl restart marquee`

**Live URL:** http://marquee.lab2.home.arpa  
**Systemd service:** `marquee.service` (User=balazs, WorkingDirectory=/opt/marquee)

## Monorepo struktúra

```
marquee/
├── packages/
│   ├── server/src/
│   │   ├── agents/         # factory.ts — Agent példányok létrehozása
│   │   ├── broker/         # event-bus.ts, router.ts, eval-trigger.ts, recovery.ts
│   │   ├── db/             # schema.ts, index.ts, queries.ts
│   │   ├── memory/         # read.ts, write.ts, template.ts
│   │   ├── providers/      # index.ts — modelForRole(), getEnvApiKey()
│   │   ├── scripts/        # smoke.ts — end-to-end pipeline teszt
│   │   ├── server/         # Fastify routes + SSE endpoint
│   │   ├── skills/         # skill fájlok betöltése dataDir/skills/-ből
│   │   └── tools/          # delegation, deliverables, integration, misc, proposals
│   └── web/src/
│       ├── components/
│       │   ├── layout/     # Sidebar.tsx (toggle-able)
│       │   └── ui/         # Bulb, Badge, AgentBadge, Avatar, Button
│       ├── lib/            # api.ts, sse.ts
│       ├── store/          # useAgencyStore.ts (Zustand)
│       └── views/          # home, chat-full, deliverable, memory, onboarding
├── scripts/
│   └── deploy.sh
├── infra/
│   └── marquee.service
└── marquee-frontend-ui/    # Design prototípusok (NEM forrás, csak referencia)
```

## Agent architektúra

### Szerepek és modellek (flat mode)

| Szerepkör | Modell | Lifecycle |
|---|---|---|
| director | kimi-k2.6 (opencode-go) | warm (mindig él) |
| content-lead | kimi-k2.6 (opencode-go) | warm (mindig él) |
| eval-judge | minimax-m2.7 (opencode-go) | warm (mindig él) |
| copywriter | kimi-k2.6 (opencode-go) | transient (feladatonként) |

### Pipeline flow (brief → deliverable)

```
POST /api/briefs
  → router.queueBrief()
  → director.prompt("## New Brief...")
  → director: proposeBrief tool → brief_proposed event
  → router: waitForIdle → director.prompt("delegate to content-lead")
  → director: delegateToLead tool → delegation_created event
  → router: content-lead.prompt(delegation)
  → content-lead: delegateToSpecialist tool → delegation_created event
  → router: spawnAndPrompt("copywriter", ...)
  → copywriter: submitDeliverable tool → deliverable_submitted event
  → eval-trigger: eval-judge.prompt(deliverable)
  → deliverable status: awaiting_eval → awaiting_approval
```

### Chat flow (közvetlen director chat)

```
POST /api/threads       → thread létrehozás
POST /api/messages      → human_message broker event
  → router.handleChatMessage(threadId, text)
  → transient director agent (tool nélkül, csak szöveges válasz)
  → message_end event → messages táblába mentés
  → agent_message SSE event → frontend frissítés
```

### Fontos: typebox fix

A `@mariozechner/pi-ai` v0.70.2 `typebox ^1.1.24`-et igényel, de a v1.1.25+ csomagból hiányzik a `build/index.mjs`. Ezért a root `package.json`-ban:

```json
"dependencies": { "typebox": "1.1.24" },
"overrides": { "typebox": "1.1.24" }
```

A `typebox@1.1.24` direkt root dependency-ként kell hogy npm ezt hoistolt verzióként használja.

## Adatbázis séma (főbb táblák)

| Tábla | Leírás |
|---|---|
| `briefs` | Beküldött feladatok |
| `chat_threads` | Felhasználói chat szálak |
| `messages` | Chat üzenetek (human + agent) |
| `delegations` | Agent-to-agent feladatátadások |
| `deliverables` | Elkészített tartalmak |
| `deliverable_revisions` | Revíziók (artifact fájlok: `dataDir/artifacts/`) |
| `agent_sessions` | Aktív/historikus agent példányok |
| `events` | Összes broker esemény (SSE visszajátszáshoz) |
| `memory_proposals` | Agent által javasolt memory változtatások |

**Migrációk:** `packages/server/drizzle/` — Drizzle Kit generálja

## SSE events

Az SSE endpoint (`GET /api/events`) minden broker eseményt küld `data: {"type":"...","..."}` formátumban (nincs külön `event:` header — a kliens `payload.type` alapján dispatch-el).

Főbb event típusok: `brief_proposed`, `delegation_created`, `deliverable_submitted`, `agent_message`, `human_message`, `brief_dispatched`

## DataDir struktúra (runtime)

```
~/.marquee/               # (VM-en /home/balazs/.marquee)
├── state.db              # SQLite adatbázis
├── memory/               # Markdown memória fájlok
│   ├── client_profile.md
│   ├── brand_guidelines.md
│   └── ...
├── skills/               # Agent skill fájlok (role-specifikus)
└── artifacts/            # Deliverable tartalmak
    └── <deliverable-id>/
        └── rev_001.md
```

## v0.2 állapot (aktuális)

Jelenlegi verzió: **v0.2.0**

### Aktív role-ok (8)

director, content-lead, copywriter, eval-judge (warm/transient, v0.1-ből)
distribution-lead, insights-lead, social-manager, seo-analyst (v0.2-ben hozzáadva)

### Aktív deliverable típusok

blog_post, linkedin_post, landing_page, seo_report

### Új endpointok (v0.2)

- `GET /api/deliverables/:id/revisions` — revision lista
- `GET /api/deliverables/:id/eval` — eval rekord
- `PATCH /api/deliverables/:id/status` — státuszváltás (kanban)
- `GET /api/memory/files` — memory fájl lista
- `GET /api/memory/:filename` — memory fájl olvasása
- `PUT /api/memory/:filename` — memory fájl írása (inline editor)

### n8n integráció

- Outbound: `N8N_WEBHOOK_URL` env var → minden broker event POST-olódik n8n-nek
- Inbound: REST API védve `MARQUEE_API_TOKEN` Bearer token-nel (ha env var be van állítva)

### v0.3-ra halasztva

- Budget widget + Quality trend widget
- OpenRouter / Helicone integráció
- Playwright E2E
- Paid Specialist, Repurposer, Analytics Analyst
- Memory auto-commit cron (02:00)
- Revision diff view
- Cron rutinok (morning_brief, weekly_report)
