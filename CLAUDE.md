# Marquee — AI Marketing Agency Orchestration UI

Single-tenant AI marketing ügynökség: Director chat → brief proposal → specialist agent → approval flow → n8n outbound. A backend `pi-agent-core`-on alapul, frontend React + Vite + Zustand.

**Architektúra részletek a spec-ben:** `docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md`
**Wave 1 spec:** `docs/superpowers/specs/2026-04-30-marquee-new-agents-wave-1-design.md`
**Wave 1 plan:** `docs/superpowers/plans/2026-04-30-marquee-wave-1-agents.md`
**Plan v1 (kampány-terv) spec:** `docs/superpowers/specs/2026-04-30-marquee-campaign-plan-design.md`
**Plan v1 (kampány-terv) plan:** `docs/superpowers/plans/2026-04-30-marquee-campaign-plan.md`

## Branch állapot

- **`master`** — aktív fejlesztési branch. `v0.2-final` tag archív referencia.

## Jelenlegi állapot (2026-05-01)

✅ Teljes brief→specialist→deliverable flow (Director chat → brief javaslat → approve → specialist LLM → deliverable → approval queue).
✅ Multi-thread chat (több párhuzamos beszélgetés, sidebar, rename, archiválás).
✅ Kampányok (campaign_name grouping, Kampányok nézet, brief kártyán kampány hozzárendelés chip-ekkel).
✅ TipTap rich text editor briefeknél, react-markdown + remark-breaks renderelés mindenhol.
✅ Director kontextus: `get_campaign_status` és `get_campaign_plan` tool.
✅ Approval flow: jóváhagy/visszaküld/eldob + auto-navigate. Vázlat státuszban Eldob gomb.
✅ Brand Voice Guardian: operátor triggereli DeliverableDetail-ből, review score + észrevételek + javaslatok. Visszaküldéskor a review bekerül a specialist promptjába.
✅ Brand Voice guidelines kalibrált: csatornaspecifikus jó/rossz minták (landing/linkedin/email_subject/email_body/audit_diagnozis/nehez_igazsag), tiltott→helyettesítés párok, borderline rossz példák `miert` + `helyette` mezőkkel.
✅ Kampány-tervezési réteg (Plan v1): `campaign_plans` + `campaign_calendar_items` domain-objektumok, Plan editor form (cél, audience, key messages, channel mix, timeline, KPI), calendar lista status-szegmentálással. Director-vezetett tervezési chat dedikált thread-tel (`chat_threads.campaign_id`).
✅ Director Plan-tools: `propose_campaign_plan`, `update_campaign_plan`, `propose_calendar_item`, `get_campaign_plan` + 2 új skill recipe (`kampany_tervezes`, `terv_kontextusu_brief`).
✅ Brief származtatás calendar item-ből (laza kötés: `briefs.calendar_item_id` opcionális). Calendar item state machine event-driven státusz-átmenetekkel.
✅ n8n outbound webhook + inbound (`POST /api/briefs` Bearer tokennel).
✅ Lokális OAuth setup kész: `~/.pi/agent/auth.json`.
⚠️ VM 260 deploy még nem történt meg (Plan v1 sem deployolva).

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
| Agent | `@mariozechner/pi-agent-core` v0.70.6 + `@mariozechner/pi-ai` v0.70.6 |
| LLM | **openai-codex** (ChatGPT Pro/Plus OAuth) **OR** **opencode-go** (DeepSeek v4 flash, API key) — fallback via `OPENCODE_API_KEY` env |
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
# Required
DATA_DIR=/home/balazs/.marquee   # VM-en; lokálisan ~/.marquee-dev
PORT=7892

# LLM provider (choose one):
# Option A: OpenAI Codex (OAuth, requires login)
#   (no env var needed — uses ~/.pi/agent/auth.json after login-openai.ts)
# Option B: OpenCode Go + DeepSeek v4 Flash (API key, no OAuth)
#   OPENCODE_API_KEY=sk_...

