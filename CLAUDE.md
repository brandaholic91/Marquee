# Marquee — AI Marketing Agency Orchestration UI

Single-tenant AI marketing ügynökség: Director chat → brief proposal → specialist agent → approval flow → n8n outbound. A backend `pi-agent-core`-on alapul, frontend React + Vite + Zustand.

**Architektúra részletek a spec-ben:** `docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-04-29-marquee-mvp-implementation.md`

## Branch állapot

- **`master`** — `v0.2-final` tag-gel lefagyasztva. Régi v0.2 kód (8 role, lead-tier orchestration). **Itt nem fejlesztünk.**
- **`mvp-redesign`** — aktív fejlesztési branch. **Worktree:** `.worktrees/mvp-redesign/`. Itt minden új munka.

A v0.3-mvp redesign Phase 1–8 + smoke kész + index.ts entrypoint wireup + warm Director chat loop + chat-rendering bug fixek. **Lokálisan a Director chat működik** (gpt-5.4 OAuth-on át válaszol). Phase 9 (deploy + 7-day acceptance) hátra.

## Lokális dev állapota (2026-04-29 vége)

✅ Backend boot tisztán (auth.json beolvasva, default client beszúrva, fresh DB, seed másolva).
✅ Frontend bootol, Workshop nézet renderel, chat composer + bubble-ek helyesek.
✅ User üzenet → POST /api/messages → broker subscribe → warm Director lazy spawn → agent.prompt() → GPT-5.4 válaszol → DB persist → SSE → bubble megjelenik.
✅ Local OAuth setup kész: `~/.pi/agent/auth.json` (openai-codex credentials).
⚠️ **Specialist authManager wireup pending** — Director chat OK, de amint operátor approve-ol egy briefet és specialist agent spawn-olódik (`dispatchBrief` → `spawnAgent` ágon), az LLM hívás failelni fog: a `dispatchBrief` még nem kapja meg az authManager-t. Fix kb. 5 sor: passing through `dispatchInput` → `spawnAgent`. Több mint indokolt mielőtt valódi brief flow-t tesztelünk.
⚠️ **VM 260 OAuth még nincs** — a takarítás lefutott (régi state.db + .env + WUPHF leftover törölve), de auth.json-t a serveren még nem hoztuk létre. Első deploy előtt kell.

A v0.3-mvp tervben nem volt explicit task ezekhez (warm Director loop, factory hibajavítás, frontend chat-rendering bugok) — ezek mind plan-deviations a chat-funkció megalkotásához. Listázva a "Frissítési napló" alatt.

## Frissítési napló (eltérések a tervtől)

| Commit | Típus | Mit |
|---|---|---|
| `2f605bc` | gap-fix | `index.ts` + `server/index.ts` + `db/queries.ts` + `server/sse.ts` rewireolva (régi `AgentRouter` osztály eltávolítva, új plugin-alapú route mount). Tervben implicit volt, explicit task nem létezett. |
| `b9611f0` | task | Task 31: smoke.ts rewrite (terv szerint). |
| `d86b711` | gap-fix | Warm Director chat loop az `index.ts`-ben (lazy spawn első user chat_message-en, serial promise chain a concurrent prompt megelőzésére). |
| `2fac6ab` | bug-fix | Az új `factory.ts` `as never`-rel rejtette el, hogy az Agent options shape rossz (model/systemPrompt/tools nem top-level, hanem `initialState`-en belül kell). Plus `getApiKey` és `AuthManager` nem volt wirelve. Mind javítva v0.2 minta szerint. |
| `45e941f` | bug-fix | Frontend chat: `firstThread.id` (camelCase Drizzle), SSE `chat_message` handler `payload.text` mezőt olvas (nem `contentJson`-t), React StrictMode dupla-mount elleni guard a SSE handler regisztrációhoz, dedupe message ID szerint. |

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
cd ~/Projects/Homelab/marquee/.worktrees/mvp-redesign
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

## Production VM 260 állapot (2026-04-29)

Régi v0.1/v0.2 deployment takarítva, deploy-ready:
- `state.db` törölve (régi schema mismatch)
- `.env` újraírva (régi `OPENCODE_API_KEY` és `MARQUEE_PROVIDER_MODE=flat` ki)
- WUPHF/Hermes leftover (`~/.hermes`, `~/.wuphf`, `~/go`, `/opt/ai-agency`, `/opt/hermes-venv`) törölve — ~2 GB
- Backup: `/tmp/marquee-cleanup-2026-04-29/`
- `marquee.service` **inactive (dead)**, várja a deployt
- OAuth setup még hiányzik (`~/.pi/agent/auth.json` nincs) — első deploy előtt el kell intézni

## Homelab kontextus

A Marquee egy node a homelab-ban (VM 260, ai-agency). A teljes infra-szintű dokumentáció a `~/Projects/Homelab/CLAUDE.md`-ben.
