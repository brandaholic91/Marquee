# Marquee — MVP Redesign Design Spec

**Dátum:** 2026-04-29
**Státusz:** jóváhagyva (brainstorm v1)
**Típus:** v0.2 strip + redesign — egyszerűsített, ügyfélnek deployolható MVP
**Kapcsolódó (felülírt) specek:**
- [`2026-04-27-orchestration-ui-design.md`](./2026-04-27-orchestration-ui-design.md) — v0.1 alap design
- [`2026-04-28-orchestration-ui-v0.2.md`](./2026-04-28-orchestration-ui-v0.2.md) — v0.2 spec
- [`2026-04-29-brief-orchestrator-design.md`](./2026-04-29-brief-orchestrator-design.md) — workflow engine band-aid (törölve)
- [`2026-04-26-ai-marketing-agency-design.md`](../../../../docs/superpowers/specs/2026-04-26-ai-marketing-agency-design.md) — Stackly-fókuszú agency vízió (a stack-szintű részeit megőrizzük, a Marquee-specifikus részek itt felülírva)

---

## 1. Összefoglalás és scope frame

### 1.1 Egy mondatban

A **Marquee** egy single-tenant, magyar nyelvű AI marketing orchestration UI, ami egy Director agenten keresztül 3 specialista (Copywriter, Social Manager, Paid Specialist) munkáját koordinálja, **deliverable-t generál** (`social_post` / `email` / `blog_post` / `ad_copy`), az operátor kézzel approve-ol, és a `shipped` deliverable-ek **n8n webhook-on keresztül** mennek tovább a managed marketing stack többi része felé (Mautic, Matomo, RustFS, ComfyUI — egyik sem a Marquee dolga).

### 1.2 A termék-kontextus

A Marquee **egy komponens** a managed marketing stack-en belül, nem önálló SaaS. A teljes stack (Marquee + n8n + Mautic + Matomo + Metabase + RustFS + ComfyUI) **az ügyfél dedikált gépén / saját szerverén** fut — az adat-szuverenitás az elsődleges differenciátor.

A Marquee MVP célpiaca: **hibrid (B2C-overweight)** — szabadúszó marketingesek, butik ügynökségek, vagy in-house marketinges egy B2C/B2B cégnél, akik **single-tenant** módon használják a saját ügyfelük marketing-tartalmainak előállítására.

### 1.3 Goals

1. Magyar nyelvű intake a Directorral chat formában; brief-eket javasol kártyaként, az operátor approve-olja
2. 4 deliverable típus (`social_post`, `email`, `blog_post`, `ad_copy`) — egy-egy specialist agent állítja elő
3. Approval queue-n az operátor approve / visszaküld javításra / eldob, revisionökkel
4. N8n outbound webhook a `shipped` eseményen → bármilyen platform-publikáció n8n flow dolga
5. N8n inbound REST API bearer-token védelemmel
6. Multi-client séma alvó módban (DB-ben `client_slug` mindenhol, de UI MVP-ben fix `default` clientet használ)
7. ChatGPT subscription auth (`openai-subscription`, OAuth flow)
8. Telepíthető a saját VM 260-ra `scripts/deploy.sh`-sel (Ansible v2-be tolva)
9. Egész rendszer **magyar nyelvű** — UI, agent prompt, skill recipe, deliverable output

### 1.4 Non-goals (explicit kihagyások)

| Kategória | Konkrét kihagyás |
|---|---|
| **Orchestration** | Lead-tier hierarchia, multi-step pipeline, server-side workflow engine (`BriefOrchestrator`), Director synthesis specialist outputon |
| **Agent role-ok** | Eval Judge, distribution-lead, insights-lead, seo-analyst, repurposer, analytics-analyst |
| **Deliverable-ek** | `landing_page`, `twitter_thread`, `case_study`, `seo_brief`, `competitor_analysis`, `content_calendar`, `campaign_plan` |
| **Provider** | OpenCode Go (`flat`), OpenRouter (`api`), Helicone, per-role override env varral, dual-mode switch, budget guard |
| **Memory** | Git-backed memory, `git apply`, unified-diff render, memory auto-commit cron, remote push |
| **Frontend** | Pipeline kanban + drag-drop, Live Agent Feed widget, Budget widget, Quality trend widget, Schedule view, multi-thread chat, dedikált onboarding mode UI, settings panel |
| **Integráció** | Mautic, Matomo, LinkedIn, Telegram, ComfyUI, RustFS direkt integráció — **mindegyik n8n flow-n keresztül** |
| **Deploy** | Ansible playbook, Ansible Vault, multi-host inventory, idegen host fresh provisioning, NPM/DNS automation |
| **Tesztelés** | Playwright E2E, fizetős eval-suite CI, LLM-as-judge regression batch, perf benchmark |
| **Funkcionális** | Bulk approve, auto-ship, in-flight cancel, diff view revisionök között, settings UI panel |
| **Multi-client** | Client switcher UI, multi-client onboarding flow, per-client provider/credentials — séma kész, **UI/funkció v2** |

**A scope-szabály:** ami nincs a Goals listában, az kimaradt — még ha a meglévő kódban van is implementáció. A strip-and-refactor branchen mindent, ami a Goals-on kívül esik, **törölni kell**.

---

## 2. Architektúra

### 2.1 Process layout

Egyetlen Node folyamat (`marquee.service` systemd unit), amely tartalmazza:

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (operator, LAN-only)                                     │
│  React + Vite SPA (statikusan a Node szolgálja ki)                │
└──────────────────────────────────────────────────────────────────┘
                  │ HTTP REST + SSE (port 7892)
                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Node folyamat (marquee.service, VM 260)                          │
