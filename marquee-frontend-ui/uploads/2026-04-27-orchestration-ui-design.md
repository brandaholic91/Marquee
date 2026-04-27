# AI Marketing Agency — Orchestration UI Design Spec

**Dátum:** 2026-04-27
**Státusz:** jóváhagyva (brainstorm v1)
**Típus:** WUPHF lecserélése saját orchestration UI-ra a marketing-agency stack alá
**Kapcsolódó:** [`2026-04-26-ai-marketing-agency-design.md`](./2026-04-26-ai-marketing-agency-design.md) (v3) — felülírja annak runtime és WUPHF-fork részeit; megőrzi az ügynökség-architektúrát, role-okat, dual-mode providert, MarTech integrációt, portfolio showcase-t

---

## 1. Összefoglalás

A WUPHF + Hermes oneshot kombináció strukturális hibái (ld. 3. szekció) miatt elvetjük a WUPHF fork-ot, és helyette egy saját, **pi-agent-core alapú** orchestration UI-t építünk, ami funkcióban átfedi a WUPHF-ot, de tisztán a marketing-agency use case-re szabott. Hermes teljesen kikerül; a runtime egyetlen Node.js folyamat, ami pi-agent-core Agent instance-okat futtat, és React SPA-n keresztül adja a "command center" élményt.

Codename: **`marquee`** (lockoltuk 2026-04-27 — a színházi homlokzat metaforája, "ami a marketingre kerül"; rövid, brandable, összes repo/package/port/systemd név erre épül).

---

## 2. Motiváció — pain pointok, amiket fel akarunk számolni

A WUPHF + Hermes fejlesztés közben felmerült problémák:

1. **Hermes `-z` oneshot mód orchestration-ra alkalmatlan**
   - Nincs streaming (csak végső stdout után derül ki, mi történt)
   - Tool call döntés opaque: a model "csendben" kihagyhatja a tool-okat (megfigyelt eset: kontextus-szennyeződéstől nem hívta a `team_broadcast`-et)
   - Minden turn = teljes Python process spawn (~3s overhead per üzenet)
   - System prompt egyetlen `-z <prompt>` argumentumba gyúrva manual `<system>` taggel — nincs structured input

2. **State sync három független process között törékeny**
   - Broker (Go) + Hermes (Python) + MCP server (Go) koordinációja `/tmp/wuphf-broker-token` fájl + env varok mentén
   - Token minden WUPHF restart-on rotál → resumelt Hermes session-ök elhalnak (ExecStartPre hack kellett)
   - `broker-state.json` korlátlanul nőtt (158 üzenet 1 nap után)
   - `resumeInFlightWork` régi üzenetekből spurious trigger-eket csinált
   - Session ID-k 4 különböző helyen tárolódtak

3. **WUPHF Go codebase fork-olva nehezen fejleszthető**
   - `launcher.go` 4500+ sor, `buildPrompt()` hardcoded angol instrukciókkal
   - Egy "language" config mező 2 fájl + 2 return point patch-et igényelt, redeployt
   - `headless_codex.go` / `headless_hermes.go` névadás keveredett
   - Lead és Specialist promptban **duplikált** logika
   - Upstream rebase pain: 10+ patch a `hermes-provider` branch-en

4. **Observability fragmentált, debug pokoli**
   - 4+ log helyen szétszórva: journalctl, `~/.hermes/logs/agent.log`, `~/.hermes/logs/mcp-stderr.log`, `~/.wuphf/codex-headless/.hermes/logs/`
   - Nincs tool-call audit trail (30+ percet vesztettünk arra hogy kiderüljön: a model el sem indította a tool callt)
   - Nincs token/cost tracking per turn, per agent
   - Nincs "agent X éppen Y üzenetet dolgozza fel" view

5. **Channel metafora nem illik deliverable-orientált munkához**
   - Slack-szerű `#general`, `#copy` channelek, miközben a valódi output cikkek/landing page-ek
   - Draftok a `team/drafts/` alá kerülnek, de a wiki UI nem indexeli
   - PAM (Pam the Archivist) wiki action-ként ráhegesztve, nem koherens absztrakció
   - Nincs "deliverable" / "artifact" view; a végzett munka chat history-ban van eltemetve

6. **Hierarchia támogatás csak prompt-szintű**
   - Director → Content-Lead → Copywriter routing kizárólag system prompt instrukciókból
   - Strukturálisan a WUPHF mindenkit egyenrangú peernek tekint
   - Specialisták szabadon @-taggelhetik egymást, ami a delegation mode-ot bezavarja
   - `team_lead_slug` config flag, nem strukturális hierarchia

