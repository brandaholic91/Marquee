# Marquee — AI Marketing Agency Orchestration UI

Single-tenant AI marketing ügynökség: Director chat → brief proposal → specialist agent → approval flow → n8n outbound. A backend `pi-agent-core`-on alapul, frontend React + Vite + Zustand.

**Architektúra részletek a spec-ben:** `docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-04-29-marquee-mvp-implementation.md`

## Branch állapot

- **`master`** — aktív fejlesztési branch, az MVP kódja. `v0.2-final` tag jelöli a régi v0.2 állapotot (8 role, lead-tier orchestration) — archív referencia.
- Nincs worktree, nincs külön fejlesztési branch. Minden munka közvetlenül `master`-en.

## Jelenlegi állapot (2026-04-30)

✅ Teljes brief→specialist→deliverable flow működik (Director chat → brief javaslat → operátor approve → specialist LLM → deliverable → approval queue).
✅ Multi-thread chat (több párhuzamos beszélgetés, sidebar, rename, archiválás).
✅ Kampányok (campaign_name grouping briefeknél, Kampányok nézet).
✅ TipTap rich text editor briefeknél, react-markdown + remark-breaks renderelés mindenhol.
✅ Director kontextus: `get_campaign_status` tool (DB-ből kérdezi le az aktív kampányok állapotát).
✅ Approval flow: jóváhagy/visszaküld/eldob + auto-navigate + success state.
✅ Lokális OAuth setup kész: `~/.pi/agent/auth.json` (openai-codex credentials).
⚠️ VM 260 deploy még nem történt meg — OAuth setup (`~/.pi/agent/auth.json`) hiányzik a szerveren.

## Tech stack

| Réteg | Technológia |
|---|---|
| Backend | Node.js 22 LTS, TypeScript, Fastify 5, better-sqlite3 + Drizzle |
| Agent | `@mariozechner/pi-agent-core` v0.70.2 + `@mariozechner/pi-ai` v0.70.2 |
| LLM | **openai-codex** (ChatGPT Pro/Plus OAuth) — gpt-5.4 (Director, Copywriter), gpt-5.4-mini (Social Manager, Paid Specialist) |
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
# MARQUEE_API_TOKEN=<bearer-secret>      # n8n inbound védelem
# N8N_WEBHOOK_URL=<https://...>          # deliverable_shipped outbound
# PI_AUTH_FILE=/home/balazs/.pi/agent/auth.json  # OAuth credentials path
```

**OAuth setup kötelező első indulás előtt** — a `openai-codex` provider ChatGPT-előfizetéses OAuth flow-t igényel. Ha nincs `auth.json`, az agent indulás failel. Token expiry esetén `error` event a Director chat-be.

**Login parancs (egyszer kell):**
```bash
cd packages/server && npx tsx src/scripts/login-openai.ts
# URL → böngésző → ChatGPT login → kód másolás → ~/.pi/agent/auth.json létrejön
```
A script utolsó sora az elavult `MARQUEE_PROVIDER_MODE=openai-subscription` instrukció — ignoráld, az új MVP-ben ez az env var már nem létezik.

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
│   │   ├── drizzle/             # init migration + meta
│   │   ├── seed/                # bundled memory templates + skill recipes (HU)
│   │   └── src/
│   │       ├── agents/          # config (4 role), factory (spawn), transform-context
│   │       ├── broker/          # event-bus, router (dispatchBrief), recovery
│   │       ├── db/              # schema (13 tábla), queries, index
│   │       ├── memory/          # read, write, proposals, validate, seed
│   │       ├── providers/       # openai-codex modelForRole + auth
│   │       ├── tools/           # read-memory, propose-brief, propose-memory-update, submit-deliverable
│   │       ├── server/          # buildServer + auth-middleware + routes/* + sse
│   │       ├── skills/          # loader (loadSkillRecipes)
│   │       ├── webhooks/        # n8n-outbound (3× retry)
│   │       └── scripts/         # smoke.ts, login-openai.ts
│   └── web/src/
│       ├── components/          # TopNav, ChatThread, BriefProposalCard, StatusBadge, ...
│       ├── views/               # Workshop, Approvals, DeliverableDetail, Memory
│       ├── store/               # useMarqueeStore (Zustand)
│       └── lib/                 # api, sse, design, utils
├── scripts/deploy.sh
├── infra/marquee.service        # systemd unit
└── docs/superpowers/{specs,plans}/2026-04-29-marquee-*.md
```

## Magyar nyelv konvenció

**Minden user-facing és LLM-facing szöveg magyar:** skill recipe-k, tool description-ök, UI labelek, deliverable kimenet. Nincs nyelv-kapcsoló.

Kivétel: kód identifier, DB column név, type név, log message, code comment angol.

## Tipikus parancsok

```bash
# Tesztek (server-side)
cd packages/server && npx vitest run

# TS check
cd packages/server && npx tsc --noEmit
cd packages/web && npx tsc --noEmit

# Build
npm run build --workspaces

# Smoke (live backend kell hozzá + OAuth)
DATA_DIR=~/.marquee-dev npm run smoke --workspace=packages/server
```

## Gotchas

**Typebox fix.** A `@mariozechner/pi-ai` v0.70.2 `typebox ^1.1.24`-et igényel, de a v1.1.25+ csomagból hiányzik a `build/index.mjs`. Root `package.json`-ban:

```json
"dependencies": { "typebox": "1.1.24" },
"overrides": { "typebox": "1.1.24" }
```

**Vitest cwd.** A `migrationsFolder: 'drizzle'` a vitest cwd-jéhez relatív. Mindig `cd packages/server` előtte.

**Drizzle-orm verzió mismatch.** Root `0.45.2`, `packages/server` `0.36.0`. Most működik (npm hoist), de jövőbeli típushibák okai lehet. Egyelőre ne nyúlj hozzá.

**Frontend token mapping.** A spec-ben szereplő `border-divider` / `text-slate` / `bg-surface-white` token nevek nem léteznek a `tailwind.config.js`-ben. Használd: `border-rule` / `text-ink-2` / `bg-off-white`.

## Production VM 260 állapot (2026-04-30)

Deploy-ready, de még nem deployolva:
- Régi v0.1/v0.2 takarítva, backup: `/tmp/marquee-cleanup-2026-04-29/`
- `marquee.service` **inactive (dead)**
- **OAuth setup hiányzik** — `~/.pi/agent/auth.json` nincs a szerveren, első deploy előtt kell:
  ```bash
  ssh balazs@192.168.2.60
  cd /opt/marquee/packages/server && npx tsx src/scripts/login-openai.ts
  ```

## Homelab kontextus

A Marquee egy node a homelab-ban (VM 260, ai-agency). A teljes infra-szintű dokumentáció a `~/Projects/Homelab/CLAUDE.md`-ben.