│                                                                   │
│  Fastify HTTP/SSE  ─────────────  Broker (event bus)              │
│                                       │                           │
│                  ┌────────────────────┼────────────────────┐      │
│                  ▼                    ▼                    ▼      │
│           Director (warm)      Specialist factory    n8n webhook  │
│              pi-agent-core      (transient agents)    dispatcher  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ SQLite (WAL, better-sqlite3, Drizzle)  +  Filesystem       │    │
│  │ ~/.marquee/state.db        ~/.marquee/{memory, artifacts,  │    │
│  │                              skills, auth.json}             │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                  │ HTTPS (OAuth)
                  ▼
        ChatGPT subscription (gpt-5.4 / gpt-5.4-mini)
```

NPM proxy (`infra-edge`) `marquee.lab2.home.arpa` → `192.168.2.60:7892`. LAN-only, no auth a UI felé.

### 2.2 Backend modul layout (`packages/server/src/`)

| Modul | Felelősség | Sor-célhatár |
|---|---|---|
| `server/` | Fastify routes + SSE endpoint + static serving | <500 |
| `broker/` | event bus + DB persist + agent dispatch | <500 |
| `agents/` | role registry, factory, warm/transient lifecycle | <300 |
| `tools/` | TS AgentTool implementációk role-onként | ~50 / fájl |
| `skills/` | markdown skill recipe loader + template render | <200 |
| `memory/` | plain MD read/write, audit log, proposal queue | <400 |
| `db/` | Drizzle schema + migrations + queries | mappánként |
| `providers/` | pi-ai `openai-codex` wrapper + OAuth tokenkezelés | <200 |
| `webhooks/` | n8n outbound dispatcher | <100 |
| `telemetry/` | turn aggregation (token + latency) | <150 |

### 2.3 Frontend modul layout (`packages/web/src/`)

```
src/
├─ App.tsx                       # router, layout, top nav
├─ views/
│  ├─ Workshop.tsx                # Műhely — chat-first
│  ├─ Approvals.tsx               # Jóváhagyás — list + filter
│  ├─ DeliverableDetail.tsx       # részletoldal
│  └─ Memory.tsx                  # Memória — files + proposals + editor
├─ components/
│  ├─ TopNav.tsx
│  ├─ ChatThread.tsx, ChatComposer.tsx
│  ├─ ProposalCard.tsx, MemoryProposalCard.tsx
│  ├─ DeliverableRow.tsx, DeliverableActions.tsx
│  ├─ StatusBadge.tsx, TypeBadge.tsx
│  ├─ BulbIndicator.tsx
│  ├─ EmptyState.tsx
│  ├─ MemoryFileList.tsx, MemoryEditor.tsx
├─ store/
│  └─ useMarqueeStore.ts          # Zustand
└─ lib/
   ├─ api.ts                      # REST kliens
   ├─ sse.ts                      # SSE subscriber + reconnect
   └─ design.ts                   # DESIGN.md token helperek
```

DESIGN.md (Marquee Design System) változatlanul érvényes — cream canvas, Marquee Red CTA, Bulb Amber active indicator, Source Serif 4 + Inter + JetBrains Mono.

### 2.4 Filesystem layout (`DATA_DIR=~/.marquee`)

```
~/.marquee/
├─ state.db, state.db-wal, state.db-shm    # SQLite WAL mód
├─ auth.json                                # OAuth credentials, chmod 600
├─ memory/
│  └─ clients/
│     └─ default/
│        ├─ profile.md                      # ICP, USP, target audience
│        ├─ brand_voice.md                  # tone + 3-5 referencia
│        └─ ongoing_campaigns.md            # aktív kampányok
├─ skills/                                   # role-szintű, NEM client-szintű
│  ├─ director/
│  │  ├─ client_profile_setup.md             # onboarding interjú
│  │  ├─ brief_intake.md                     # brief draftolás chatben
│  │  └─ delegate.md                         # melyik specialist mikor
│  ├─ copywriter/
│  │  ├─ blog_post_writer.md
│  │  └─ email_writer.md
│  ├─ social-manager/
│  │  └─ social_post_writer.md               # platform-aware
│  └─ paid-specialist/
│     ├─ meta_ad_copy.md
│     └─ google_ad_copy.md
└─ artifacts/
   └─ clients/
      └─ default/
         └─ <deliverable_id>/
            ├─ rev_001.md
            └─ rev_002.md
```

A skill recipe-k role-szintűek (a persona stabil), a client-specifikus tudás a `memory/`-ban. A skill mustache-szerű `{{memory.brand_voice.tone}}` szintaxissal hivatkozhat memory mezőkre — string-replace render az agent indulásakor.

---

## 3. Adatmodell (SQLite séma)

13 tábla. A multi-client séma **mindenhol** jelen van (`client_slug` FK), de v1-ben csak `'default'` érték él.

```sql
-- 1. Multi-client séma (v1-ben 1 sor)
CREATE TABLE clients (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 2. Chat thread-ek
CREATE TABLE chat_threads (
  id TEXT PRIMARY KEY,
  client_slug TEXT NOT NULL REFERENCES clients(slug),
  title TEXT,
  archived_at INTEGER
);

-- 3. Üzenetek (chat + tool callok + system messages)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT REFERENCES chat_threads(id),
  agent_session_id TEXT,
  sender TEXT NOT NULL,           -- 'human' | 'director' | specialist slug | 'system'
  type TEXT NOT NULL,             -- 'chat' | 'brief_proposal' | 'memory_proposal'
                                  -- | 'tool_call' | 'tool_result' | 'system'
  content_json TEXT NOT NULL,
  ts INTEGER NOT NULL
);

-- 4. Brief-ek
CREATE TABLE briefs (
  id TEXT PRIMARY KEY,
  client_slug TEXT NOT NULL REFERENCES clients(slug),
  source_thread_id TEXT REFERENCES chat_threads(id),
  content_md TEXT NOT NULL,
  status TEXT NOT NULL,           -- 'draft' | 'dispatched' | 'done'
  created_at INTEGER NOT NULL,
  dispatched_at INTEGER
);