---

## 3. Core architectural decisions

| # | Döntés | Indok |
|---|---|---|
| **1** | **Runtime: pi-agent-core (TypeScript / Node)** | Streaming event stream out-of-box, explicit tool-call lifecycle (`tool_execution_start/end`), `beforeToolCall` / `afterToolCall` hookok, `transformContext` retention/memory hook, custom `AgentMessage` típusok (declaration merging) — pontosan az a primitív, amit a Hermes oneshot nem adott meg |
| **2** | **Hermes teljesen kikerül (clean cut)** | A 10+ patch-es fork karbantartása drágább, mint a 5-10 Hermes skill portolása TS AgentTool-okká + markdown skill recipékké |
| **3** | **UI metafora: hibrid command center (D)** | Single-user agency-owner workflow = observability + triage, nem mély artifact-szerkesztés. Home dashboard 6 widgettel + deep view-ok (kanban, deliverable detail, budget, schedule, agent feed, approval queue) |
| **4** | **Agent lifecycle: hibrid (Y) — Director + 3 Lead warm, 6 Specialist spawn-per-task** | Director és Lead-ek folyamatos koordinációhoz warmek, Specialisták frissen spawnolódnak (no kontext-szennyeződés régi taskokról, low RAM baseline) |
| **5** | **Persistence: SQLite WAL + markdown/git memory** | SQLite a runtime state-hez (turnök, delegations, deliverables, events), markdown/git a curated knowledge memóriához (brand voice, ICP, kliens profil, kampány history) — a memory ember-szerkeszthető és verziókövetett |
| **6** | **Frontend: React + Vite + Tailwind + shadcn/ui** | Standard választás, hatalmas komponens-ökoszisztéma (kanban, markdown render, charts, calendar), shadcn/ui copy-paste minták |
| **7** | **Real-time: SSE (server→client events) + REST POST (client→server actions)** | Egyszerű, asszimetrikus, NPM proxy-zható, no WebSocket upgrade dance |
| **8** | **Tool implementáció: hibrid (c) — TS protokoll + TS integráció + markdown skill recipes** | Strukturális hierarchia enforcement (Specialist nem kap `delegate` toolt), domain skill-recept iterálható markdown-ban code change nélkül |
| **9** | **Chat first-class entitás, két módban** | Intake (co-creation Directorral, brief draftolás), production (delegation pipeline). Onboarding = full-screen chat flow, memory feltöltésig. Memory és brief is `propose_*` toolokon keresztül változik (agent javasol, ember confirmál) |

---

