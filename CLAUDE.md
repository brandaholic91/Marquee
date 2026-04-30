# Marquee — AI Marketing Agency Orchestration UI

Single-tenant AI marketing ügynökség: Director chat → brief proposal → specialist agent → approval flow → n8n outbound. A backend `pi-agent-core`-on alapul, frontend React + Vite + Zustand.

**Architektúra részletek a spec-ben:** `docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md`
**Wave 1 spec:** `docs/superpowers/specs/2026-04-30-marquee-new-agents-wave-1-design.md`
**Wave 1 plan:** `docs/superpowers/plans/2026-04-30-marquee-wave-1-agents.md`

## Branch állapot

- **`master`** — aktív fejlesztési branch. `v0.2-final` tag archív referencia.
- Nincs worktree, nincs külön fejlesztési branch. Minden munka közvetlenül `master`-en.

## Jelenlegi állapot (2026-04-30)

✅ Teljes brief→specialist→deliverable flow (Director chat → brief javaslat → approve → specialist LLM → deliverable → approval queue).
✅ Multi-thread chat (több párhuzamos beszélgetés, sidebar, rename, archiválás).
✅ Kampányok (campaign_name grouping, Kampányok nézet, brief kártyán kampány hozzárendelés chip-ekkel).
✅ TipTap rich text editor briefeknél, react-markdown + remark-breaks renderelés mindenhol.
✅ Director kontextus: `get_campaign_status` tool.
✅ Approval flow: jóváhagy/visszaküld/eldob + auto-navigate. Vázlat státuszban Eldob gomb.
✅ Brand Voice Guardian: operátor triggereli DeliverableDetail-ből, review score + észrevételek + javaslatok. Visszaküldéskor a review bekerül a specialist promptjába.
✅ n8n outbound webhook + inbound (`POST /api/briefs` Bearer tokennel).
✅ Lokális OAuth setup kész: `~/.pi/agent/auth.json`.
⚠️ VM 260 deploy még nem történt meg.

## Agentek (7 role)

| Role | Modell | Típus | Deliverable |
|---|---|---|---|
| `director` | gpt-5.4 | warm | — |
| `copywriter` | gpt-5.4 | transient | email, blog_post |
| `social-manager` | gpt-5.4-mini | transient | social_post |
| `paid-specialist` | gpt-5.4-mini | transient | ad_copy |
| `email-marketer` | gpt-5.4 | transient | email |
| `seo-specialist` | gpt-5.4-mini | transient | blog_post |
| `brand-voice-guardian` | gpt-5.4-mini | transient (review) | — |

## Tech stack

| Réteg | Technológia |
|---|---|
| Backend | Node.js 22 LTS, TypeScript, Fastify 5, better-sqlite3 + Drizzle |
| Agent | `@mariozechner/pi-agent-core` v0.70.2 + `@mariozechner/pi-ai` v0.70.2 |
| LLM | **openai-codex** (ChatGPT Pro/Plus OAuth) |
| Frontend | React 19, Vite, Tailwind 3, Zustand, react-router-dom 7 |
| Monorepo | npm workspaces (`packages/server`, `packages/web`) |

## Lokális fejlesztés