-- 5. Delegációk (Director → specialist)
CREATE TABLE delegations (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL REFERENCES briefs(id),
  client_slug TEXT NOT NULL REFERENCES clients(slug),
  from_agent TEXT NOT NULL,       -- 'director'
  to_agent TEXT NOT NULL,         -- 'copywriter' | 'social-manager' | 'paid-specialist'
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,           -- 'requested' | 'in_progress' | 'complete' | 'failed'
  requested_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- 6. Deliverable-ek
CREATE TABLE deliverables (
  id TEXT PRIMARY KEY,
  delegation_id TEXT NOT NULL REFERENCES delegations(id),
  client_slug TEXT NOT NULL REFERENCES clients(slug),
  type TEXT NOT NULL,             -- 'social_post' | 'email' | 'blog_post' | 'ad_copy'
  status TEXT NOT NULL,           -- 'drafting' | 'awaiting_approval' | 'shipped' | 'archived'
  current_revision_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 7. Revision-ök
CREATE TABLE deliverable_revisions (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id),
  revision_no INTEGER NOT NULL,
  artifact_path TEXT NOT NULL,
  created_by_agent TEXT NOT NULL,
  feedback_note TEXT,             -- ha visszaküldés volt, az operátor megjegyzése
  ts INTEGER NOT NULL,
  UNIQUE(deliverable_id, revision_no)
);

-- 8. Approval döntések (history)
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id),
  revision_id TEXT NOT NULL REFERENCES deliverable_revisions(id),
  decision TEXT NOT NULL,         -- 'approved' | 'requested_changes' | 'discarded'
  note TEXT,
  decided_at INTEGER NOT NULL
);

-- 9. Agent session-ök (lifecycle)
CREATE TABLE agent_sessions (
  id TEXT PRIMARY KEY,
  client_slug TEXT NOT NULL REFERENCES clients(slug),
  agent_slug TEXT NOT NULL,
  lifecycle TEXT NOT NULL,        -- 'warm' | 'transient'
  parent_delegation_id TEXT REFERENCES delegations(id),
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);

-- 10. Turn-ök (token + latency telemetria)
CREATE TABLE turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_sessions(id),
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);

-- 11. Esemény log (append-only, SSE replay)
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  client_slug TEXT REFERENCES clients(slug),
  agent_slug TEXT,
  session_id TEXT REFERENCES agent_sessions(id),
  turn_id TEXT REFERENCES turns(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

-- 12. Memory változás javaslatok (agent → operator queue)
CREATE TABLE memory_proposals (
  id TEXT PRIMARY KEY,
  client_slug TEXT NOT NULL REFERENCES clients(slug),
  file TEXT NOT NULL,
  prev_content_hash TEXT,
  new_content TEXT NOT NULL,      -- teljes új tartalom (NEM patch)
  agent_session_id TEXT REFERENCES agent_sessions(id),
  reason TEXT,
  status TEXT NOT NULL,           -- 'pending' | 'approved' | 'rejected'
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);

-- 13. Memory audit log
CREATE TABLE memory_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_slug TEXT NOT NULL REFERENCES clients(slug),
  file TEXT NOT NULL,
  source TEXT NOT NULL,           -- 'user' | 'agent:director' | 'agent:copywriter' | ...
  prev_content_hash TEXT,
  new_content_hash TEXT NOT NULL,
  ts INTEGER NOT NULL
);
```

### 3.1 Indexek

- `messages(thread_id, ts)`
- `delegations(brief_id, status)`, `delegations(to_agent, status)`
- `deliverables(client_slug, status, updated_at)`
- `deliverable_revisions(deliverable_id, revision_no)`
- `events(ts DESC)`, `events(client_slug, ts DESC)`
- `agent_sessions(ended_at)` for "still alive" queries
- `memory_proposals(client_slug, status, created_at)`
- `memory_audit(client_slug, file, ts DESC)`

### 3.2 SSE event típusok

| Event type | Mikor | Frontend reakció |
|---|---|---|
| `chat_message` | Director vagy operator üzen | thread frissítés |
| `brief_proposed` | Director `propose_brief` toolt hívott | inline kártya a chatben |
| `brief_dispatched` | operator approve-olta a briefet | kártya state változik, queue update |
| `delegation_started` | specialist agent spawnolódott | "Social Manager dolgozik..." inline jelzés |
| `deliverable_submitted` | specialist `submit_deliverable` toolt hívott | approval queue badge +1 |
| `deliverable_approved` | operator approve | queue csökken, n8n webhook fire |
| `deliverable_returned` | operator visszaküldés javításra | új delegation_started érkezik |
| `deliverable_discarded` | operator eldob | queue csökken |
| `memory_proposed` | agent `propose_memory_update` | memória nézeten badge +1 |
| `memory_decided` | operator approve/reject memory proposal | proposal queue csökken |
| `memory_edited` | operator közvetlenül szerkesztett (`PUT`) | memória nézet refresh |
| `error` | bármilyen hiba | toast notifikáció |

`agent_turn_start` / `agent_turn_end` események persistálódnak az `events` táblába, de SSE-n alapból nem mennek a frontendnek (debug-zaj). `?debug=1` query paraméterrel bekapcsolható.

---

## 4. Director orchestration + agent roster

### 4.1 Agent roster

| Role | Lifecycle | Modell | Mit csinál |
|---|---|---|---|
| **Director** | warm | `gpt-5.4` | Chat az operátorral, brief draftolás, delegáció |
| **Copywriter** | transient | `gpt-5.4` | `email`, `blog_post` |
| **Social Manager** | transient | `gpt-5.4-mini` | `social_post` (platform-aware) |
| **Paid Specialist** | transient | `gpt-5.4-mini` | `ad_copy` (multi-variáns) |

A specialist **delegáció érkeztekor frissen spawnolódik** brief + skill recipe + memory contexttel. **Egy turnben** beadja a `submit_deliverable`-t, **utána eldobódik**. Nincs in-flight state.

### 4.2 Tool registry — strukturális hierarchia enforcement

| Role | Tools |
|---|---|
| **Director** | `propose_brief`, `propose_memory_update`, `read_memory` |
| **Copywriter** | `read_memory`, `submit_deliverable` |
| **Social Manager** | `read_memory`, `submit_deliverable` |
| **Paid Specialist** | `read_memory`, `submit_deliverable` |

**4 distinct tool function**, role-restricted az Agent constructorban.

#### Tool signaturák

```typescript
// Director only
propose_brief({
  title: string,
  content_md: string,
  deliverable_type: 'social_post' | 'email' | 'blog_post' | 'ad_copy',
  target_specialist: 'copywriter' | 'social-manager' | 'paid-specialist',
  platform?: 'instagram' | 'linkedin' | 'twitter' | 'threads' | 'meta' | 'google'
}) -> { brief_id }