## 4. Architektúra overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (single-user, LAN)                                      │
│  React + Vite SPA                                                │
│  ├─ Onboarding chat (full-screen, first-run)                     │
│  ├─ Home dashboard (6 widget)                                    │
│  ├─ Pipeline (kanban deep view)                                  │
│  ├─ Deliverable detail view                                      │
│  ├─ Live Agent Feed                                              │
│  ├─ Memory editor                                                │
│  └─ Chat drawer (always-on, right side, collapsible)             │
└──────────────────────────────────────────────────────────────────┘
                        │ SSE: GET /api/events
                        │ REST: POST /api/{briefs,messages,...}
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│  Node.js daemon (systemd: marquee.service, VM 260)                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐  │
│  │ HTTP/SSE API │  │ Broker (event bus + persist + routing)   │  │
│  │ (Fastify)    │  │  ↕ EventEmitter                          │  │
│  └──────┬───────┘  └─────────┬────────────────────────────────┘  │
│         │                    │                                   │
│         │            ┌───────┴──────────┐                        │
│         │            │ Agent Pool       │                        │
│         │            │  Director  (warm)│                        │
│         │            │  3× Lead   (warm)│                        │
│         │            │  Eval Judge(warm)│                        │
│         │            │  6× Specialist   │  ← spawn-per-task      │
│         │            │   (transient)    │                        │
│         │            └───────┬──────────┘                        │
│         │                    │                                   │
│         │            ┌───────┴──────────┐                        │
│         │            │ pi-agent-core    │                        │
│         │            │ + pi-ai          │                        │
│         │            │ (in-process)     │                        │
│         │            └───────┬──────────┘                        │
│         ▼                    ▼                                   │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐  │
│  │ SQLite (WAL) │  │ Tools (TS) + Skill recipes (markdown)    │  │
│  │ ~/.marquee/   │  │ ~/.marquee/skills/<role>/<skill>.md       │  │
│  │   state.db   │  └──────────────────────────────────────────┘  │
│  └──────────────┘  ┌──────────────────────────────────────────┐  │
│                    │ Memory git repo: ~/.marquee/memory/       │  │
│                    │   client_profile.md, brand_guidelines.md │  │
│                    │   ongoing_campaigns.md, content_history  │  │
│                    └──────────────────────────────────────────┘  │
│                                                                  │
│  ↓ HTTPS                                                         │
│  pi-ai providers: opencode-go (flat) | openrouter (api)          │
└──────────────────────────────────────────────────────────────────┘
```

> **Megjegyzés:** A fenti diagram a **teljes vízió** (v0.3 állapot) — minden role aktív, minden widget jelen van. A v0.1 scope szűkebb (4 role, 5 view, no drag-drop, no Budget/Schedule widget) — ld. 10.1 szekció.

**Process layout:**
- Egyetlen Node folyamat (systemd `marquee.service`), tartalmazza: HTTP/SSE szerver, broker, agent pool, pi-agent-core, SQLite kliens
- A frontend statikus SPA, a Node ugyanezen porton szolgálja ki (`:7892`)
- NPM proxy `marquee.lab2.home.arpa` → `192.168.2.60:7892`; LAN-only

**Adatfolyam egy brief életútján (chat-flow):**

1. Új chat thread Directorral → te beszélgetsz vele, scope tisztázódik
2. Director hívja a `propose_brief(...)` toolt → Brief(status=`draft`) létrejön, kártya a chatben "Approve & dispatch" gombbal
3. Te kattintasz approve → Brief(status=`dispatched`), DelegationRequest létrejön a Directorra
4. Director feldolgozza → `delegate_to_lead("content", brief)` → broker létrehoz `DelegationRequestMessage`-et a Content Lead inboxába → Lead turn elindul
5. Lead `delegate_to_specialist("copywriter", task)` → broker spawnol új Copywriter Agent-et frissen, kezdő kontextussal (brief + skill recipe `blog_post_writer.md`)
6. Copywriter `submit_deliverable(...)` → Deliverable record (`drafting` → `awaiting_eval`) → Eval Judge auto-trigger → advisory score → `awaiting_approval`
7. Te a dashboard "Approvals" widgetjéről "approve" → `shipped`, SSE értesít

---

## 5. Adatmodell

### 5.1 Két szétválasztott layer

- **SQLite** (`~/.marquee/state.db`) = strukturált runtime állapot, gyors query
- **Filesystem** (`~/.marquee/{memory,skills,artifacts}/`) = ember-szerkeszthető markdown, git-tracking, deliverable forrás

### 5.2 SQLite séma (lényeg)

```
chat_threads(id, type[intake|dispatched|consultative], title, archived_at)
chat_participants(thread_id, agent_slug)  -- 'human' is one
messages(id, thread_id?, agent_session_id?, sender, type, content_json, ts)
  -- type: chat | delegation_req | delegation_resp | brief_proposal
  --     | memory_proposal | eval_report | tool_call | tool_result
  --     | approval_decision | human_brief

briefs(id, source_thread_id?, status[draft|dispatched|done], content_md, dispatched_at)

delegations(id, brief_id, parent_delegation_id?, from_agent, to_agent,
            status[requested|in_progress|complete|blocked],
            payload_json, requested_at, completed_at)

deliverables(id, delegation_id, type, title,
             status[drafting|awaiting_eval|awaiting_approval|shipped|archived],
             current_revision_id)
deliverable_revisions(id, deliverable_id, artifact_path, created_by_agent, ts)

evals(id, revision_id, scores_json, summary_md, ts)
approvals(id, deliverable_id, decision[approved|rejected|requested_changes], note, decided_at)

agent_sessions(id, agent_slug, lifecycle[warm|transient],
               parent_delegation_id?, started_at, ended_at)
turns(id, session_id, model, prompt_tokens, completion_tokens,
      cost_usd, latency_ms, started_at, ended_at)

events(id, ts, agent_slug?, session_id?, turn_id?, type, payload_json)
  -- append-only, retention 30 nap (utána archive)