```bash
cd ~/Projects/Homelab/marquee
DATA_DIR=~/.marquee-dev npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:7892 (Vite proxy `/api/*`)

## .env (repo gyökér, gitignore-olva)

```
DATA_DIR=/home/balazs/.marquee   # VM-en; lokálisan ~/.marquee-dev
PORT=7892
WEB_ROOT=/opt/marquee/packages/web/dist  # csak prod
# Optional:
# MARQUEE_API_TOKEN=<bearer-secret>
# N8N_WEBHOOK_URL=<https://...>
# PI_AUTH_FILE=/home/balazs/.pi/agent/auth.json
```

**OAuth setup kötelező első indulás előtt:**
```bash
cd packages/server && npx tsx src/scripts/login-openai.ts
```

## Deploy

```bash
bash scripts/deploy.sh
```

Rsync → VM 260 (192.168.2.60) → `npm install --omit=dev` → `sudo systemctl restart marquee`.

- Live: http://marquee.lab2.home.arpa
- Service: `marquee.service` (User=balazs, WorkingDirectory=/opt/marquee)

## Repo struktúra (orientációs)

```
marquee/
├── packages/
│   ├── server/
│   │   ├── drizzle/             # migrations 0000–0003 + meta/_journal.json
│   │   ├── seed/
│   │   │   ├── memory/          # 6 template: profile, brand_voice, ongoing_campaigns,
│   │   │   │                    #   email_list_segments, seo_keyword_bank, brand_voice_guidelines
│   │   │   └── skills/          # director(3), copywriter(2), social-manager(1),
│   │   │                        #   paid-specialist(2), email-marketer(3), seo-specialist(4),
│   │   │                        #   brand-voice-guardian(1)
│   │   └── src/
│   │       ├── agents/          # config (7 role), factory (spawn), transform-context
│   │       ├── broker/          # event-bus, router (dispatchBrief), review-dispatcher, recovery
│   │       ├── db/              # schema (15 tábla: +deliverable_reviews), queries, index
│   │       ├── memory/          # read, write, proposals, validate, seed
│   │       ├── providers/       # openai-codex modelForRole + auth
│   │       ├── tools/           # read-memory, propose-brief, propose-memory-update,
│   │       │                    #   submit-deliverable, submit-review, get-campaign-status
│   │       ├── server/          # buildServer + routes/* + sse
│   │       ├── skills/          # loader
│   │       ├── webhooks/        # n8n-outbound (3× retry)
│   │       └── scripts/         # smoke.ts, login-openai.ts
│   └── web/src/
│       ├── components/          # BriefProposalCard (kampány chip-ek), BrandVoiceReviewPanel,
│       │                        #   SendBackModal (review-aware), StatusBadge, ...
│       ├── views/               # Workshop, Approvals, DeliverableDetail (+ DraftingActions)
│       ├── store/               # useMarqueeStore (SSE handler guard, dispatched brief filter)
│       └── lib/                 # api (reviewsApi), roles.ts, sse, design, utils
├── scripts/deploy.sh
├── infra/marquee.service
└── docs/superpowers/{specs,plans}/
```

## Magyar nyelv konvenció

**Minden user-facing és LLM-facing szöveg magyar:** skill recipe-k, tool description-ök, UI labelek, deliverable kimenet. Kivétel: kód identifier, DB column, type, log message, code comment.

## Tipikus parancsok

```bash
# Tesztek
cd packages/server && npx vitest run

# TS check
cd packages/server && npx tsc --noEmit
cd packages/web && npx tsc --noEmit

# Build
npm run build --workspaces

# Smoke (live backend + OAuth kell)
DATA_DIR=~/.marquee-dev npm run smoke --workspace=packages/server
```

## Gotchas

**Typebox fix.** Root `package.json`-ban `"typebox": "1.1.24"` + `overrides`. Ne frissítsd.

**Vitest cwd.** Mindig `cd packages/server` előtte (`migrationsFolder: 'drizzle'` relatív path).

**Drizzle-orm verzió mismatch.** Root `0.45.2`, `packages/server` `0.36.0`. Működik, ne nyúlj hozzá.

**Drizzle migration tracking bug.** A meglévő DB-ben (`~/.marquee-dev/state.db`) a `__drizzle_migrations` tábla nem követi automatikusan az összes migrációt (v0.36.0 bug). Új migration hozzáadásakor a DB-t manuálisan kell frissíteni:
1. SQL futtatása sqlite3-mal
2. Hash beillesztése `__drizzle_migrations`-be (SHA-256 a .sql fájl tartalmából)
Friss DB-n (pl. VM 260) az `openDb` automatikusan alkalmazza az összes migrációt. ✓

**Frontend token mapping.** `border-rule` / `text-ink-2` / `bg-off-white` — a spec-beli token nevek nem léteznek.

**Auth middleware scope.** `MARQUEE_API_TOKEN` csak `POST /api/briefs` route-ot védi. Minden más endpoint token nélkül megy — szándékos.

**Kampány dedup.** `propose_brief` tool `INSERT OR IGNORE` + UNIQUE index (`uq_campaigns_client_title`).

**Director dupla válasz.** A `pi-agent-core` néha két azonos szövegblokkot ad vissza a content array-ben. Fix: consecutive duplikátumok kiszűrése a `index.ts` response extraction loopjában.

**Social-manager + hosszú brief.** Ha a brief sorozatot kér (pl. „4 poszt"), a `gpt-5.4-mini` modell néha 0 LLM turn után visszatér anélkül hogy `submit_deliverable`-t hívna. Fix: egy posztot kérj egyszerre, vagy használj rövidebb brief-et.

**SSE handler guard.** `marqueeEvents.handlersInitialized` flag-gel védett az újra-regisztráció. Ha a `sse.ts` modul HMR-rel újratöltődik, a flag resetelődik és a handlerek újra regisztrálódnak — ez szándékos.

**Brief card SSE replay.** Csak az aktív thread-hez tartozó, még draft státuszú briefek jelennek meg kártyaként. Cross-thread és dispatched brief-ek ki vannak szűrve.

**Brand Voice Guardian kalibrálás.** A `brand_voice_guidelines.md` memory template feltöltése kötelező éles használat előtt (legalább 5-5 jó/rossz példamondat GrowthFrame brand voice-ból).

## Production VM 260 állapot (2026-04-30)

Deploy-ready, de még nem deployolva:
- `marquee.service` **inactive (dead)**
- **OAuth setup hiányzik** a szerveren:
  ```bash
  ssh balazs@192.168.2.60
  cd /opt/marquee/packages/server && npx tsx src/scripts/login-openai.ts
  ```

## Homelab kontextus

A Marquee egy node a homelab-ban (VM 260, ai-agency). Teljes infra-szintű dokumentáció: `~/Projects/Homelab/CLAUDE.md`.