// Director only
propose_memory_update({
  file: 'profile.md' | 'brand_voice.md' | 'ongoing_campaigns.md',
  new_content: string,           // teljes új tartalom (NEM patch)
  reason: string
}) -> { proposal_id }

// All roles
read_memory({
  file: 'profile.md' | 'brand_voice.md' | 'ongoing_campaigns.md'
}) -> { frontmatter: object, body: string }

// Specialists only (Copywriter, Social Manager, Paid Specialist)
submit_deliverable({
  content_md: string,
  structured_data?: object       // type-specifikus
}) -> { deliverable_id, revision_no }
```

### 4.3 Director orchestration mechanic (D-light)

A Director **router**, nem orchesztrátor. Egyetlen tudás-feladata: tudja melyik specialist mit csinál.

**Egyetlen brief flow:**

```
[chat] operator: "kéne egy IG poszt a reggeli rituálé témára"

  Director turn:
    1. read_memory("profile.md")
    2. read_memory("brand_voice.md")
    3. propose_brief({
         title: "Instagram poszt — reggeli rituálé",
         content_md: "...",
         deliverable_type: "social_post",
         target_specialist: "social-manager",
         platform: "instagram"
       })
    4. (chat válasz): "Készítettem egy briefet, nézd át és approve-old."

  ← Director turn vége, idle

[chat-be került kártya]

operator: → Approve

  Server (broker):
    1. brief.status = 'dispatched'
    2. delegation insert (from: director, to: social-manager)
    3. social-manager agent spawnol fresh (skill: social_post_writer.md)
    4. social-manager.prompt(brief_content + memory_context)

  social-manager turn:
    1. (gondolkodás)
    2. submit_deliverable({
         content_md: "...",
         structured_data: { platform: "instagram", text: "...", visual_brief: "..." }
       })

  ← agent eldobva, delegation.status = 'complete'
  ← deliverable.status = 'awaiting_approval'
  ← SSE → approval queue badge +1

[chat] (server-generated):
  Director: "✓ Kész. Social Manager elkészítette. [Megnyitás]"
```

**D-light: egy chat üzenetből több brief.** Ha az operátor *"kéne 2 IG poszt + 1 email a Black Friday akcióhoz"*-ot ír, a Director egy turnben több `propose_brief`-et hívhat. 3 független kártya kerül a chatbe + a queue-ra. Az operátor egyenként approve-ol. **Adatszinten 3 független brief** — nincs "campaign" összekötés v1-ben.

**Mit a Director NEM csinál:**
- ❌ NEM várja meg hogy a specialist kész legyen
- ❌ NEM kap értesítést a `deliverable_submitted` eseményről agent inputként
- ❌ NEM synthetizálja a specialist outputját — a deliverable a végső artifact
- ❌ NEM delegálhat második specialistára egy brief eredményeként
- ❌ NEM tart in-flight state-et — minden chat-message önálló turn

### 4.4 Specialist execution

```
1. broker spawn:
     new Agent({
       slug: "social-manager",
       model: gpt-5.4-mini,
       systemPrompt: skill_recipe + memory_context,
       tools: [read_memory, submit_deliverable],
       lifecycle: "transient"
     })
2. agent.prompt(brief_content_md)
3. agent loop (pi-agent-core):
     - LLM call → tool calls vagy response
     - submit_deliverable hívás → DB rekord + fájl mentés
4. agent.terminate() — eldobódik
5. delegation.status = 'complete' VAGY 'failed'
```

**Egyetlen turnben fut.** 2 perc timeout után delegation `failed`.

**Visszaküldés javításra esetén** új specialist spawn, prompt-ba:
```
ELŐZŐ VERZIÓ:
<rev_001.md tartalom>

OPERATOR FEEDBACK:
"a hook túl sales-y, tegyük személyesebbé"

Készítsd el az új verziót a feedback alapján.
```

→ specialist új revisiont submitel (`rev_002.md`).

---

## 5. Deliverable típusok + approval flow

### 5.1 4 deliverable típus

| Típus | Specialist | Variánsok | Tipikus hossz | structured_data shape |
|---|---|---|---|---|
| `social_post` | Social Manager | platform: `instagram` \| `linkedin` \| `twitter` \| `threads` | 800–3000 char | `{platform, text, visual_brief}` |
| `email` | Copywriter | variant: `newsletter` \| `promo` \| `lifecycle` (skill recipe szintű) | 200–800 szó | `{subject, preheader, body, cta}` |
| `blog_post` | Copywriter | — | 1500–2500 szó | `{title, slug, body_md, visual_brief?}` |
| `ad_copy` | Paid Specialist | platform: `meta` \| `google` \| `linkedin`, objective: `awareness` \| `conversions` \| `traffic` | 3-5 variáns | `{platform, objective, audience_brief, variants[], visual_brief}` |

### 5.2 `ad_copy` strukturált output példa

```json
{
  "type": "ad_copy",
  "platform": "meta",
  "objective": "conversions",
  "audience_brief": "30-45 év nők, GDPR-érzékeny, urban",
  "variants": [
    {
      "headline": "...",            // Meta: 40 char limit
      "primary_text": "...",        // Meta: 125 char ajánlott
      "description": "...",         // Meta: 30 char
      "cta": "Shop Now"
    },
    { ... }, { ... }
  ],
  "visual_brief": "lifestyle scene, color palette, mood"
}
```

A platform-specifikus karakterlimiteket **a skill recipe** kódolja. Ha a Paid Specialist túllépi a limitet → operator vissza tudja küldeni javításra (vagy a v2 Eval Judge automatikusan).

### 5.3 `visual_brief` field

Minden deliverable-en opcionális `visual_brief` mező — egy szöveges kép-prompt, amit Marquee maga **soha nem hív**. Releváns főleg a `social_post`, `ad_copy` és `blog_post` esetén; az `email`-en csak ritkán (promo email hero kép). Az n8n flow dolga: `fal.ai` / `ComfyUI` / emberi designer Slack-üzenet — bárhova routolhatja.

### 5.4 Approval state machine

```
       (specialist submit)
            │
            ▼
       drafting ──────► awaiting_approval ──┬──► shipped ──► archived (manuális)
                                            │
                                            ├──► visszaküld javításra
                                            │     (új revision drafting-be)
                                            │
                                            └──► eldob → archived