memory_proposals(id, agent_session_id, file, patch, status[pending|approved|rejected], ts)
```

Indexek: `messages(thread_id, ts)`, `delegations(parent_delegation_id, status)`, `deliverables(status)`, `events(ts DESC)`, `turns(session_id, started_at)`.

### 5.3 Custom AgentMessage típusok (pi-agent-core declaration merging)

```typescript
type AgentMessage =
  | UserMessage | AssistantMessage | ToolResultMessage  // standard
  | HumanBriefMessage                                    // formal brief
  | DelegationRequestMessage                             // agent → agent task
  | DelegationResponseMessage                            // agent → agent result
  | BriefProposalMessage                                 // chat-card draft
  | MemoryProposalMessage                                // patch javaslat
  | EvalReportMessage                                    // 3-dim score
  | ApprovalDecisionMessage;                             // human approve/reject
```

A `convertToLlm` szűri ezeket: minden custom típus → szöveges reprezentáció (pl. `<delegation>...</delegation>` strukturált blokk a system promptban). LLM nem látja a JSON-t, mi gépileg lekérdezhető adatot kapunk.

### 5.4 Filesystem layout

```
~/.marquee/
├─ state.db, state.db-wal, state.db-shm
├─ memory/                        # ← git repo, naponta 02:00 auto-commit (v0.3)
│  ├─ .git/
│  ├─ client_profile.md           # ICP, USP, versenytársak (YAML frontmatter)
│  ├─ brand_guidelines.md         # tone of voice, referencia posztok
│  ├─ ongoing_campaigns.md
│  └─ content_history.md
├─ skills/                        # ← git repo, te szerkeszted manuálisan
│  ├─ director/
│  │  ├─ brief_parser.md
│  │  └─ lead_router.md
│  ├─ content-lead/
│  ├─ copywriter/
│  └─ eval-judge/
└─ artifacts/                     # deliverable tartalom
   └─ <deliverable_id>/
      ├─ rev_001.md
      └─ rev_002.md