# Optional:
# WEB_ROOT=/opt/marquee/packages/web/dist  # csak prod
# MARQUEE_API_TOKEN=<bearer-secret>  # protects POST /api/briefs
# N8N_WEBHOOK_URL=<https://...>
# PI_AUTH_FILE=/home/balazs/.pi/agent/auth.json
```

**Provider setup:**
- **OpenAI Codex (default):** OAuth setup required
  ```bash
  cd packages/server && npx tsx src/scripts/login-openai.ts
  ```
- **OpenCode Go:** Simply set `OPENCODE_API_KEY=sk_...` in .env, no script needed

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
│   │   ├── drizzle/             # migrations 0000–0007 + meta/_journal.json
│   │   ├── seed/
│   │   │   ├── memory/          # 6 template: profile, brand_voice, ongoing_campaigns,
│   │   │   │                    #   email_list_segments, seo_keyword_bank, brand_voice_guidelines
│   │   │   └── skills/          # director(5), copywriter(2), social-manager(1),
│   │   │                        #   paid-specialist(2), email-marketer(3), seo-specialist(4),
│   │   │                        #   brand-voice-guardian(1)
│   │   └── src/
│   │       ├── agents/          # config (7 role), factory (spawn), transform-context
│   │       ├── broker/          # event-bus, router (dispatchBrief), review-dispatcher,
│   │       │                    #   recovery, calendar-state-machine
│   │       ├── db/              # schema (17 tábla: +deliverable_reviews, +campaign_plans,
│   │       │                    #   +campaign_calendar_items), queries, index
│   │       ├── memory/          # read, write, proposals, validate, seed
│   │       ├── providers/       # openai-codex modelForRole + auth
│   │       ├── tools/           # read-memory, propose-brief, propose-memory-update,
│   │       │                    #   submit-deliverable, submit-review, get-campaign-status,
│   │       │                    #   get-campaign-plan, propose-campaign-plan,
│   │       │                    #   update-campaign-plan, propose-calendar-item,
│   │       │                    #   tavily-search, web-fetch
│   │       ├── server/          # buildServer + routes/* (+ plans.ts) + sse
│   │       ├── skills/          # loader
│   │       ├── webhooks/        # n8n-outbound (3× retry)
│   │       └── scripts/         # smoke.ts, login-openai.ts
│   └── web/src/
│       ├── components/          # BriefProposalCard (kampány chip-ek), BrandVoiceReviewPanel,
│       │                        #   PlanEditor, CalendarItemCard, CalendarItemEditModal,
│       │                        #   PlanProposalCard, CalendarItemProposalCard,
│       │                        #   SendBackModal (review-aware), StatusBadge, ...
│       ├── views/               # Workshop, Approvals, Campaigns, CampaignDetail, ...
│       ├── store/               # useMarqueeStore (SSE handler guard, dispatched brief filter,
│       │                        #   plans slice)
│       └── lib/                 # api (reviewsApi, plansApi), roles.ts, sse, design, utils
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

**Brand Voice Guardian kalibrálás.** A `brand_voice_guidelines.md` GrowthFrame-specifikus tartalommal feltöltve (csatornaspecifikus jó/rossz minták, 18 tiltott kifejezés `helyette` mezővel, borderline rossz példák `miert` + `helyette` indoklással). A finomhangolási ciklus (manuális vs. Guardian review konvergencia 2-3 körben, real-world copy mintákra cserélés) éles használat során fut. Ha új csatorna típusa jön, a `pelda_jo_mondatok_*` és `pelda_rossz_mondatok_borderline` listákhoz adj 5+ mintát.

**Plan v1 calendar item state machine.** A `calendar-state-machine.ts` event-driven módon vezeti a státusz-átmeneteket: `brief.created (calendar_item_id-vel)` → `brief_created`, `brief.discarded` → `planned`, `deliverable.approved (link-elt brief-en keresztül)` → `delivered`. UI **nem** írhat státuszt direkt módon — csak `cancel` action-on. A `delivered` státuszú item-ek nem mehetnek vissza más státuszba.

**Plan-chat thread scope.** A kampány-tervezési chat ugyanaz a `chat_threads` tábla, csak `campaign_id` mezővel scope-olva. A Director skill-ek (`kampany_tervezes`, `terv_kontextusu_brief`) a thread `campaign_id`-jéből döntik el, hogy plan-aware módban vannak-e. Ad-hoc Workshop chat (campaign_id NULL) flow változatlan.

**LLM provider fallback.** Ha `OPENCODE_API_KEY` env var van (OpenCode Go API key), az `openai-codex` OAuth helyett az `opencode-go` provider-t használja (DeepSeek v4 Flash minden role-hoz). Párhuzamosan futtatható mindkét provider: csak env var-ral váltogatható. `AuthManager` 0 módosítás szükséges — ha OpenCode aktív, skip OAuth, env key-ből olvass. Factory callback (`getApiKey`) már támogatja mindkét provider-t.

## Production VM 260 állapot (2026-05-01)

Deploy-ready (Wave 1 + Plan v1 lokálisan kész), de még nem deployolva:
- `marquee.service` **inactive (dead)**
- **OAuth setup hiányzik** a szerveren:
  ```bash
  ssh balazs@192.168.2.60
  cd /opt/marquee/packages/server && npx tsx src/scripts/login-openai.ts
  ```
- Friss DB-n a 0007 migration az `openDb`-vel automatikusan alkalmazódik (a `__drizzle_migrations` tracking bug csak meglévő DB-ket érint).

## Homelab kontextus

A Marquee egy node a homelab-ban (VM 260, ai-agency). Teljes infra-szintű dokumentáció: `~/Projects/Homelab/CLAUDE.md`.