```

| DB érték | UI badge magyar |
|---|---|
| `drafting` | Vázlat |
| `awaiting_approval` | Jóváhagyásra vár |
| `shipped` | Lezárva |
| `archived` | Archív |

### 5.5 Akciók a deliverable detail oldalon

| Gomb | Stílus | Hatás |
|---|---|---|
| **Jóváhagy** | `button-primary` (Marquee Red) | status → `shipped`, n8n webhook fire (`deliverable_shipped`), SSE értesít |
| **Visszaküld javításra** | `button-secondary` | Modal feedback szöveg → status → `drafting` → új specialist agent + új `rev_NNN.md` → submit → új `awaiting_approval` |
| **Eldob** | `button-ghost` | status → `archived`, n8n nem értesül |

### 5.6 Revision-ök

- Minden visszaküldés inkrementálja a `revision_no`-t (1 → 2 → 3...)
- Új fájl: `<deliverable_id>/rev_001.md`, `rev_002.md`, ...
- A `current_revision_id` a legfrissebbre mutat
- Detail UI **tabokkal**: `Verzió 3 (jelenlegi)` | `Verzió 2` | `Verzió 1`
- Approve a current revisiont approve-olja
- **Nincs revision korlát**

### 5.7 Hibakezelés

| Eset | Kezelés |
|---|---|
| Specialist crash mid-turn | delegation `failed`, deliverable marad `drafting` (rev fájl nélkül). Operátor manuálisan újraindít. |
| LLM invalid tool call | pi-agent-core standard error → tool_result error → agent retry-zhat ugyanabban a turnben |
| N8n webhook timeout / down | **NEM blokkolja** a `shipped` state változást. 3x retry backoffal, utána `error` log + UI toast. |
| OAuth token refresh fail | `error` esemény + Director chat üzenet: "Auth lejárt, futtasd újra `npm run auth:openai`-t" |
| 2 perc timeout specialist turn-ön | delegation `failed` |

---

## 6. Memory architektúra + onboarding

### 6.1 Memory fájl inventár (3 fájl)

| Fájl | Tartalom | Frontmatter |
|---|---|---|
| `profile.md` | Ügyfél identitás | `business_description`, `target_audience`, `usp`, `competitors` |
| `brand_voice.md` | Tone, hangzás, referencia | `tone`, `adjectives`, `reference_brands`, `do`, `dont` |
| `ongoing_campaigns.md` | Aktív kampányok | `campaigns: [{name, goal, started, status}]` |

`content_history.md` **nincs** MVP-ben — ha "ne ismételjük magunkat" probléma lesz, v2.

### 6.2 Két write path

```
                    ~/.marquee/memory/clients/default/
                                ▲                ▲
                                │                │
                  atomic write  │                │  atomic write
                                │                │
            User direct (UI)    │                │  Agent proposal queue
            PUT /api/memory/    │                │
              clients/:slug/    │                │  Director hívja
              :file             │                │  propose_memory_update
                                │                │
            → frontmatter       │                │  → memory_proposals row
              validáció         │                │    (pending)
            → file write        │                │  → SSE event
            → memory_audit row  │                │
              (source: 'user')  │                │  Operator approve
                                │                │  → POST /api/memory/
                                │                │    proposals/:id/approve
                                │                │  → file write
                                │                │  → memory_audit row
                                │                │    (source: 'agent:director')
                                │                │  → memory_proposals row
                                │                │    status: 'approved'
```

### 6.3 Atomic write pseudokód

```typescript
async function writeMemoryFile(clientSlug, file, newContent, source) {
  const targetPath = `${DATA_DIR}/memory/clients/${clientSlug}/${file}`;
  const tempPath = `${targetPath}.tmp.${randomSuffix()}`;
  
  validateFrontmatter(file, parseFrontmatter(newContent));   // hardcoded séma
  const prevHash = await maybeHash(targetPath);
  
  await fs.writeFile(tempPath, newContent, { mode: 0o600 });
  await fs.rename(tempPath, targetPath);                      // atomic
  
  await db.insert(memoryAudit).values({ ... });
  broker.emit('memory_edited', { client_slug: clientSlug, file, source });
}
```

### 6.4 Memory injektálás az agent contextbe

Minden agent indulásakor a `transformContext` injektálja a relevánsmemóriát a system promptba:

```typescript
async transformContext(messages: AgentMessage[]): Promise<AgentMessage[]> {
  const memoryBlock = await loadMemoryForRole(role, clientSlug);
  return [memoryBlock, ...messages];
}
```

| Role | Mit lát |
|---|---|
| Director | mind a 3 fájl |
| Copywriter | profile + brand_voice |
| Social Manager | profile + brand_voice |
| Paid Specialist | profile + brand_voice |

A `read_memory` tool ezenfelül elérhető — ha az agent mélyebb infót akar, hívhat manuálisan.

### 6.5 Skill recipe template (mustache-szerű interpoláció)

```markdown
# blog_post_writer.md
A te feladatod {{memory.profile.business_description}} ügyfelének blog posztot írni.