```

Skill recipe markdown: YAML frontmatter (`name`, `when_to_use`, `input_schema`) + body (mustache template-tel: `{{client_profile.brand_voice}}` típusú változó-interpoláció). A `transformContext` ezt parsing-eli és injektálja a system promptba.

Memory fájlok: YAML frontmatter (strukturált kulcsok: `client_name`, `icp`, `usp`, `brand_voice`, `competitors`, ...) + body (free-form markdown). A `read_memory(file)` tool a frontmatter-t parsed objectként, a body-t string-ként adja.

### 5.5 Dashboard widget → SQL mapping

Minden widget egy single SQL query:

| Widget | Lekérdezés |
|---|---|
| Approvals queue | `SELECT * FROM deliverables WHERE status='awaiting_approval' ORDER BY updated_at` |
| Live Agent Feed | SSE stream `events` + initial `LIMIT 100` |
| Pipeline kanban | `GROUP BY status` count + per-status detail |
| Budget today | `SUM(cost_usd) WHERE started_at >= today_start` |
| Top spender | `JOIN agent_sessions GROUP BY agent_slug ORDER BY SUM(cost_usd) DESC LIMIT 1` |
| Active conversations | `chat_threads WHERE archived_at IS NULL` |
| "Ki min dolgozik" | `agent_sessions LEFT JOIN delegations WHERE ended_at IS NULL` |

---

## 6. Komponensek

### 6.1 Backend modul layout

```
src/
├─ server/        # Fastify HTTP/SSE szerver, route handlerek
├─ broker/        # event bus + persist + routing
├─ agents/        # Agent factory, role registry, lifecycle
├─ tools/         # TS AgentTool implementációk role-onként
├─ skills/        # markdown skill-recipe loader + mustache template
├─ memory/        # git-backed memory CRUD + transformContext hook
├─ db/            # SQLite séma, migrációk, queryk (Drizzle ORM)
├─ providers/     # pi-ai wrapper, model selection per role/mode
└─ telemetry/     # token/cost/latency aggregátor
```

Cél: minden modul < 500 sor, well-defined interface. A `launcher.go` (4500 sor) anti-mintát modulhatárokkal kerüljük.

### 6.2 Tool registry — strukturális hierarchia enforcement

Minden role egy curated tool-listát kap az Agent constructorban. Ami nincs benne, azt nem hívhatja — nem prompt-szintű kérés, fizikai hiány.

**v0.1 tool-szettek:**

| Role | Tools |
|---|---|
| Director | `delegate_to_lead`, `propose_brief`, `propose_memory_update`, `read_memory`, `web_fetch`, `request_input` |
| Content Lead | `delegate_to_specialist`, `submit_to_director`, `read_memory`, `request_input` |
| Copywriter | `submit_deliverable`, `respond_to_lead`, `read_memory`, `propose_memory_update`, `web_fetch` |
| Eval Judge | `submit_eval_report`, `read_memory`, `read_deliverable` |

Pain point megoldás: Specialist nem hívhat `delegate_*` toolt → nem @-taggelhet peer-eket. Lead csak saját Specialistáit delegálhatja (a tool argumentum schema validálja kompatibilitást).

### 6.3 Broker felelőssége

1. **Routing**: agent tool callja → broker beazonosít target agentet → `DelegationRequestMessage` annak inboxába
2. **Lifecycle**: warm agentek mindig életben; Specialist spawnolása on-demand minimal kontextussal (brief + skill recipe + role tool-set + model config); turn lefutott → agent eldobva, eventek + result SQLite-ban marad
3. **Event fan-out**: minden event SQLite-ba ÉS SSE subscribereknek
4. **Cost/token aggregáció**: pi-ai `turn_end` metric → `turns` tábla → Budget widget
5. **Memory injection**: Agent indulás előtt `transformContext` hookba beragad: role releváns memory + thread/delegation history kompakt formában (50 turn felett pruning)

### 6.4 transformContext = retention + memory injection

```typescript
async transformContext(messages: AgentMessage[]): Promise<AgentMessage[]> {
  const memoryBlock = await memory.loadFor(role);     // markdown → user message
  const pruned = await pruner.compact(messages, { keepRecent: 50 });
  return [memoryBlock, ...pruned];
}
```

A `messages` SQLite tábla **megőrzi** az összes eredeti üzenetet (audit), de az **LLM-be küldött kontextus** mindig kompakt. Két különböző lookup: `db.messages.findByAgent(slug)` vs. `agent.getCurrentContext()`.

---

## 7. UI design

### 7.1 Onboarding flow (first-run)

App betöltődik → SQLite üres + memory templates üresek → **automatikusan full-screen chat indul a Directorral**. Director végigkérdez (minden válasz `propose_memory_update` patch, te confirmálod):

1. Ki az ügyfél, mit csinál? → `client_profile.md` draft
2. Brand voice, referencia tartalom? → `brand_guidelines.md` draft (uploads)
3. Versenytársak, USP, ICP? → `client_profile.md` bővítés
4. Mi az első kampány célja? → `ongoing_campaigns.md` + opcionális `propose_brief(...)`

Memory populated → dashboard megjelenik, Director: "Készen állunk. Mivel kezdjünk?"

### 7.2 Home dashboard (6 widget)

```
┌──────────────────────────────────────┬──────────────┐
│ HOME — command center                │ Chat drawer  │
│ ┌─────────┬───────────┐              │ (collapsible)│
│ │APPROVALS│ LIVE FEED │              │              │
│ ├─────────┼───────────┤              │ #director    │
│ │PIPELINE │ BUDGET    │              │ Q2 stratégia │
│ │         │ SCHEDULE  │              │ Geckoboard   │
│ └─────────┴───────────┘              │   brief WIP  │
│ + Active Conversations               │              │
│                                      │ [+ new chat] │
└──────────────────────────────────────┴──────────────┘
```

Mindegyik widget kattintható → deep view:

- **Approvals** → inbox-szerű deliverable lista approval-szűrővel
- **Live Agent Feed** → live event stream (sub-agent spawn, tool call, eval score, error)
- **Pipeline** → kanban (drag-and-drop státusz mozgatás v0.2-ben)
- **Deliverable detail** (mindenhonnan elérhető): markdown render középen + side thread + eval history + revision diff
- **Budget** → token/cost dashboard per agent, per deliverable, per nap
- **Schedule** → editorial calendar (v0.3)

### 7.3 Chat drawer

Mindig elérhető a jobb oldalon, kollabálható. Egy aktív chat-en belül `@director`, `@content-lead`, `@copywriter` mention-nel hívsz be résztvevőket. Specialisták default nincsenek (csak ha explicit hívod őket). Thread state-ek: `intake` (még brief draftolás) / `dispatched` (production-ben fut, deliverable-höz csatolva diszkussziós threadként) / `consultative` (folyamatos, nem lesz deliverable, pl. stratégia).

---

## 8. Hibakezelés és resiliency

### 8.1 LLM provider hibák

- pi-ai built-in retry + backoff transient hibákra (5xx, timeout)
- **Rate limit flat módban**: Director `beforeToolCall`-szerű mechanizmussal modellt vált (Kimi K2.6 → deepseek-v4-pro), `provider_fallback` event
- **Tartós provider down** (3+ retry után): turn `failed`, delegation `blocked`, dashboard piros badge, te `retry`-elsz vagy steerelsz

### 8.2 Agent turn crash (Node exception, tool throw)

- Turn `failed` SQLite-ban; trace `events.payload_json`-ban
- **Warm agent**: pi-agent-core nem persistálja a partial state-et `turn_end` előtt → következő prompt simán fut
- **Transient Specialist**: agent eldobva, delegation `blocked`. Auto-retry policy: **1× automata retry** (a flaky LLM hiba magától elmúlik gyakran, strukturális hibát ne maszkoljunk); második fail → emberi beavatkozást vár

### 8.3 Broker / Node folyamat összeomlik (systemd restart)

Boot recovery sorrend:

1. DB nyitás → minden `agent_session WHERE ended_at IS NULL`:
   - warm role → message history-ból Agent rehidratálva, futtatás folyt.
   - transient → session lezárva (status=failed), parent delegation `blocked`
2. Minden `delegation WHERE status='requested'` → target inboxába vissza
3. SSE subscriberek újracsatlakoznak (frontend exponential backoff + `Last-Event-ID`)

A `resumeInFlightWork` spurious-trigger megoldás: csak `status='requested'` delegation triggerelődik, **chat üzenetek nem**. Egy chat thread restart után ott van ahol volt — nem ad spontán "munka folytatva" üzenetet, csak ha te beírsz.

### 8.4 Memory git művelet hibája

`propose_memory_update` confirm flow atomi:

1. Patch validáció (schema check ha frontmatter)
2. `git apply --check`
3. Ha sikerült → `git apply` + `git commit`; ha bárhol hibázik, `git checkout -- <file>` rollback
4. UI értesítés sikerről/hibáról

### 8.5 SSE reconnect

- `Last-Event-ID` alapján szerver `events.id > last`-tól resume
- Gap > 1000 event → kliens full state refetch (`GET /api/state/snapshot`)
- 15s heartbeat (`: keepalive` SSE comment)

### 8.6 Budget guard policy

- **Soft 80%**: `budget_warning` event Live Feedre, cron rutinok pause-olódnak
- **Hard 100%**: `beforeToolCall` blokkolja sub-agent (Lead, Specialist) Agent.prompt() hívását; csak Director mehet tovább. Te `unlock_budget` API-val kézzel emelheted, audit log
- API módban Helicone-ból, flat módban beépített rate-limit logból kalkulál

### 8.7 Race-ek és konkurencia

- Két delegation egy warm agentre egyidőben → pi-agent-core internal queue (`steeringMode: "one-at-a-time"`)
- Memory proposal conflict: SQLite `memory_proposals` tábla rekord-szintű lock, második patch `git apply --check` failuron `requested_changes`, agent kap `tool_result` errort (stale base, please re-read memory)
- Approve race: állapotgép enforces `awaiting_approval → approved` csak ha jelenlegi state `awaiting_approval` (CHECK constraint + transaction)

---

## 9. Tesztelési stratégia

### 9.1 Egységtesztek (vitest, ingyen)

- TS AgentTool-ok: schema validation, happy + error path
- Memory CRUD: temp git repo, patch atomicity (rollback)
- Broker routing: mock Agent osztály, message in → ellenőrzés melyik inboxba került
- Spawn-per-task lifecycle: Specialist megszületik delegation-re, eldobódik turn vége után
- `transformContext` retention: 100 message → kompakt summary + utolsó 50 turn megőrződik

### 9.2 Pi-agent integration tesztek — record/replay (ingyen CI-ban)

- Recording (manuális, ritka): valódi Haiku 4.5 hívás, `streamFn` wrapper minden chunk-ot lemásol → fixture file
- Replay (CI-ban gyors): mock `streamFn` fixture-ből → assertelhető teljes event sorozat

Példa fixture-tesztek:
- Director kap brief → `delegate_to_lead` → broker megfelelően routol
- Copywriter `submit_deliverable` → Deliverable record + eval auto-trigger
- Eval Judge `submit_eval_report` → SQLite eval + status update
- Budget hard limit → `beforeToolCall` blokkolja Specialistát

### 9.3 Manuális smoke test (`npm run smoke`)

Minimal ügynökség (Director + 1 Lead + 1 Copywriter, Haiku 4.5) feléledik, fixture briefet kap, 60 mp-en belül `awaiting_approval` deliverable lát. Te döntöd mikor futtatod (~$0.30 / futás).

### 9.4 Production telemetria mint quality signal (ingyen)

Az Eval Judge minden élesben gyártott deliverable-t pontoz (3-dim) — **része a normál workflow-nak, nem extra cost**. Dashboard kiterjesztés (v0.2):

- **Quality trend mini-widget**: utolsó 30 nap eval score átlaga 3 dim, sparkline
- Skill recipe módosítás → következő 2-3 deliverable score-ja megmutatja a hatást természetes módon
- Tooltip + `git log skills/` link → korreláció recipe-változás és score-trend között

Fizetős eval CI **explicit nincs** (single-user homelab cost-érzékenység).

### 9.5 Frontend tesztek

- vitest + react-testing-library (widget komponensek, SSE mock)
- Playwright (v0.2): néhány happy-path E2E

### 9.6 TDD diszciplína

- Minden új AgentMessage típus → `convertToLlm` szerializációs unit teszt
- Minden új tool → schema validation + happy/error path
- Minden role tool-szettje → snapshot teszt (Specialist nem kap `delegate` toolt, soha)
- PR merge feltétel: 80%+ coverage `src/{tools,broker,memory}/`-on (`src/server/` alól nem kell)

---

## 10. MVP scope

### 10.1 v0.1 (~2-3 hét) — agency runs end-to-end on blog posts

**Backend modulok:** server, broker, agents, tools, skills, memory, db, providers, telemetry (mind v0.1-ben init állapotban)

**Agentek (4 role aktív):**
- Director (warm) — chat mode + production routing
- Content Lead (warm)
- Copywriter (spawn-per-task)
- Eval Judge (warm) — automatikus advisory score, **nem blokkol**

**TS AgentTool-ok:** ld. 6.2 szekció (12 distinct tool implementáció, role-onként curated set; több role megosztja a `read_memory`, `web_fetch`, `propose_memory_update`, `request_input` toolokat)

**Skill recipes (5 markdown):**
- `director/brief_parser.md`, `director/lead_router.md`
- `content-lead/editorial_brief_handoff.md`
- `copywriter/blog_post_writer.md`
- `eval-judge/three_dim_review.md`

**Memory fájlok (templates first-run-ra):**
- `client_profile.md`, `brand_guidelines.md`, `ongoing_campaigns.md`, `content_history.md`

**Deliverable type:** csak `blog_post` (landing_page és linkedin_post v0.2-ben)

**Provider:** csak `opencode-go` (flat mode); OpenRouter v0.2-ben

**Frontend (5 view):**
1. Onboarding chat (full-screen első induláskor)
2. Home dashboard: Approvals + Live Agent Feed + Pipeline (státusz oszlopok lista, no drag-drop) + Active Conversations
3. Chat view (drawer + dedikált full view)
4. Deliverable detail view (md render + thread + eval history)
5. Memory editor (per-fájl markdown view + proposal queue)

**Deploy:** systemd `marquee.service` VM 260, NPM proxy `marquee.lab2.home.arpa` → `192.168.2.60:7892`, LAN-only, single-user, no auth. WUPHF systemd kikapcsolva (fork repo megmarad referenciaként)

**Tesztelés:** vitest unit + replay fixture-ök + `npm run smoke` manuális

### 10.2 v0.2 deferred (~2 hét)

- 4 új role: Distribution Lead, Insights Lead, Social Manager, SEO Analyst
- Pipeline kanban drag-and-drop
- Budget widget + Quality trend mini-widget
- `landing_page`, `linkedin_post` deliverable type
- `query_matomo`, `serpapi_search` integrációk
- OpenRouter (api mode) `.env` toggle + Helicone proxy
- Brief intake direct API (`POST /api/briefs`) — chat-flow mellé
- Playwright E2E happy-path

### 10.3 v0.3 deferred (~1-2 hét)

- Paid Specialist + manual approval gate (külön workflow)
- Repurposer + repurposing loop (multi-channel adaptáció)
- Analytics Analyst + `performance_report` skill
- Schedule / Editorial Calendar widget
- Brand voice RAG (embedding + similarity search)
- Memory auto-commit cron (02:00) + opcionális private remote push
- Cron rutinok: `morning_brief`, `weekly_performance_report`, `monthly_strategy_review`
- Telegram gateway (opcionális)

---

## 11. Deployment / ops

### 11.1 VM és stack

A meglévő `ai-agency` (VM 260, 192.168.2.60, 6 GB RAM, Ubuntu 24.04) gépet használjuk. A WUPHF systemd service-t kikapcsoljuk (`systemctl disable wuphf`), a fork repo megmarad referenciaként.

Telepítés sorrendje:
1. Node.js 22 LTS (a meglévő Docker és Hermes mellé, nem ütközik)
2. `npm install -g` a futtatható csomag
3. `~/.marquee/` mappa init (state.db, memory git repo, skills git repo, artifacts)
4. systemd unit `/etc/systemd/system/marquee.service` (`User=balazs`, `WorkingDirectory=/opt/marquee`, `EnvironmentFile=/opt/marquee/.env`)
5. NPM proxy `marquee.lab2.home.arpa` → `192.168.2.60:7892`
6. CoreDNS (`infra-edge`) zona record
7. Uptime Kuma monitor

### 11.2 Env vars

```bash
# /opt/marquee/.env (chmod 600)
HERMES_PROVIDER_MODE=flat               # marad a designspec-ből: flat|api
OPENCODE_API_KEY=<key>                  # pi-ai env var name
OPENROUTER_API_KEY=<key>                # opcionális, api módban
HELICONE_API_KEY=<key>                  # csak api módban
PORT=7892
DATA_DIR=/home/balazs/.agency
NODE_ENV=production
```

### 11.3 systemd unit vázlat

```ini
[Unit]
Description=Agency orchestration UI
After=network.target