Hangzás: {{memory.brand_voice.tone}}, jellemzők: {{memory.brand_voice.adjectives}}.
Ne tegyél: {{memory.brand_voice.dont}}.

A kimenet **magyar nyelvű**.
```

Egyszerű string replace render az agent indulásakor.

### 6.6 Onboarding flow

#### Empty state detektor

`GET /api/memory/clients/default/profile.md` → ha 404 vagy üres frontmatter → empty state banner a Műhely nézeten:

```
┌──────────────────────────────────────────────────────────────────┐
│  Üdv a Marquee-ban.                                                │
│                                                                    │
│  Kezdjük az ügyfeled brand profiljának felépítésével.              │
│  Beszélj a Directorral, ő végigvezet 6 kérdésen.                   │
│                                                                    │
│  Próbáld: "Segíts beállítani az ügyfél profilját"                  │
│                                                                    │
│  [Beszélgetés indítása]                                             │
└──────────────────────────────────────────────────────────────────┘
```

A "Beszélgetés indítása" gomb prefilled inputtal nyitja a chat composert.

#### Director system prompt + onboarding skill

A Director system promptjában minden elérhető skill listázva (`when_to_use` mezővel). Ha az operátor azt írja "Segíts beállítani az ügyfél profilját", a Director felismeri és aktiválja a `client_profile_setup` skillt → 6 kérdésen végigvezet, 6 `propose_memory_update` proposalt ad le.

#### `client_profile_setup` skill recipe vázlat

```markdown
---
name: client_profile_setup
when_to_use: az operátor új ügyfél brand profilját akarja felépíteni vagy frissíteni
---

Az operátorral végigmész egy 6-kérdéses interjún. Egy kérdést tegyél fel egyszerre,
várd meg a választ, majd a végén (vagy közben) hívj propose_memory_update-et.
Magyar nyelven kommunikálsz.

A kérdések:

1. Mit csinál az ügyfél? (1-2 mondatban)
   → profile.md `business_description`

2. Kik a célcsoport? (demográfia, érdeklődés, fájdalompontok)
   → profile.md `target_audience`

3. Mi az USP? Miért választják az ügyfél versenytársak helyett?
   → profile.md `usp`

4. Ki a 2-3 fő versenytárs?
   → profile.md `competitors`

5. Milyen a brand voice? (formal/casual, 3-5 jellemző, 1-2 referencia brand)
   → brand_voice.md (teljes tartalom)

6. Mi az aktuális marketing célkitűzés?
   → ongoing_campaigns.md (első kampány)

Az interjú végén foglald össze: "Felépítettem a brand profilját. Approve-old a queue-n.
Mivel kezdjünk?"
```

**Ismételhető**: ha a brand fejlődik, ugyanaz a skill újraindítható; a Director hivatkozza a meglévő tartalmat.

---

## 7. Frontend

### 7.1 Top nav (3 item, sidebar nincs)

```
┌─────────────────────────────────────────────────────────────┐
│ MARQUEE     [Műhely]  [Jóváhagyás (3)]  [Memória]           │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Műhely nézet (Home, default landing)

- Egyetlen aktív chat thread a Directorral
- Empty state banner ha a memória üres
- Inline kártyák: brief proposal + memory proposal jelzés
- Live state: bulb indicator + szöveg ("Social Manager dolgozik...")
- ChatComposer alul

### 7.3 Jóváhagyás nézet (deliverable lista + szűrő)

- Felül: szűrő dropdown — default "Jóváhagyásra vár"
  - Opciók: Mind / Vázlat / Jóváhagyásra vár / Lezárva / Archív
- Lista sor: cím, type badge, status badge, utolsó frissítés, "Megnyitás"
- Kattintás → Deliverable Detail
- Nav badge: `Jóváhagyás (N)` — a `awaiting_approval`-ok száma

### 7.4 Deliverable Detail (sub-page)

- Felül: cím, type, status badge, current revision number
- **Tabok revisionönként**: `Verzió 3 (jelenlegi)` | `Verzió 2` | `Verzió 1`
- Body: markdown render
- Oldalpanel: structured_data (visual_brief, ad_copy variánsok)
- Alul (csak `awaiting_approval`): `Jóváhagy` / `Visszaküld javításra` / `Eldob`
- `shipped`/`archived`: `approvals` history

### 7.5 Memória nézet

- Bal: 3 memory fájl listája
- Jobb felül: pending agent proposal-ok (side-by-side old/new, Jóváhagy/Elutasít)
- Jobb alul: kiválasztott fájl textarea editora + Mentés gomb
- "Audit log megtekintése" → modal: `memory_audit` rekordok az adott fájlra

---

## 8. Integrációk

### 8.1 N8n outbound webhook

- **Env**: `N8N_WEBHOOK_URL` (opcionális)
- **Trigger**: csak `deliverable_shipped` esemény
- **Payload**:

```json
{
  "event": "deliverable_shipped",
  "deliverable_id": "del_abc123",
  "deliverable_type": "social_post",
  "client_slug": "default",
  "platform": "instagram",
  "current_revision": 3,
  "artifact_path": "/home/balazs/.marquee/artifacts/clients/default/del_abc123/rev_003.md",
  "content_md": "...",
  "structured_data": { ... },
  "shipped_at": 1735689600,
  "approved_by": "human"
}
```

- **Retry**: 3x backoff (1s, 5s, 30s); azután abandon + `error` esemény
- **Non-blocking**: webhook hiba NEM rollback-eli a `shipped`-et
- **Ha env üres**: outbound disabled

### 8.2 N8n inbound REST API

- **Védelem**: `MARQUEE_API_TOKEN` env var. Ha set → minden POST igényli `Authorization: Bearer <token>`. Ha üres → endpointok LAN-only nyitva.
- **Endpointok**:
  - `POST /api/briefs` — programatikus brief létrehozás
  - `POST /api/messages` — chat üzenet beküldése
- GET endpointok mindig nyitva

### 8.3 Provider config (openai-subscription)

- **Mód**: hardcoded `openai-subscription` (nincs `MARQUEE_PROVIDER_MODE` env var)
- **Modell mapping** kódban:
  - Director → `gpt-5.4`
  - Copywriter → `gpt-5.4`
  - Social Manager → `gpt-5.4-mini`
  - Paid Specialist → `gpt-5.4-mini`
- **OAuth**: `~/.marquee/auth.json`, `chmod 600`, gitignored
- **Első setup**:
  ```bash
  cd /opt/marquee && npm run auth:openai
  # böngésző nyílik, ChatGPT login, tokenek elmentve
  ```
- **Token refresh**: automatikus a `pi-ai`-n belül (`refreshOpenAICodexToken`)
- **Auth fail**: `error` esemény + Director chat üzenet: "ChatGPT auth lejárt, futtasd újra `npm run auth:openai`-t."

---

## 9. Magyar nyelv konvenció

| Réteg | Nyelv |
|---|---|
| UI labelek, gombok, status badge-ek, empty state, error toast | **magyar** |
| Skill recipe-k (agent instrukciók) | **magyar** |
| Agent system promptok | **magyar** |
| Tool descriptionök (LLM látja) | **magyar** |
| Director chat válaszok | **magyar** |
| Deliverable output (blog, email, social, ad copy szövege) | **magyar** |
| **Kivétel**: kód identifier, DB column név, type név, log message, code comment | angol |

A skill recipe-k explicit instruálják a magyar kimenetet — nincs `output_language` config, nincs nyelv-kapcsoló.

---

## 10. Deploy

### 10.1 `scripts/deploy.sh` (egyetlen deploy útvonal MVP-ben)

```bash
#!/usr/bin/env bash
set -euo pipefail

REMOTE="balazs@192.168.2.60"
TARGET="/opt/marquee"

npm run build
rsync -avz --delete --exclude node_modules --exclude .git \
  ./ "${REMOTE}:${TARGET}/"
ssh "${REMOTE}" "cd ${TARGET} && npm install --omit=dev && sudo systemctl restart marquee"
```

### 10.2 systemd unit (`/etc/systemd/system/marquee.service`)

```ini
[Unit]
Description=Marquee orchestration UI
After=network.target

[Service]
Type=simple
User=balazs
WorkingDirectory=/opt/marquee
EnvironmentFile=/opt/marquee/.env
ExecStart=/usr/bin/node /opt/marquee/packages/server/dist/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 10.3 Production .env

```bash
PORT=7892
DATA_DIR=/home/balazs/.marquee
WEB_ROOT=/opt/marquee/packages/web/dist
N8N_WEBHOOK_URL=                       # opcionális
MARQUEE_API_TOKEN=                     # opcionális
NODE_ENV=production
```

### 10.4 Első MVP deploy menete

```bash
# 1. VM-en backup
ssh balazs@192.168.2.60 'mv ~/.marquee ~/.marquee.v0.2-archive'
ssh balazs@192.168.2.60 'sudo systemctl stop marquee'

# 2. Workstationről deploy
cd ~/Projects/Homelab/marquee/.worktrees/mvp-redesign
bash scripts/deploy.sh

# 3. VM-en első OAuth setup
ssh balazs@192.168.2.60 'cd /opt/marquee && npm run auth:openai'

# 4. VM-en service start
ssh balazs@192.168.2.60 'sudo systemctl start marquee'