[Service]
Type=simple
User=balazs
WorkingDirectory=/opt/marquee
EnvironmentFile=/opt/marquee/.env
ExecStart=/usr/bin/node /opt/marquee/dist/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 11.4 Monitoring

- Beszel agent (meglévő, változatlan)
- Uptime Kuma `marquee.lab2.home.arpa` HTTP monitor
- Logok `journalctl -u agency -f`-en (egyetlen log helyen, pain point #4 megoldása)

---

## 12. Implementation sorrend (writing-plans skill bemenete)

Három plan, egyenként ~2 hét, sequential:

- **Plan 1: v0.1** — backend foundation + 4 role + 5 skill + onboarding chat + dashboard (5 widget) + deploy
- **Plan 2: v0.2** — 4 új role + kanban + budget + integrations + OpenRouter mode
- **Plan 3: v0.3** — paid + repurposing + RAG + cron + scheduler

Mindegyik plan külön writing-plans skillen át megy, és külön implementation cycle-ja van.

---

## 13. Open questions / TODO a plan végén

- [x] **Végleges név** — `marquee` (lockoltuk 2026-04-27)
- [ ] **Repo struktúra** — egy monorepo (`packages/server`, `packages/web`) vagy két külön repo (`agency-server`, `agency-web`)? **Plan 1 első taskjában dönt**
- [ ] **shadcn/ui konkrét komponens-lista** — **Plan 1 frontend foundation taskjában lockoljuk**, hogy ne legyen mid-flight bloat

---

## 14. Lecserélt korábbi döntések

A [`2026-04-26-ai-marketing-agency-design.md`](./2026-04-26-ai-marketing-agency-design.md) (v3) **ezekben a részekben felülírva**:

| Eredeti (v3) | Felülírja |
|---|---|
| Hermes Agent harness + WUPHF orchestrációs réteg | pi-agent-core in-process Agent + saját orchestration UI |
| `~/.hermes/sessions/`, `hermes -z` oneshot | pi-agent-core in-process Agent state, streaming events |
| `team/drafts/`, channel metafora | `~/.marquee/artifacts/`, deliverable-first dashboard + chat drawer |
| Hermes skills (`brief_parser`, `topic_cluster_builder`, ...) | TS AgentTool-ok (protokoll + integráció) + markdown skill recipes (domain) |
| WUPHF systemd `wuphf.service` | `marquee.service` |
| WUPHF DNS rekord `wuphf.lab2.home.arpa` | `marquee.lab2.home.arpa` |

**Megőrzött** (változatlanul érvényes):

- Ügynökség hierarchia (Director → 3 Lead → 6 Specialist + Eval Judge)
- Stackly fiktív ügyfél + Phase 1 / 2 channel scope
- Dual-mode provider (flat / api)
- Per-agent model assignment, budget guard policy
- MarTech integráció (Mautic, Matomo, n8n, Windmill)
- Portfolio showcase (`stackly-case.swarmsense.hu`)
- VM 260 paraméterek (6 GB RAM, Ubuntu 24.04)