# 5. Verify
curl http://192.168.2.60:7892/api/health
# vagy: nyisd meg http://marquee.lab2.home.arpa
```

### 10.5 Logging

- Egyetlen log forrás: `journalctl -u marquee -f`
- Application audit log: `events` tábla
- Beszel agent változatlan

---

## 11. Strip-and-refactor terv (átállás a meglévő kódból)

### 11.1 Branch stratégia

```bash
cd ~/Projects/Homelab/marquee
git tag v0.2-final master                                  # current state pin
git worktree add .worktrees/mvp-redesign -b mvp-redesign master
cd .worktrees/mvp-redesign
# itt zajlik az MVP munka
```

A `master` branch fagyasztva amíg az MVP nem kész. Production a `master`-t futtatja a VM 260-on (változatlanul). Az új munka csak a `mvp-redesign` worktree-ben zajlik.

### 11.2 Mit tartunk meg a meglévő kódból

| Komponens | Indok |
|---|---|
| Node 22 + TS + Fastify + SQLite + Drizzle stack | Helyes választás, működik |
| `@mariozechner/pi-agent-core` v0.70.2 + `pi-ai` integráció | Stabil, openai-codex provider már be van kötve |
| SSE event stream + Fastify route foundation | Működik |
| DB séma alapok (briefs, deliverables, messages, delegations, events, agent_sessions, turns) | Pontosan a szükséges entitások |
| SQLite WAL + Drizzle migrációk infrastruktúrája | OK |
| `scripts/deploy.sh` + systemd unit | Production-ready, csak finomítás |
| Marquee Design System (DESIGN.md) | Lockolva, OK |
| React + Vite + Tailwind + Zustand frontend skeleton | Stack OK; views egyszerűsödnek |
| `providers/index.ts` + `auth.ts` (openai-codex OAuth flow) | Pont ezt használjuk |
| n8n outbound webhook + `MARQUEE_API_TOKEN` inbound auth | Ezt megtartjuk és kiterjesztjük |

### 11.3 Mit törlünk az egyetlen "scorched earth" commit-tal

```
packages/server/src/broker/orchestrator.ts                     # BriefOrchestrator
packages/server/src/workflows/                                 # workflow defs + registry
packages/server/drizzle/0004_workflow_runs.sql                 # migration
packages/server/src/agents/<lead-tier role definíciók>         # distribution-lead, insights-lead, social-manager (átnevezésre kerül), seo-analyst
packages/server/src/agents/eval-judge.ts                        # Eval Judge
packages/server/src/tools/delegation.ts                        # delegate_to_lead + delegate_to_specialist (1 új tool váltja)
packages/server/src/<custom AgentMessage típusok>              # DelegationRequestMessage, BriefProposalMessage, EvalReportMessage, ApprovalDecisionMessage stb.
db/schema: evals tábla, workflow_runs tábla                    # törölni
packages/web/<Pipeline kanban view + drag-drop komponensek>    # YAGNI
packages/web/<Live Agent Feed widget>                          # debug, nem core
packages/web/<dashboard 6-widget grid>                         # 3 view váltja
packages/web/<full-screen onboarding mode komponensek>         # banner + chat váltja
packages/server/src/server/<eval endpointok>                   # GET /api/deliverables/:id/eval
```

### 11.4 Átalakítás (delete + rebuild)

| Modul | Változás |
|---|---|
| Tool registry | `delegate_to_lead` + `delegate_to_specialist` → 1 darab `propose_brief` (Director) + 1 darab `submit_deliverable` (specialists) |
| Agent factory | 8 role → 4 role (Director + Copywriter + Social Manager + Paid Specialist) |
| DB schema | minden táblába felvesszük a `client_slug` FK-t (multi-client séma alvó) |
| Memory layer | git-backed → plain MD + `memory_audit` + `memory_proposals` |
| Frontend nav | sidebar → top nav 3 itemmel |
| Deliverable detail | tabok revisionönként + új visszaküldés-modal |

### 11.5 Production DB reset

A jelenlegi VM-en lévő `~/.marquee/state.db` régi sémával — a `mvp-redesign` deploy első lépésekor:

```bash
ssh balazs@192.168.2.60 'mv ~/.marquee ~/.marquee.v0.2-archive'
```

A régi DB elérhető marad archívként (DB Browserrel megnyitható), de a fresh deploy üres `~/.marquee/`-ba kezd.

---

## 12. MVP acceptance kritériumok

```
[ ] Marquee fut a VM 260-on (deploy.sh-sel deployolva, mvp-redesign branchről)
[ ] OAuth setup egyszer lefutott, tokenek refresh-elődnek automatikusan
[ ] Onboarding skill: legalább a profile.md és brand_voice.md Director-segítségével feltöltve
[ ] 4 deliverable típus mindegyikéből legalább 1 darab kiment shipped státuszba
[ ] Egy deliverable legalább 2 revision-t megélt (visszaküldés javításra működik)
[ ] N8n outbound webhook fire-ol shipped eseményre — egy n8n flow logolja a payloadot
[ ] N8n inbound endpoint (POST /api/briefs) bearer tokennel hív, brief létrejön
[ ] Memory inline editor működik (felhasználói write path)
[ ] Memory proposal queue működik (agent write path) — Director onboarding közben legalább 2 proposal-t generál
[ ] Marquee 7 napig folyamatosan fut, systemctl status zöld
[ ] Te legalább 1 hétig használtad saját marketing-tartalmaidra, és minimum 5 deliverable approve-olt lett
[ ] Chat magyar nyelvű, deliverable-ek magyar nyelvűek, UI labelek magyar nyelvűek
```

12 pont. Ha mind ✅ → MVP done. Akkor a `mvp-redesign` branch lesz az új `master`, a `v0.2-final` tag az archív.

---

## 13. Mi mehet v2-be (deferred backlog)

Ezeket szándékosan tolajuk v2-be, hogy az MVP fókuszban maradjon. A sorrend nem fix prioritás, csak emlékeztető:

- **Agent bővítés**: SEO researcher, Repurposer, Strategist, Eval Judge advisory módban
- **Deliverable bővítés**: `landing_page`, `twitter_thread`, `case_study`, `seo_brief`
- **Multi-client UX**: client switcher top nav-ban, per-client onboarding flow, client-szintű skill override
- **Campaign concept**: több brief összekötése egy "campaign" entitásként
- **Cron rutinok**: morning_brief, weekly_report, brand_evolution
- **Brand voice RAG**: embedding + similarity search a referencia tartalmak között
- **Memory history**: `memory_versions` tábla teljes content snapshot-tal (rollback)
- **Auto-ship mód**: opcionális env vagy per-deliverable-type toggle
- **Eval Judge advisory** (non-blocking score)
- **Diff view revisionök között** (side-by-side vagy unified)
- **Bulk approve** a queue-n
- **Settings UI panel** (env config, modell-mapping override)
- **Ansible playbook** Marquee role + idegen host fresh deploy
- **Stack-szintű Ansible playbook** (Marquee + n8n + Mautic + Matomo + Metabase + RustFS + ComfyUI együtt)
- **Backup automation**: filesystem-szintű cron `~/.marquee/` → RustFS-be
- **Provider mode dual** (openai-subscription mellett openrouter / opencode-go fallback)
- **OAuth device flow** Ansible-headless deployhoz
- **Playwright E2E**

---

## 14. Open questions (a brainstormnál nem zártuk le, de implementáció közben tisztázandó)

- **Specialist queueing**: ha 3 független `propose_brief` egyszerre fut a Director-tól, és mindet approve-olod gyorsan egymás után, **párhuzamosan** futnak a specialisták (ChatGPT subscription rate limittől függ), vagy a broker **sorba állítja** őket? Default: párhuzamos, ha rate limit ütközik, pi-agent-core retry-zik. Implementáció közben observe-olni.
- **`brief_intake` skill recipe részletesség**: a Director hogyan dönti el mikor van "elég" infó a `propose_brief` hívására (nem ír-e túl kevés / túl sok kérdést chat-ben)? Iterálni kell az MVP használat alatt.
- **Frontmatter validáció kinek a felelőssége**: server (REST endpoint) ÉS agent (`propose_memory_update` tool) is validál — duplikáció, de védelem két oldalról. Akkor zárjuk le, ha látjuk hogy kis kód.
- **Specialist modell-fallback**: ha a `gpt-5.4-mini` túl gyenge a Paid Specialistnak (multi-variáns ad copy nehéz), átállítható-e `gpt-5.4`-re env var **nélkül**, csak kód-edittel? Default: igen, kódban módosítjuk.
