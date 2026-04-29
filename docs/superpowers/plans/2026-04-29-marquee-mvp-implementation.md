# Marquee MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Marquee `mvp-redesign` branchen egy strip-and-refactor + zöldmezős newbuild kombinációval előállítani egy egyszerűsített, magyar nyelvű, single-tenant AI marketing orchestration UI-t a [`2026-04-29-marquee-mvp-redesign-design.md`](../specs/2026-04-29-marquee-mvp-redesign-design.md) spec szerint.

**Architecture:** Egy Node folyamat (Fastify + SSE + pi-agent-core in-process) + React SPA. 4 agent role (Director warm + Copywriter / Social Manager / Paid Specialist transient), 4 deliverable típus, plain markdown memory + DB audit, openai-subscription provider OAuth-tal, n8n bidirectional integráció.

**Tech Stack:** Node 22 LTS, TypeScript, Fastify 5, better-sqlite3 + Drizzle ORM, pi-agent-core 0.70.2 + pi-ai 0.70.2 (openai-codex provider), React 19 + Vite + Tailwind 3 + Zustand, vitest, gray-matter (YAML frontmatter).

---

## File Structure

### Backend modulok (`packages/server/src/`)

| Mappa / fájl | Művelet | Felelősség |
|---|---|---|
| `index.ts` | módosítás | server entrypoint, single Node process |
| `db/schema.ts` | rewrite | 13 tábla (clients, briefs, deliverables, ...) |
| `db/queries.ts` | rewrite | typed queries az új sémához |
| `db/index.ts` | tartani | better-sqlite3 + Drizzle wrapper |
| `drizzle/0001_init.sql` | új | egyetlen init migration az új sémához |
| `drizzle/000{0..4}_*.sql` | törlés | régi migrációk (fresh DB) |
| `providers/index.ts` | rewrite | csak `openai-subscription`, modell mapping 4 role-ra |
| `providers/auth.ts` | tartani | OAuth credentials kezelés |
| `memory/read.ts` | rewrite | client-scoped path, frontmatter parse |
| `memory/write.ts` | rewrite | atomic temp+rename + audit log |
| `memory/proposals.ts` | új | proposal queue CRUD |
| `memory/validate.ts` | új | per-fájl frontmatter schema |
| `memory/template.ts` | tartani | mustache-szerű render |
| `memory/git.ts` | törlés | nincs git-backed memory |
| `memory/seed.ts` | rewrite | seed-memory copy first run |
| `skills/loader.ts` | módosítás | role-szintű skill recipe loader |
| `tools/registry.ts` | rewrite | role → tool array mapping |
| `tools/types.ts` | módosítás | csak az MVP tool típusok |
| `tools/propose-brief.ts` | új | Director tool |
| `tools/propose-memory-update.ts` | új | Director tool |
| `tools/read-memory.ts` | új | shared tool |
| `tools/submit-deliverable.ts` | új | specialist tool |
| `tools/{delegation, integration, matomo, misc, onboarding, serpapi, skills, tasks, tavily, deliverables, proposals}.ts` | törlés | régi tool-ok |
| `agents/config.ts` | rewrite | 4 role config (slug, model, lifecycle, tools) |
| `agents/factory.ts` | rewrite | warm Director + transient specialist spawn |
| `agents/messages.ts` | rewrite | egyszerűsített AgentMessage típusok |
| `agents/convert-to-llm.ts` | módosítás | a megmaradt típusokra |
| `agents/transform-context.ts` | módosítás | memory injektálás role-szintű |
| `agents/seed.ts` | rewrite | clients tábla seed (default client) |
| `broker/event-bus.ts` | módosítás | event emit + DB persist |
| `broker/router.ts` | rewrite | brief dispatch + specialist spawn |
| `broker/orchestrator.ts` | törlés | BriefOrchestrator |
| `broker/eval-trigger.ts` | törlés | Eval Judge nincs |
| `broker/recovery.ts` | módosítás | csak in-flight delegation rehidratálás |
| `webhooks/n8n-outbound.ts` | új | shipped event → n8n POST |
| `server/index.ts` | módosítás | Fastify entrypoint, route mount |
| `server/sse.ts` | módosítás | SSE endpoint |
| `server/auth-middleware.ts` | új | bearer token guard |
| `server/routes/briefs.ts` | rewrite | POST/GET briefs + dispatch |
| `server/routes/deliverables.ts` | rewrite | GET + approve/return/discard |
| `server/routes/memory.ts` | rewrite | GET/PUT files + proposal endpoints |
| `server/routes/messages.ts` | módosítás | POST/GET chat messages |
| `server/routes/threads.ts` | módosítás | thread CRUD |
| `server/routes/{agents, approvals, campaigns, dashboard, inputs, skills, stats, tasks}.ts` | törlés | szükségtelen route-ok |
| `cron/` | törlés (egész mappa) | cron rutinok v3 |
| `tasks/` | törlés (egész mappa) | task manager v3 |
| `workflows/` | törlés (egész mappa) | BriefOrchestrator workflows |
| `telemetry/index.ts` | tartani | turn token/latency aggregátor |
| `scripts/login-openai.ts` | tartani / verify | OAuth CLI |
| `scripts/smoke.ts` | rewrite | end-to-end smoke az új flow-ra |

### Frontend modulok (`packages/web/src/`)

| Mappa / fájl | Művelet | Felelősség |
|---|---|---|
| `App.tsx` | rewrite | router + top nav layout (sidebar nélkül) |
| `main.tsx` | tartani | Vite entry |
| `views/Workshop.tsx` | új (volt `home.tsx`) | chat-first nézet + empty state |
| `views/Approvals.tsx` | új | szűrhető deliverable lista |
| `views/DeliverableDetail.tsx` | új (volt `deliverable.tsx`) | revision tabok + akciók |
| `views/Memory.tsx` | rewrite | fájl lista + editor + proposal queue |
| `views/{agents, calendar, campaigns, chat-full, home, onboarding, pipeline, skills, tasks}.tsx` | törlés | régi nézetek |
| `components/TopNav.tsx` | új | 3 itemes top nav + badge |
| `components/ChatThread.tsx` | új (volt `chat/MessageList.tsx`) | üzenet lista |
| `components/ChatComposer.tsx` | új (volt `chat/ChatInput.tsx`) | composer |
| `components/BriefProposalCard.tsx` | új | inline kártya brief proposal-hez |
| `components/MemoryProposalCard.tsx` | új | memory proposal kártya |
| `components/DeliverableRow.tsx` | új | listaelem Approvals-en |
| `components/DeliverableActions.tsx` | új | 3 gomb a Detail-en |
| `components/StatusBadge.tsx` | új (átalakít `Badge.tsx`) | 4 státusz |
| `components/TypeBadge.tsx` | új | deliverable type chip |
| `components/BulbIndicator.tsx` | új (átalakít `Bulb.tsx`) | active agent jelzés |
| `components/EmptyState.tsx` | új | empty state banner |
| `components/MemoryFileList.tsx` | új | bal oldal a Memóriában |
| `components/MemoryEditor.tsx` | új | textarea + save |
| `components/RevisionTabs.tsx` | új | revisions a deliverable detail-en |
| `components/SendBackModal.tsx` | új | feedback input modal |
| `components/{chat/ChatDrawer, layout/Sidebar, ui/{AgentBadge, Avatar}}.tsx` | törlés | drawer + sidebar nem kell |
| `components/ui/button.tsx` | tartani | base button |
| `components/ui/{Badge, Bulb, index}.ts(x)` | refactor | StatusBadge / BulbIndicator-rá átdolgozva |
| `store/useMarqueeStore.ts` | új (rename `useAgencyStore.ts`) | Zustand state |
| `lib/api.ts` | módosítás | új REST endpointokra |
| `lib/sse.ts` | módosítás | új SSE event típusok |
| `lib/utils.ts` | tartani | helpers |
| `lib/design.ts` | új | DESIGN.md token helperek |

### Seed content (`packages/server/seed/`)

| Fájl | Művelet | Felelősség |
|---|---|---|
| `seed/skills/director/client_profile_setup.md` | új | onboarding 6-kérdés |
| `seed/skills/director/brief_intake.md` | új | brief draftolás |
| `seed/skills/director/delegate.md` | új | mikor melyik specialist |
| `seed/skills/copywriter/blog_post_writer.md` | új | blog poszt |
| `seed/skills/copywriter/email_writer.md` | új | email |
| `seed/skills/social-manager/social_post_writer.md` | új | platform-aware |
| `seed/skills/paid-specialist/meta_ad_copy.md` | új | Meta limit-aware |
| `seed/skills/paid-specialist/google_ad_copy.md` | új | Google Ads |
| `seed/memory/profile.md` | új | sablon |
| `seed/memory/brand_voice.md` | új | sablon |
| `seed/memory/ongoing_campaigns.md` | új | sablon |

### Egyéb

| Fájl | Művelet |
|---|---|
| `scripts/deploy.sh` | tartani / kis verify |
| `scripts/install-on-vm.sh` | törlés (régi WUPHF maradvány) |
| `infra/marquee.service` | tartani / verify |
| `packages/server/package.json` | módosítás (deps trim: `node-cron`, `simple-git` ki) |
| `package.json` | módosítás (root scripts) |

---

## Phase 0 — Worktree setup + scorched-earth strip

### Task 1: Tag current state and create mvp-redesign worktree

**Files:**
- N/A (git operations only)

- [ ] **Step 1: Tag current master HEAD as v0.2-final**

```bash
cd ~/Projects/Homelab/marquee
git tag v0.2-final master
git tag --list | grep v0.2-final
```

Expected: `v0.2-final` listed.

- [ ] **Step 2: Create new worktree on mvp-redesign branch**

```bash
git worktree add .worktrees/mvp-redesign -b mvp-redesign master
git worktree list
```

Expected: two worktrees listed, `.worktrees/mvp-redesign` mapped to `mvp-redesign` branch.

- [ ] **Step 3: Switch into the new worktree (all subsequent work happens here)**

```bash
cd ~/Projects/Homelab/marquee/.worktrees/mvp-redesign
pwd
git branch --show-current
```

Expected: pwd ends in `.worktrees/mvp-redesign`, branch is `mvp-redesign`.

- [ ] **Step 4: Verify the spec and plan are present in the new worktree**

```bash
ls docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md
ls docs/superpowers/plans/2026-04-29-marquee-mvp-implementation.md
```

Expected: both files exist (inherited from master).

- [ ] **Step 5: No commit needed (no file changes yet)**

---

### Task 2: Scorched-earth strip commit

**Files:**
- Delete (server): `packages/server/src/broker/{orchestrator,orchestrator.test,eval-trigger,eval-trigger.test,router.budget.test}.ts`, `packages/server/src/cron/`, `packages/server/src/tasks/`, `packages/server/src/workflows/`, `packages/server/src/memory/{git,seed,seed.test}.ts`, `packages/server/src/server/routes/{agents,approvals,campaigns,campaigns.test,dashboard,inputs,skills,stats,stats.test,tasks,tasks.test}.ts`, `packages/server/src/tools/{delegation,delegation.test,integration,integration.test,matomo,matomo.test,misc,misc.test,onboarding,serpapi,serpapi.test,skills,skills.test,tasks,tasks.test,tavily}.ts`
- Delete (web): `packages/web/src/views/{agents,calendar,campaigns,chat-full,home,onboarding,pipeline,skills,tasks}.tsx`, `packages/web/src/components/{chat/ChatDrawer.tsx,layout/Sidebar.tsx,ui/AgentBadge.tsx,ui/Avatar.tsx}`
- Delete (drizzle): `packages/server/drizzle/000{0,1,2,3,4}_*.sql` (all old migrations — fresh `0001_init` will be created in Task 5)
- Delete (scripts): `scripts/install-on-vm.sh`

- [ ] **Step 1: Delete server backend stripped files**

```bash
cd ~/Projects/Homelab/marquee/.worktrees/mvp-redesign

# Broker (orchestrator + eval trigger)
rm -f packages/server/src/broker/orchestrator.ts
rm -f packages/server/src/broker/orchestrator.test.ts
rm -f packages/server/src/broker/eval-trigger.ts
rm -f packages/server/src/broker/eval-trigger.test.ts
rm -f packages/server/src/broker/router.budget.test.ts

# Mappák egészben
rm -rf packages/server/src/cron
rm -rf packages/server/src/tasks
rm -rf packages/server/src/workflows

# Memory stripped
rm -f packages/server/src/memory/git.ts
rm -f packages/server/src/memory/seed.ts
rm -f packages/server/src/memory/seed.test.ts

# Felesleges route-ok
rm -f packages/server/src/server/routes/agents.ts
rm -f packages/server/src/server/routes/approvals.ts
rm -f packages/server/src/server/routes/campaigns.ts
rm -f packages/server/src/server/routes/campaigns.test.ts
rm -f packages/server/src/server/routes/dashboard.ts
rm -f packages/server/src/server/routes/inputs.ts
rm -f packages/server/src/server/routes/skills.ts
rm -f packages/server/src/server/routes/stats.ts
rm -f packages/server/src/server/routes/stats.test.ts
rm -f packages/server/src/server/routes/tasks.ts
rm -f packages/server/src/server/routes/tasks.test.ts

# Felesleges tool-ok
rm -f packages/server/src/tools/delegation.ts
rm -f packages/server/src/tools/delegation.test.ts
rm -f packages/server/src/tools/integration.ts
rm -f packages/server/src/tools/integration.test.ts
rm -f packages/server/src/tools/matomo.ts
rm -f packages/server/src/tools/matomo.test.ts
rm -f packages/server/src/tools/misc.ts
rm -f packages/server/src/tools/misc.test.ts
rm -f packages/server/src/tools/onboarding.ts
rm -f packages/server/src/tools/serpapi.ts
rm -f packages/server/src/tools/serpapi.test.ts
rm -f packages/server/src/tools/skills.ts
rm -f packages/server/src/tools/skills.test.ts
rm -f packages/server/src/tools/tasks.ts
rm -f packages/server/src/tools/tasks.test.ts
rm -f packages/server/src/tools/tavily.ts
```

- [ ] **Step 2: Delete frontend stripped files**

```bash
# Régi nézetek
rm -f packages/web/src/views/agents.tsx
rm -f packages/web/src/views/calendar.tsx
rm -f packages/web/src/views/campaigns.tsx
rm -f packages/web/src/views/chat-full.tsx
rm -f packages/web/src/views/home.tsx
rm -f packages/web/src/views/onboarding.tsx
rm -f packages/web/src/views/pipeline.tsx
rm -f packages/web/src/views/skills.tsx
rm -f packages/web/src/views/tasks.tsx

# Régi komponensek
rm -f packages/web/src/components/chat/ChatDrawer.tsx
rm -f packages/web/src/components/layout/Sidebar.tsx
rm -f packages/web/src/components/ui/AgentBadge.tsx
rm -f packages/web/src/components/ui/Avatar.tsx
```

- [ ] **Step 3: Delete old Drizzle migrations**

```bash
rm -f packages/server/drizzle/0000_init.sql
rm -f packages/server/drizzle/0001_skinny_thunderbird.sql
rm -f packages/server/drizzle/0002_late_nico_minoru.sql
rm -f packages/server/drizzle/0003_campaigns.sql
rm -f packages/server/drizzle/0004_workflow_runs.sql
rm -rf packages/server/drizzle/meta
```

- [ ] **Step 4: Delete obsolete root scripts**

```bash
rm -f scripts/install-on-vm.sh
```

- [ ] **Step 5: Verify what remains**

```bash
find packages/server/src -type f -name "*.ts" | sort
find packages/web/src -type f \( -name "*.ts" -o -name "*.tsx" \) | sort
ls packages/server/drizzle/ 2>/dev/null
```

Expected: only the "kept" or "rewrite" files from the File Structure table remain. All deleted files gone.

- [ ] **Step 6: Commit the strip**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: scorched-earth strip for MVP redesign

Delete BriefOrchestrator + workflow_runs, Eval Judge + cron rutinok,
lead-tier agents, git memory, all unused tools (matomo/serpapi/tavily/
delegation/skills/tasks/onboarding/integration/misc), unused routes
(campaigns/dashboard/agents/approvals/inputs/skills/stats/tasks),
unused frontend views (pipeline/calendar/onboarding/etc), drawer +
sidebar components.

All Drizzle migrations removed; fresh 0001_init coming next.

Refs: docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md (section 11)
EOF
)"
```

---

## Phase 1 — Foundation cleanup

### Task 3: Trim package.json dependencies

**Files:**
- Modify: `packages/server/package.json` (remove `node-cron`, `simple-git`, their @types)
- Modify: `package.json` (root, ensure only essential deps)

- [ ] **Step 1: Remove unused server deps**

Edit `packages/server/package.json`:
- Remove from `dependencies`: `"node-cron": "^4.2.1"`, `"simple-git": "^3.27.0"`
- Remove from `devDependencies`: `"@types/node-cron": "^3.0.11"`

- [ ] **Step 2: Reinstall**

```bash
cd ~/Projects/Homelab/marquee/.worktrees/mvp-redesign
rm -rf node_modules packages/*/node_modules package-lock.json
npm install
```

Expected: clean install, no errors.

- [ ] **Step 3: Verify nothing broken yet**

```bash
npm run check 2>&1 | head -50
```

Expected: many errors (we just deleted half the codebase) — that's fine, will be fixed in subsequent tasks. Save the error list mentally.

- [ ] **Step 4: Commit**

```bash
git add packages/server/package.json package.json package-lock.json
git commit -m "chore: trim deps (node-cron, simple-git removed for MVP)"
```

---

### Task 4: Rewrite providers/index.ts to openai-subscription only

**Files:**
- Modify: `packages/server/src/providers/index.ts`
- Modify: `packages/server/src/providers/index.test.ts`

- [ ] **Step 1: Rewrite the test file with new behavior expectations**

Replace `packages/server/src/providers/index.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { modelForRole } from './index.js';

describe('modelForRole', () => {
  it('returns gpt-5.4 for director', () => {
    const m = modelForRole('director');
    expect(m.provider).toBe('openai-codex');
    expect(m.id).toBe('gpt-5.4');
  });

  it('returns gpt-5.4 for copywriter', () => {
    const m = modelForRole('copywriter');
    expect(m.id).toBe('gpt-5.4');
  });

  it('returns gpt-5.4-mini for social-manager', () => {
    const m = modelForRole('social-manager');
    expect(m.id).toBe('gpt-5.4-mini');
  });

  it('returns gpt-5.4-mini for paid-specialist', () => {
    const m = modelForRole('paid-specialist');
    expect(m.id).toBe('gpt-5.4-mini');
  });

  it('falls back to gpt-5.4-mini for unknown role', () => {
    const m = modelForRole('unknown-role');
    expect(m.id).toBe('gpt-5.4-mini');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server
npx vitest run src/providers/index.test.ts
```

Expected: FAIL — current implementation has `flat` mode default returning `kimi-k2.6` for opencode-go.

- [ ] **Step 3: Rewrite the implementation**

Replace `packages/server/src/providers/index.ts` with:

```typescript
import { getModel } from "@mariozechner/pi-ai";

const ROLE_MODEL: Record<string, string> = {
  director: "gpt-5.4",
  copywriter: "gpt-5.4",
  "social-manager": "gpt-5.4-mini",
  "paid-specialist": "gpt-5.4-mini",
};

export function modelForRole(role: string) {
  const id = ROLE_MODEL[role] ?? "gpt-5.4-mini";
  return getModel("openai-codex", id as never)!;
}

export { getEnvApiKey } from "@mariozechner/pi-ai";
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/providers/index.test.ts
```

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/providers/index.ts packages/server/src/providers/index.test.ts
git commit -m "refactor(providers): openai-subscription only with 4-role model map"
```

---

### Task 5: Rewrite db/schema.ts with 13 tables + fresh init migration

**Files:**
- Rewrite: `packages/server/src/db/schema.ts`
- Rewrite: `packages/server/src/db/schema.test.ts`
- Create: `packages/server/drizzle/0001_init.sql` (Drizzle generates)

- [ ] **Step 1: Replace schema.ts with the 13-table definition**

Replace `packages/server/src/db/schema.ts` with the full Drizzle schema for all 13 tables defined in spec section 3. Use snake_case column names, integer timestamps (ms epoch), and TEXT for IDs (cuid2 strings).

Key signatures (full code below):

```typescript
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable('clients', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const chatThreads = sqliteTable('chat_threads', {
  id: text('id').primaryKey(),
  clientSlug: text('client_slug').notNull().references(() => clients.slug),
  title: text('title'),
  archivedAt: integer('archived_at'),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').references(() => chatThreads.id),
  agentSessionId: text('agent_session_id'),
  sender: text('sender').notNull(),
  type: text('type', { enum: ['chat', 'brief_proposal', 'memory_proposal', 'tool_call', 'tool_result', 'system'] }).notNull(),
  contentJson: text('content_json').notNull(),
  ts: integer('ts').notNull(),
}, (t) => ({
  byThread: index('idx_messages_thread').on(t.threadId, t.ts),
}));

export const briefs = sqliteTable('briefs', {
  id: text('id').primaryKey(),
  clientSlug: text('client_slug').notNull().references(() => clients.slug),
  sourceThreadId: text('source_thread_id').references(() => chatThreads.id),
  contentMd: text('content_md').notNull(),
  status: text('status', { enum: ['draft', 'dispatched', 'done'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  dispatchedAt: integer('dispatched_at'),
});

export const delegations = sqliteTable('delegations', {
  id: text('id').primaryKey(),
  briefId: text('brief_id').notNull().references(() => briefs.id),
  clientSlug: text('client_slug').notNull().references(() => clients.slug),
  fromAgent: text('from_agent').notNull(),
  toAgent: text('to_agent', { enum: ['copywriter', 'social-manager', 'paid-specialist'] }).notNull(),
  payloadJson: text('payload_json').notNull(),
  status: text('status', { enum: ['requested', 'in_progress', 'complete', 'failed'] }).notNull(),
  requestedAt: integer('requested_at').notNull(),
  completedAt: integer('completed_at'),
}, (t) => ({
  byBrief: index('idx_delegations_brief').on(t.briefId, t.status),
  byTarget: index('idx_delegations_target').on(t.toAgent, t.status),
}));

export const deliverables = sqliteTable('deliverables', {
  id: text('id').primaryKey(),
  delegationId: text('delegation_id').notNull().references(() => delegations.id),
  clientSlug: text('client_slug').notNull().references(() => clients.slug),
  type: text('type', { enum: ['social_post', 'email', 'blog_post', 'ad_copy'] }).notNull(),
  status: text('status', { enum: ['drafting', 'awaiting_approval', 'shipped', 'archived'] }).notNull(),
  currentRevisionId: text('current_revision_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  byClientStatus: index('idx_deliverables_client_status').on(t.clientSlug, t.status, t.updatedAt),
}));

export const deliverableRevisions = sqliteTable('deliverable_revisions', {
  id: text('id').primaryKey(),
  deliverableId: text('deliverable_id').notNull().references(() => deliverables.id),
  revisionNo: integer('revision_no').notNull(),
  artifactPath: text('artifact_path').notNull(),
  createdByAgent: text('created_by_agent').notNull(),
  feedbackNote: text('feedback_note'),
  ts: integer('ts').notNull(),
}, (t) => ({
  unique: uniqueIndex('uq_deliverable_revision').on(t.deliverableId, t.revisionNo),
}));

export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(),
  deliverableId: text('deliverable_id').notNull().references(() => deliverables.id),
  revisionId: text('revision_id').notNull().references(() => deliverableRevisions.id),
  decision: text('decision', { enum: ['approved', 'requested_changes', 'discarded'] }).notNull(),
  note: text('note'),
  decidedAt: integer('decided_at').notNull(),
});

export const agentSessions = sqliteTable('agent_sessions', {
  id: text('id').primaryKey(),
  clientSlug: text('client_slug').notNull().references(() => clients.slug),
  agentSlug: text('agent_slug').notNull(),
  lifecycle: text('lifecycle', { enum: ['warm', 'transient'] }).notNull(),
  parentDelegationId: text('parent_delegation_id').references(() => delegations.id),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
}, (t) => ({
  alive: index('idx_sessions_alive').on(t.endedAt),
}));

export const turns = sqliteTable('turns', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => agentSessions.id),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  latencyMs: integer('latency_ms'),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
});

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ts: integer('ts').notNull(),
  clientSlug: text('client_slug').references(() => clients.slug),
  agentSlug: text('agent_slug'),
  sessionId: text('session_id').references(() => agentSessions.id),
  turnId: text('turn_id').references(() => turns.id),
  type: text('type').notNull(),
  payloadJson: text('payload_json').notNull(),
}, (t) => ({
  byTs: index('idx_events_ts').on(t.ts),
  byClientTs: index('idx_events_client_ts').on(t.clientSlug, t.ts),
}));

export const memoryProposals = sqliteTable('memory_proposals', {
  id: text('id').primaryKey(),
  clientSlug: text('client_slug').notNull().references(() => clients.slug),
  file: text('file').notNull(),
  prevContentHash: text('prev_content_hash'),
  newContent: text('new_content').notNull(),
  agentSessionId: text('agent_session_id').references(() => agentSessions.id),
  reason: text('reason'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  decidedAt: integer('decided_at'),
}, (t) => ({
  byStatus: index('idx_proposals_status').on(t.clientSlug, t.status, t.createdAt),
}));

export const memoryAudit = sqliteTable('memory_audit', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientSlug: text('client_slug').notNull().references(() => clients.slug),
  file: text('file').notNull(),
  source: text('source').notNull(),
  prevContentHash: text('prev_content_hash'),
  newContentHash: text('new_content_hash').notNull(),
  ts: integer('ts').notNull(),
}, (t) => ({
  byFile: index('idx_audit_file_ts').on(t.clientSlug, t.file, t.ts),
}));
```

- [ ] **Step 2: Rewrite schema.test.ts to verify all 13 tables exist**

Replace `packages/server/src/db/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as schema from './schema.js';

describe('schema exports', () => {
  it('has all 13 MVP tables', () => {
    expect(schema.clients).toBeDefined();
    expect(schema.chatThreads).toBeDefined();
    expect(schema.messages).toBeDefined();
    expect(schema.briefs).toBeDefined();
    expect(schema.delegations).toBeDefined();
    expect(schema.deliverables).toBeDefined();
    expect(schema.deliverableRevisions).toBeDefined();
    expect(schema.approvals).toBeDefined();
    expect(schema.agentSessions).toBeDefined();
    expect(schema.turns).toBeDefined();
    expect(schema.events).toBeDefined();
    expect(schema.memoryProposals).toBeDefined();
    expect(schema.memoryAudit).toBeDefined();
  });

  it('does not export removed tables', () => {
    expect((schema as any).workflowRuns).toBeUndefined();
    expect((schema as any).evals).toBeUndefined();
    expect((schema as any).campaigns).toBeUndefined();
    expect((schema as any).tasks).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npx vitest run src/db/schema.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 4: Generate the Drizzle migration**

```bash
npm run db:generate
```

Expected: new file `packages/server/drizzle/0001_init.sql` (or similar) generated with `CREATE TABLE` statements for all 13 tables. Verify with:

```bash
ls packages/server/drizzle/
cat packages/server/drizzle/0001_*.sql | head -50
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/db/schema.test.ts packages/server/drizzle/
git commit -m "feat(db): rewrite schema with 13 tables + fresh init migration"
```

---

## Phase 2 — Memory layer

### Task 6: Implement memory/validate.ts (frontmatter schema validation)

**Files:**
- Create: `packages/server/src/memory/validate.ts`
- Create: `packages/server/src/memory/validate.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/memory/validate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateFrontmatter, MemoryFile } from './validate.js';

describe('validateFrontmatter', () => {
  it('accepts valid profile.md', () => {
    const fm = {
      business_description: 'foo',
      target_audience: ['urban women'],
      usp: 'unique',
      competitors: ['x', 'y'],
    };
    expect(() => validateFrontmatter('profile.md', fm)).not.toThrow();
  });

  it('rejects profile.md missing business_description', () => {
    const fm = { target_audience: [], usp: 'x', competitors: [] };
    expect(() => validateFrontmatter('profile.md', fm)).toThrow(/business_description/);
  });

  it('accepts valid brand_voice.md', () => {
    const fm = {
      tone: 'casual',
      adjectives: ['warm', 'precise'],
      reference_brands: ['Notion'],
      do: ['be specific'],
      dont: ['use jargon'],
    };
    expect(() => validateFrontmatter('brand_voice.md', fm)).not.toThrow();
  });

  it('rejects unknown file', () => {
    expect(() => validateFrontmatter('unknown.md', {})).toThrow(/unknown memory file/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/memory/validate.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/server/src/memory/validate.ts`:

```typescript
export type MemoryFile = 'profile.md' | 'brand_voice.md' | 'ongoing_campaigns.md';

const REQUIRED: Record<MemoryFile, string[]> = {
  'profile.md': ['business_description', 'target_audience', 'usp', 'competitors'],
  'brand_voice.md': ['tone', 'adjectives', 'reference_brands', 'do', 'dont'],
  'ongoing_campaigns.md': ['campaigns'],
};

export function validateFrontmatter(file: string, fm: Record<string, unknown>): void {
  const required = REQUIRED[file as MemoryFile];
  if (!required) {
    throw new Error(`unknown memory file: ${file}`);
  }
  const missing = required.filter((k) => !(k in fm));
  if (missing.length > 0) {
    throw new Error(`${file}: missing required frontmatter fields: ${missing.join(', ')}`);
  }
}

export const MEMORY_FILES: MemoryFile[] = ['profile.md', 'brand_voice.md', 'ongoing_campaigns.md'];
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/memory/validate.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/memory/validate.ts packages/server/src/memory/validate.test.ts
git commit -m "feat(memory): per-file frontmatter schema validation"
```

---

### Task 7: Rewrite memory/read.ts (client-scoped path + frontmatter parse)

**Files:**
- Rewrite: `packages/server/src/memory/read.ts`
- Rewrite: `packages/server/src/memory/read.test.ts`

- [ ] **Step 1: Write failing test**

Replace `packages/server/src/memory/read.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readMemoryFile } from './read.js';

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-mem-'));
  const target = join(baseDir, 'memory', 'clients', 'default');
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, 'profile.md'),
    `---\nbusiness_description: "Foo Bar"\ntarget_audience: ["a"]\nusp: "x"\ncompetitors: ["c1"]\n---\n# Profile body\nHello.`,
    'utf8'
  );
});

describe('readMemoryFile', () => {
  it('parses frontmatter and body for default client', async () => {
    const r = await readMemoryFile(baseDir, 'default', 'profile.md');
    expect(r.frontmatter.business_description).toBe('Foo Bar');
    expect(r.frontmatter.target_audience).toEqual(['a']);
    expect(r.body.trim()).toContain('Profile body');
  });

  it('returns null for missing file', async () => {
    const r = await readMemoryFile(baseDir, 'default', 'brand_voice.md');
    expect(r).toBeNull();
  });

  it('returns null for missing client', async () => {
    const r = await readMemoryFile(baseDir, 'other', 'profile.md');
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/memory/read.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `packages/server/src/memory/read.ts`:

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

export interface MemoryFileContent {
  frontmatter: Record<string, unknown>;
  body: string;
  rawContent: string;
}

export async function readMemoryFile(
  dataDir: string,
  clientSlug: string,
  file: string
): Promise<MemoryFileContent | null> {
  const path = join(dataDir, 'memory', 'clients', clientSlug, file);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
    rawContent: raw,
  };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/memory/read.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/memory/read.ts packages/server/src/memory/read.test.ts
git commit -m "feat(memory): client-scoped read with frontmatter parse"
```

---

### Task 8: Rewrite memory/write.ts (atomic + audit log)

**Files:**
- Rewrite: `packages/server/src/memory/write.ts`
- Rewrite: `packages/server/src/memory/write.test.ts`

- [ ] **Step 1: Write failing test**

Replace `packages/server/src/memory/write.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { writeMemoryFile } from './write.js';
import * as schema from '../db/schema.js';

let baseDir: string;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-mem-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  // Seed default client
  await db.insert(schema.clients).values({ slug: 'default', name: 'Default', createdAt: Date.now() });
});

const validProfile = `---
business_description: "Foo"
target_audience: ["a"]
usp: "x"
competitors: ["c"]
---
# Body`;

describe('writeMemoryFile', () => {
  it('atomically writes file and creates audit row', async () => {
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    const path = join(baseDir, 'memory', 'clients', 'default', 'profile.md');
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(validProfile);
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].source).toBe('user');
    expect(audit[0].file).toBe('profile.md');
    expect(audit[0].newContentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects content with invalid frontmatter', async () => {
    const bad = `---\nfoo: bar\n---\n# Body`;
    await expect(
      writeMemoryFile(baseDir, db, 'default', 'profile.md', bad, 'user')
    ).rejects.toThrow(/missing required frontmatter/);
  });

  it('records prev_content_hash on overwrite', async () => {
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile + '\n# Updated', 'agent:director');
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(2);
    expect(audit[1].prevContentHash).toBe(audit[0].newContentHash);
    expect(audit[1].source).toBe('agent:director');
  });

  it('does not leave .tmp files behind', async () => {
    await writeMemoryFile(baseDir, db, 'default', 'profile.md', validProfile, 'user');
    const dir = join(baseDir, 'memory', 'clients', 'default');
    const files = readdirSync(dir);
    expect(files.some((f) => f.includes('.tmp'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/memory/write.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `packages/server/src/memory/write.ts`:

```typescript
import { writeFile, rename, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import matter from 'gray-matter';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { validateFrontmatter } from './validate.js';
import { memoryAudit } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;

export async function writeMemoryFile(
  dataDir: string,
  db: Db,
  clientSlug: string,
  file: string,
  newContent: string,
  source: string
): Promise<void> {
  // 1. validate
  const parsed = matter(newContent);
  validateFrontmatter(file, parsed.data as Record<string, unknown>);

  const targetDir = join(dataDir, 'memory', 'clients', clientSlug);
  await mkdir(targetDir, { recursive: true });
  const targetPath = join(targetDir, file);
  const tempPath = `${targetPath}.tmp.${randomBytes(6).toString('hex')}`;

  // 2. read existing for prev_hash
  let prevHash: string | null = null;
  try {
    const prev = await readFile(targetPath, 'utf8');
    prevHash = sha256(prev);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  // 3. write to temp + atomic rename
  await writeFile(tempPath, newContent, { mode: 0o600 });
  await rename(tempPath, targetPath);

  // 4. audit log
  await db.insert(memoryAudit).values({
    clientSlug,
    file,
    source,
    prevContentHash: prevHash,
    newContentHash: sha256(newContent),
    ts: Date.now(),
  });
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/memory/write.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/memory/write.ts packages/server/src/memory/write.test.ts
git commit -m "feat(memory): atomic write + audit log (no git)"
```

---

### Task 9: Implement memory/proposals.ts (proposal queue CRUD)

**Files:**
- Create: `packages/server/src/memory/proposals.ts`
- Create: `packages/server/src/memory/proposals.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/memory/proposals.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createProposal, listPending, decideProposal } from './proposals.js';
import * as schema from '../db/schema.js';

let baseDir: string;
let db: ReturnType<typeof drizzle>;

const validProfile = `---\nbusiness_description: "Foo"\ntarget_audience: ["a"]\nusp: "x"\ncompetitors: ["c"]\n---\n# Body`;

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-prop-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'Default', createdAt: Date.now() });
});

describe('memory proposals', () => {
  it('creates a pending proposal', async () => {
    const id = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'onboarding step 1',
      agentSessionId: null,
    });
    expect(id).toMatch(/^[a-z0-9]+$/);
    const pending = await listPending(db, 'default');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(id);
    expect(pending[0].reason).toBe('onboarding step 1');
  });

  it('approve writes the file and marks proposal approved', async () => {
    const id = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'r',
      agentSessionId: null,
    });
    await decideProposal(db, baseDir, id, 'approved');
    const pending = await listPending(db, 'default');
    expect(pending).toHaveLength(0);
    const all = await db.select().from(schema.memoryProposals).all();
    expect(all[0].status).toBe('approved');
    // file written via writeMemoryFile (audit row will exist)
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].source).toBe('agent:director');
  });

  it('reject does not write the file', async () => {
    const id = await createProposal(db, {
      clientSlug: 'default',
      file: 'profile.md',
      newContent: validProfile,
      reason: 'r',
      agentSessionId: null,
    });
    await decideProposal(db, baseDir, id, 'rejected');
    const all = await db.select().from(schema.memoryProposals).all();
    expect(all[0].status).toBe('rejected');
    const audit = await db.select().from(schema.memoryAudit).all();
    expect(audit).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/memory/proposals.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/server/src/memory/proposals.ts`:

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { memoryProposals } from '../db/schema.js';
import { writeMemoryFile } from './write.js';

type Db = ReturnType<typeof drizzle>;

export interface CreateProposalInput {
  clientSlug: string;
  file: string;
  newContent: string;
  reason: string;
  agentSessionId: string | null;
}

export async function createProposal(db: Db, input: CreateProposalInput): Promise<string> {
  const id = createId();
  await db.insert(memoryProposals).values({
    id,
    clientSlug: input.clientSlug,
    file: input.file,
    prevContentHash: null,
    newContent: input.newContent,
    agentSessionId: input.agentSessionId,
    reason: input.reason,
    status: 'pending',
    createdAt: Date.now(),
    decidedAt: null,
  });
  return id;
}

export async function listPending(db: Db, clientSlug: string) {
  return db.select()
    .from(memoryProposals)
    .where(and(eq(memoryProposals.clientSlug, clientSlug), eq(memoryProposals.status, 'pending')))
    .orderBy(desc(memoryProposals.createdAt))
    .all();
}

export async function decideProposal(
  db: Db,
  dataDir: string,
  proposalId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const rows = await db.select().from(memoryProposals).where(eq(memoryProposals.id, proposalId)).all();
  if (rows.length === 0) throw new Error(`proposal not found: ${proposalId}`);
  const p = rows[0];
  if (p.status !== 'pending') throw new Error(`proposal not pending: ${proposalId}`);

  if (decision === 'approved') {
    await writeMemoryFile(dataDir, db, p.clientSlug, p.file, p.newContent, 'agent:director');
  }
  await db.update(memoryProposals)
    .set({ status: decision, decidedAt: Date.now() })
    .where(eq(memoryProposals.id, proposalId));
}
```

- [ ] **Step 4: Add cuid2 dep if missing**

```bash
cd packages/server
npm install @paralleldrive/cuid2
```

- [ ] **Step 5: Run, verify pass**

```bash
npx vitest run src/memory/proposals.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/memory/proposals.ts packages/server/src/memory/proposals.test.ts packages/server/package.json package-lock.json
git commit -m "feat(memory): proposal queue CRUD with approve/reject + apply on approve"
```

---

## Phase 3 — Tools

### Task 10: Implement tools/read-memory.ts

**Files:**
- Create: `packages/server/src/tools/read-memory.ts`
- Create: `packages/server/src/tools/read-memory.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/tools/read-memory.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeReadMemoryTool } from './read-memory.js';

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-rm-'));
  const target = join(baseDir, 'memory', 'clients', 'default');
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, 'profile.md'),
    `---\nbusiness_description: "Foo"\ntarget_audience: []\nusp: "x"\ncompetitors: []\n---\nbody`,
    'utf8'
  );
});

describe('read_memory tool', () => {
  it('returns parsed frontmatter and body', async () => {
    const tool = makeReadMemoryTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ file: 'profile.md' });
    expect(r.frontmatter.business_description).toBe('Foo');
    expect(r.body).toBe('body');
  });

  it('throws for unknown file', async () => {
    const tool = makeReadMemoryTool({ dataDir: baseDir, clientSlug: 'default' });
    await expect(tool.execute({ file: 'nope.md' as never })).rejects.toThrow();
  });

  it('returns empty when file does not exist', async () => {
    const tool = makeReadMemoryTool({ dataDir: baseDir, clientSlug: 'default' });
    const r = await tool.execute({ file: 'brand_voice.md' });
    expect(r.frontmatter).toEqual({});
    expect(r.body).toBe('');
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/tools/read-memory.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/server/src/tools/read-memory.ts`:

```typescript
import { readMemoryFile } from '../memory/read.js';
import { MEMORY_FILES, MemoryFile } from '../memory/validate.js';

export interface ReadMemoryContext {
  dataDir: string;
  clientSlug: string;
}

export function makeReadMemoryTool(ctx: ReadMemoryContext) {
  return {
    name: 'read_memory',
    description: 'Olvass be egy memóriafájlt (profile.md, brand_voice.md vagy ongoing_campaigns.md). Visszaadja a parsed frontmattert és a body markdownt.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', enum: MEMORY_FILES },
      },
      required: ['file'],
    },
    execute: async (input: { file: MemoryFile }) => {
      if (!MEMORY_FILES.includes(input.file)) {
        throw new Error(`unknown memory file: ${input.file}`);
      }
      const r = await readMemoryFile(ctx.dataDir, ctx.clientSlug, input.file);
      if (r === null) {
        return { frontmatter: {}, body: '' };
      }
      return { frontmatter: r.frontmatter, body: r.body.trim() };
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/tools/read-memory.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/tools/read-memory.ts packages/server/src/tools/read-memory.test.ts
git commit -m "feat(tools): read_memory shared tool"
```

---

### Task 11: Implement tools/propose-brief.ts

**Files:**
- Create: `packages/server/src/tools/propose-brief.ts`
- Create: `packages/server/src/tools/propose-brief.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/tools/propose-brief.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { makeProposeBriefTool } from './propose-brief.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

beforeEach(async () => {
  events.length = 0;
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.chatThreads).values({ id: 'thr_1', clientSlug: 'default', title: 'main', archivedAt: null });
});

describe('propose_brief tool', () => {
  it('inserts brief draft + emits brief_proposed', async () => {
    const tool = makeProposeBriefTool({ db, broker, clientSlug: 'default', threadId: 'thr_1' });
    const r = await tool.execute({
      title: 'IG poszt — reggeli rituálé',
      content_md: 'Téma: reggeli rituálé...',
      deliverable_type: 'social_post',
      target_specialist: 'social-manager',
      platform: 'instagram',
    });
    expect(r.brief_id).toMatch(/^[a-z0-9]+$/);
    const briefs = await db.select().from(schema.briefs).all();
    expect(briefs).toHaveLength(1);
    expect(briefs[0].status).toBe('draft');
    expect(briefs[0].sourceThreadId).toBe('thr_1');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('brief_proposed');
    expect(events[0].brief_id).toBe(r.brief_id);
  });

  it('rejects mismatched deliverable_type / target_specialist', async () => {
    const tool = makeProposeBriefTool({ db, broker, clientSlug: 'default', threadId: 'thr_1' });
    await expect(tool.execute({
      title: 't',
      content_md: 'c',
      deliverable_type: 'social_post',
      target_specialist: 'paid-specialist', // wrong
    } as never)).rejects.toThrow(/cannot produce social_post/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/tools/propose-brief.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/server/src/tools/propose-brief.ts`:

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createId } from '@paralleldrive/cuid2';
import { briefs } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (event: Record<string, unknown>) => void; }

const SPECIALIST_FOR: Record<string, string[]> = {
  copywriter: ['email', 'blog_post'],
  'social-manager': ['social_post'],
  'paid-specialist': ['ad_copy'],
};

export interface ProposeBriefInput {
  title: string;
  content_md: string;
  deliverable_type: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
  target_specialist: 'copywriter' | 'social-manager' | 'paid-specialist';
  platform?: string;
}

export interface ProposeBriefContext {
  db: Db;
  broker: Broker;
  clientSlug: string;
  threadId: string;
}

export function makeProposeBriefTool(ctx: ProposeBriefContext) {
  return {
    name: 'propose_brief',
    description: 'Javasolj egy briefet az operátornak. A brief draft státuszban kerül a chat-be approval kártyaként; az operátor approve-olja és a megfelelő specialist megkapja.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content_md: { type: 'string' },
        deliverable_type: { type: 'string', enum: ['social_post', 'email', 'blog_post', 'ad_copy'] },
        target_specialist: { type: 'string', enum: ['copywriter', 'social-manager', 'paid-specialist'] },
        platform: { type: 'string' },
      },
      required: ['title', 'content_md', 'deliverable_type', 'target_specialist'],
    },
    execute: async (input: ProposeBriefInput) => {
      // Cross-validate specialist can produce this type
      const allowed = SPECIALIST_FOR[input.target_specialist] ?? [];
      if (!allowed.includes(input.deliverable_type)) {
        throw new Error(`${input.target_specialist} cannot produce ${input.deliverable_type}`);
      }
      const id = createId();
      await ctx.db.insert(briefs).values({
        id,
        clientSlug: ctx.clientSlug,
        sourceThreadId: ctx.threadId,
        contentMd: JSON.stringify({
          title: input.title,
          body: input.content_md,
          deliverable_type: input.deliverable_type,
          target_specialist: input.target_specialist,
          platform: input.platform ?? null,
        }),
        status: 'draft',
        createdAt: Date.now(),
        dispatchedAt: null,
      });
      ctx.broker.emit({
        type: 'brief_proposed',
        brief_id: id,
        client_slug: ctx.clientSlug,
        thread_id: ctx.threadId,
        title: input.title,
        deliverable_type: input.deliverable_type,
        target_specialist: input.target_specialist,
        platform: input.platform ?? null,
      });
      return { brief_id: id };
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/tools/propose-brief.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/tools/propose-brief.ts packages/server/src/tools/propose-brief.test.ts
git commit -m "feat(tools): propose_brief Director tool with specialist match validation"
```

---

### Task 12: Implement tools/propose-memory-update.ts

**Files:**
- Create: `packages/server/src/tools/propose-memory-update.ts`
- Create: `packages/server/src/tools/propose-memory-update.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/tools/propose-memory-update.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { makeProposeMemoryUpdateTool } from './propose-memory-update.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

const validProfile = `---\nbusiness_description: "Foo"\ntarget_audience: ["a"]\nusp: "x"\ncompetitors: ["c"]\n---\n# Body`;

beforeEach(async () => {
  events.length = 0;
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
});

describe('propose_memory_update tool', () => {
  it('creates pending proposal + emits memory_proposed event', async () => {
    const tool = makeProposeMemoryUpdateTool({
      db, broker, clientSlug: 'default', agentSessionId: null,
    });
    const r = await tool.execute({
      file: 'profile.md',
      new_content: validProfile,
      reason: 'onboarding step 1',
    });
    expect(r.proposal_id).toMatch(/^[a-z0-9]+$/);
    const all = await db.select().from(schema.memoryProposals).all();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('pending');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('memory_proposed');
  });

  it('rejects invalid frontmatter', async () => {
    const tool = makeProposeMemoryUpdateTool({
      db, broker, clientSlug: 'default', agentSessionId: null,
    });
    await expect(tool.execute({
      file: 'profile.md',
      new_content: '---\nfoo: bar\n---\nnope',
      reason: 'bad',
    })).rejects.toThrow(/missing required frontmatter/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/tools/propose-memory-update.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/server/src/tools/propose-memory-update.ts`:

```typescript
import matter from 'gray-matter';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createProposal } from '../memory/proposals.js';
import { validateFrontmatter, MEMORY_FILES, MemoryFile } from '../memory/validate.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface ProposeMemoryContext {
  db: Db;
  broker: Broker;
  clientSlug: string;
  agentSessionId: string | null;
}

export function makeProposeMemoryUpdateTool(ctx: ProposeMemoryContext) {
  return {
    name: 'propose_memory_update',
    description: 'Javasolj egy memóriafájl-frissítést. A teljes új tartalmat add meg (NEM patch). Az operátor a queue-ból approve-olja vagy elveti.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', enum: MEMORY_FILES },
        new_content: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['file', 'new_content', 'reason'],
    },
    execute: async (input: { file: MemoryFile; new_content: string; reason: string }) => {
      // Pre-validate frontmatter so the operator doesn't see broken proposals
      const parsed = matter(input.new_content);
      validateFrontmatter(input.file, parsed.data as Record<string, unknown>);

      const id = await createProposal(ctx.db, {
        clientSlug: ctx.clientSlug,
        file: input.file,
        newContent: input.new_content,
        reason: input.reason,
        agentSessionId: ctx.agentSessionId,
      });
      ctx.broker.emit({
        type: 'memory_proposed',
        proposal_id: id,
        client_slug: ctx.clientSlug,
        file: input.file,
        reason: input.reason,
      });
      return { proposal_id: id };
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/tools/propose-memory-update.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/tools/propose-memory-update.ts packages/server/src/tools/propose-memory-update.test.ts
git commit -m "feat(tools): propose_memory_update Director tool"
```

---

### Task 13: Implement tools/submit-deliverable.ts

**Files:**
- Create: `packages/server/src/tools/submit-deliverable.ts`
- Create: `packages/server/src/tools/submit-deliverable.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/src/tools/submit-deliverable.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { makeSubmitDeliverableTool } from './submit-deliverable.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
let baseDir: string;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

beforeEach(async () => {
  events.length = 0;
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-sd-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.chatThreads).values({ id: 'thr_1', clientSlug: 'default', title: 't', archivedAt: null });
  await db.insert(schema.briefs).values({
    id: 'br_1', clientSlug: 'default', sourceThreadId: 'thr_1', contentMd: '{}',
    status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now(),
  });
  await db.insert(schema.delegations).values({
    id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director',
    toAgent: 'social-manager', payloadJson: '{}', status: 'in_progress', requestedAt: Date.now(), completedAt: null,
  });
});

describe('submit_deliverable tool', () => {
  it('first submission creates deliverable + rev_001 + emits event', async () => {
    const tool = makeSubmitDeliverableTool({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      delegationId: 'del_1', agentSlug: 'social-manager',
      deliverableType: 'social_post',
    });
    const r = await tool.execute({
      content_md: '# Hello world',
      structured_data: { platform: 'instagram', text: 'hello', visual_brief: 'sunset' },
    });
    expect(r.deliverable_id).toMatch(/^[a-z0-9]+$/);
    expect(r.revision_no).toBe(1);

    const dels = await db.select().from(schema.deliverables).all();
    expect(dels).toHaveLength(1);
    expect(dels[0].status).toBe('awaiting_approval');
    expect(dels[0].type).toBe('social_post');

    const revs = await db.select().from(schema.deliverableRevisions).all();
    expect(revs).toHaveLength(1);
    expect(revs[0].revisionNo).toBe(1);
    expect(existsSync(revs[0].artifactPath)).toBe(true);
    const content = readFileSync(revs[0].artifactPath, 'utf8');
    expect(content).toContain('# Hello world');
    expect(content).toContain('"platform": "instagram"');

    expect(events.some((e) => e.type === 'deliverable_submitted')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/tools/submit-deliverable.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/server/src/tools/submit-deliverable.ts`:

```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { deliverables, deliverableRevisions, delegations } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface SubmitDeliverableContext {
  db: Db;
  broker: Broker;
  dataDir: string;
  clientSlug: string;
  delegationId: string;
  agentSlug: string;
  deliverableType: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
}

export interface SubmitDeliverableInput {
  content_md: string;
  structured_data?: Record<string, unknown>;
}

export function makeSubmitDeliverableTool(ctx: SubmitDeliverableContext) {
  return {
    name: 'submit_deliverable',
    description: 'Add be a befejezett deliverable-t. A markdown tartalom és az opcionális structured_data automatikusan elmentődik artifact fájlként, és a deliverable jóváhagyásra vár státuszba kerül.',
    inputSchema: {
      type: 'object',
      properties: {
        content_md: { type: 'string' },
        structured_data: { type: 'object' },
      },
      required: ['content_md'],
    },
    execute: async (input: SubmitDeliverableInput) => {
      // Find or create the deliverable for this delegation
      const existing = await ctx.db.select().from(deliverables).where(eq(deliverables.delegationId, ctx.delegationId)).all();
      const now = Date.now();
      let deliverableId: string;
      let revisionNo: number;

      if (existing.length === 0) {
        deliverableId = createId();
        await ctx.db.insert(deliverables).values({
          id: deliverableId,
          delegationId: ctx.delegationId,
          clientSlug: ctx.clientSlug,
          type: ctx.deliverableType,
          status: 'awaiting_approval',
          currentRevisionId: null,
          createdAt: now,
          updatedAt: now,
        });
        revisionNo = 1;
      } else {
        deliverableId = existing[0].id;
        const revs = await ctx.db.select().from(deliverableRevisions)
          .where(eq(deliverableRevisions.deliverableId, deliverableId)).all();
        revisionNo = revs.length + 1;
      }

      // Write artifact file
      const artifactDir = join(ctx.dataDir, 'artifacts', 'clients', ctx.clientSlug, deliverableId);
      await mkdir(artifactDir, { recursive: true });
      const artifactPath = join(artifactDir, `rev_${String(revisionNo).padStart(3, '0')}.md`);
      const fileContent = composeArtifact(input.content_md, input.structured_data);
      await writeFile(artifactPath, fileContent, { mode: 0o600 });

      // Insert revision row
      const revisionId = createId();
      await ctx.db.insert(deliverableRevisions).values({
        id: revisionId,
        deliverableId,
        revisionNo,
        artifactPath,
        createdByAgent: ctx.agentSlug,
        feedbackNote: null,
        ts: now,
      });

      // Update deliverable to point at the latest revision
      await ctx.db.update(deliverables)
        .set({ currentRevisionId: revisionId, status: 'awaiting_approval', updatedAt: now })
        .where(eq(deliverables.id, deliverableId));

      // Mark delegation complete
      await ctx.db.update(delegations).set({ status: 'complete', completedAt: now }).where(eq(delegations.id, ctx.delegationId));

      ctx.broker.emit({
        type: 'deliverable_submitted',
        deliverable_id: deliverableId,
        revision_no: revisionNo,
        client_slug: ctx.clientSlug,
        agent_slug: ctx.agentSlug,
        delegation_id: ctx.delegationId,
      });

      return { deliverable_id: deliverableId, revision_no: revisionNo };
    },
  };
}

function composeArtifact(contentMd: string, structuredData?: Record<string, unknown>): string {
  if (!structuredData) return contentMd;
  return `${contentMd}\n\n<!-- structured_data\n${JSON.stringify(structuredData, null, 2)}\n-->\n`;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/tools/submit-deliverable.test.ts
```

Expected: PASS (1/1).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/tools/submit-deliverable.ts packages/server/src/tools/submit-deliverable.test.ts
git commit -m "feat(tools): submit_deliverable specialist tool"
```

---

## Phase 4 — Agents + broker

### Task 14: Rewrite agents/config.ts (4-role definition)

**Files:**
- Rewrite: `packages/server/src/agents/config.ts`
- Rewrite: `packages/server/src/agents/config.test.ts`

- [ ] **Step 1: Write failing test**

Replace `packages/server/src/agents/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ROLE_CONFIGS, getRoleConfig, RoleSlug } from './config.js';

describe('agent role config', () => {
  it('has exactly 4 roles', () => {
    const slugs = Object.keys(ROLE_CONFIGS);
    expect(slugs.sort()).toEqual(['copywriter', 'director', 'paid-specialist', 'social-manager']);
  });

  it('director is warm', () => {
    expect(getRoleConfig('director').lifecycle).toBe('warm');
  });

  it('all specialists are transient', () => {
    for (const slug of ['copywriter', 'social-manager', 'paid-specialist'] as const) {
      expect(getRoleConfig(slug).lifecycle).toBe('transient');
    }
  });

  it('director tool list', () => {
    expect(getRoleConfig('director').tools.sort())
      .toEqual(['propose_brief', 'propose_memory_update', 'read_memory']);
  });

  it('specialist tool list', () => {
    for (const slug of ['copywriter', 'social-manager', 'paid-specialist'] as const) {
      expect(getRoleConfig(slug).tools.sort()).toEqual(['read_memory', 'submit_deliverable']);
    }
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/agents/config.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `packages/server/src/agents/config.ts`:

```typescript
export type RoleSlug = 'director' | 'copywriter' | 'social-manager' | 'paid-specialist';
export type Lifecycle = 'warm' | 'transient';

export interface RoleConfig {
  slug: RoleSlug;
  lifecycle: Lifecycle;
  tools: string[];
  produces: string[];          // deliverable types this role can produce ([] for director)
}

export const ROLE_CONFIGS: Record<RoleSlug, RoleConfig> = {
  director: {
    slug: 'director',
    lifecycle: 'warm',
    tools: ['propose_brief', 'propose_memory_update', 'read_memory'],
    produces: [],
  },
  copywriter: {
    slug: 'copywriter',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_deliverable'],
    produces: ['email', 'blog_post'],
  },
  'social-manager': {
    slug: 'social-manager',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_deliverable'],
    produces: ['social_post'],
  },
  'paid-specialist': {
    slug: 'paid-specialist',
    lifecycle: 'transient',
    tools: ['read_memory', 'submit_deliverable'],
    produces: ['ad_copy'],
  },
};

export function getRoleConfig(slug: RoleSlug): RoleConfig {
  const c = ROLE_CONFIGS[slug];
  if (!c) throw new Error(`unknown role: ${slug}`);
  return c;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/agents/config.test.ts
```

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/agents/config.ts packages/server/src/agents/config.test.ts
git commit -m "refactor(agents): 4-role config (Director + 3 specialists)"
```

---

### Task 15: Rewrite agents/factory.ts (warm director + transient specialist spawn)

**Files:**
- Rewrite: `packages/server/src/agents/factory.ts`
- Rewrite: `packages/server/src/agents/factory.test.ts`

- [ ] **Step 1: Write failing test**

Replace `packages/server/src/agents/factory.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnAgent } from './factory.js';
import * as schema from '../db/schema.js';

vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: class FakeAgent {
    constructor(public opts: any) {}
    async prompt(text: string) { return { text }; }
  },
}));

let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: vi.fn() };

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-fac-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  broker.emit.mockClear();
});

describe('spawnAgent', () => {
  it('spawns director with director tools and warm lifecycle', async () => {
    const a = await spawnAgent({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      role: 'director', threadId: 'thr_1',
    });
    expect(a.session.lifecycle).toBe('warm');
    const tools = a.agent.opts.tools.map((t: any) => t.name).sort();
    expect(tools).toEqual(['propose_brief', 'propose_memory_update', 'read_memory']);
  });

  it('spawns transient social-manager bound to a delegation', async () => {
    await db.insert(schema.briefs).values({ id: 'br_1', clientSlug: 'default', sourceThreadId: null, contentMd: '{}', status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now() });
    await db.insert(schema.delegations).values({ id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director', toAgent: 'social-manager', payloadJson: '{}', status: 'in_progress', requestedAt: Date.now(), completedAt: null });
    const a = await spawnAgent({
      db, broker, dataDir: baseDir, clientSlug: 'default',
      role: 'social-manager', delegationId: 'del_1', deliverableType: 'social_post',
    });
    expect(a.session.lifecycle).toBe('transient');
    const tools = a.agent.opts.tools.map((t: any) => t.name).sort();
    expect(tools).toEqual(['read_memory', 'submit_deliverable']);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/agents/factory.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `packages/server/src/agents/factory.ts`:

```typescript
import { Agent } from '@mariozechner/pi-agent-core';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createId } from '@paralleldrive/cuid2';
import { agentSessions } from '../db/schema.js';
import { getRoleConfig, RoleSlug } from './config.js';
import { modelForRole } from '../providers/index.js';
import { makeReadMemoryTool } from '../tools/read-memory.js';
import { makeProposeBriefTool } from '../tools/propose-brief.js';
import { makeProposeMemoryUpdateTool } from '../tools/propose-memory-update.js';
import { makeSubmitDeliverableTool } from '../tools/submit-deliverable.js';
import { loadSkillRecipes } from '../skills/loader.js';
import { renderMemoryContext } from './transform-context.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface SpawnInput {
  db: Db;
  broker: Broker;
  dataDir: string;
  clientSlug: string;
  role: RoleSlug;
  threadId?: string;
  delegationId?: string;
  deliverableType?: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
}

export interface SpawnedAgent {
  agent: Agent;
  session: { id: string; lifecycle: 'warm' | 'transient' };
}

export async function spawnAgent(input: SpawnInput): Promise<SpawnedAgent> {
  const config = getRoleConfig(input.role);
  const sessionId = createId();
  const now = Date.now();

  await input.db.insert(agentSessions).values({
    id: sessionId,
    clientSlug: input.clientSlug,
    agentSlug: input.role,
    lifecycle: config.lifecycle,
    parentDelegationId: input.delegationId ?? null,
    startedAt: now,
    endedAt: null,
  });

  // Build tool list per role
  const tools = await buildToolsForRole(config.slug, input, sessionId);

  // System prompt = skill recipes + memory injection
  const skills = await loadSkillRecipes(input.dataDir, config.slug);
  const memoryBlock = await renderMemoryContext(input.dataDir, input.clientSlug, config.slug);
  const systemPrompt = `${memoryBlock}\n\n${skills}`;

  const agent = new Agent({
    model: modelForRole(config.slug),
    systemPrompt,
    tools,
  } as never);

  return { agent, session: { id: sessionId, lifecycle: config.lifecycle } };
}

async function buildToolsForRole(
  role: RoleSlug,
  input: SpawnInput,
  sessionId: string
): Promise<unknown[]> {
  const tools: unknown[] = [];
  const cfg = getRoleConfig(role);

  for (const toolName of cfg.tools) {
    switch (toolName) {
      case 'read_memory':
        tools.push(makeReadMemoryTool({ dataDir: input.dataDir, clientSlug: input.clientSlug }));
        break;
      case 'propose_brief':
        if (!input.threadId) throw new Error('propose_brief needs threadId');
        tools.push(makeProposeBriefTool({ db: input.db, broker: input.broker, clientSlug: input.clientSlug, threadId: input.threadId }));
        break;
      case 'propose_memory_update':
        tools.push(makeProposeMemoryUpdateTool({ db: input.db, broker: input.broker, clientSlug: input.clientSlug, agentSessionId: sessionId }));
        break;
      case 'submit_deliverable':
        if (!input.delegationId || !input.deliverableType) throw new Error('submit_deliverable needs delegationId and deliverableType');
        tools.push(makeSubmitDeliverableTool({
          db: input.db, broker: input.broker, dataDir: input.dataDir,
          clientSlug: input.clientSlug, delegationId: input.delegationId,
          agentSlug: role, deliverableType: input.deliverableType,
        }));
        break;
    }
  }
  return tools;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/agents/factory.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/agents/factory.ts packages/server/src/agents/factory.test.ts
git commit -m "refactor(agents): spawn factory with per-role tool registry"
```

---

### Task 16: Rewrite broker/router.ts (brief dispatch + specialist spawn)

**Files:**
- Rewrite: `packages/server/src/broker/router.ts`
- Rewrite: `packages/server/src/broker/router.test.ts`

- [ ] **Step 1: Write failing test**

Replace `packages/server/src/broker/router.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatchBrief } from './router.js';
import * as schema from '../db/schema.js';

vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: class FakeAgent {
    constructor(public opts: any) {}
    async prompt() { /* simulate specialist completion via direct DB writes */ }
  },
}));

let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: vi.fn() };

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-rt-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.briefs).values({
    id: 'br_1', clientSlug: 'default', sourceThreadId: null,
    contentMd: JSON.stringify({ title: 't', body: 'b', deliverable_type: 'social_post', target_specialist: 'social-manager', platform: 'instagram' }),
    status: 'draft', createdAt: Date.now(), dispatchedAt: null,
  });
  broker.emit.mockClear();
});

describe('dispatchBrief', () => {
  it('marks brief dispatched, creates delegation, spawns specialist', async () => {
    await dispatchBrief({ db, broker, dataDir: baseDir, briefId: 'br_1' });
    const briefs = await db.select().from(schema.briefs).all();
    expect(briefs[0].status).toBe('dispatched');
    expect(briefs[0].dispatchedAt).not.toBeNull();
    const dels = await db.select().from(schema.delegations).all();
    expect(dels).toHaveLength(1);
    expect(dels[0].toAgent).toBe('social-manager');
    expect(dels[0].fromAgent).toBe('director');
    expect(broker.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'brief_dispatched', brief_id: 'br_1' }));
    expect(broker.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'delegation_started' }));
  });

  it('throws on already-dispatched brief', async () => {
    await dispatchBrief({ db, broker, dataDir: baseDir, briefId: 'br_1' });
    await expect(dispatchBrief({ db, broker, dataDir: baseDir, briefId: 'br_1' })).rejects.toThrow(/already dispatched/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/broker/router.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `packages/server/src/broker/router.ts`:

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { briefs, delegations } from '../db/schema.js';
import { spawnAgent } from '../agents/factory.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface DispatchInput {
  db: Db;
  broker: Broker;
  dataDir: string;
  briefId: string;
}

interface BriefPayload {
  title: string;
  body: string;
  deliverable_type: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
  target_specialist: 'copywriter' | 'social-manager' | 'paid-specialist';
  platform?: string | null;
}

export async function dispatchBrief(input: DispatchInput): Promise<void> {
  const rows = await input.db.select().from(briefs).where(eq(briefs.id, input.briefId)).all();
  if (rows.length === 0) throw new Error(`brief not found: ${input.briefId}`);
  const brief = rows[0];
  if (brief.status !== 'draft') throw new Error(`brief already dispatched or done: ${input.briefId}`);

  const payload = JSON.parse(brief.contentMd) as BriefPayload;
  const now = Date.now();

  // Mark brief dispatched
  await input.db.update(briefs).set({ status: 'dispatched', dispatchedAt: now }).where(eq(briefs.id, input.briefId));

  // Create delegation
  const delegationId = createId();
  await input.db.insert(delegations).values({
    id: delegationId,
    briefId: input.briefId,
    clientSlug: brief.clientSlug,
    fromAgent: 'director',
    toAgent: payload.target_specialist,
    payloadJson: brief.contentMd,
    status: 'in_progress',
    requestedAt: now,
    completedAt: null,
  });

  input.broker.emit({ type: 'brief_dispatched', brief_id: input.briefId, delegation_id: delegationId });

  // Spawn specialist agent
  const { agent, session } = await spawnAgent({
    db: input.db,
    broker: input.broker,
    dataDir: input.dataDir,
    clientSlug: brief.clientSlug,
    role: payload.target_specialist,
    delegationId,
    deliverableType: payload.deliverable_type,
  });

  input.broker.emit({
    type: 'delegation_started',
    delegation_id: delegationId,
    agent_slug: payload.target_specialist,
    session_id: session.id,
  });

  // Fire-and-forget: agent.prompt resolves when submit_deliverable returns
  const prompt = composePrompt(payload);
  agent.prompt(prompt).catch((err) => {
    input.broker.emit({ type: 'error', source: 'specialist', delegation_id: delegationId, message: String(err) });
  });
}

function composePrompt(p: BriefPayload): string {
  return [
    `# Brief: ${p.title}`,
    p.platform ? `Platform: ${p.platform}` : '',
    `Deliverable típus: ${p.deliverable_type}`,
    '',
    p.body,
  ].filter(Boolean).join('\n');
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/broker/router.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/broker/router.ts packages/server/src/broker/router.test.ts
git commit -m "feat(broker): dispatchBrief — mark brief, create delegation, spawn specialist"
```

---

### Task 17: Update broker/event-bus.ts + recovery.ts to new event types

**Files:**
- Modify: `packages/server/src/broker/event-bus.ts`
- Modify: `packages/server/src/broker/recovery.ts`
- Modify: `packages/server/src/broker/event-bus.test.ts`

- [ ] **Step 1: Adapt event-bus.test.ts to MVP event types**

Replace `packages/server/src/broker/event-bus.test.ts` to assert only the events listed in spec section 3.2 are recognized: `chat_message`, `brief_proposed`, `brief_dispatched`, `delegation_started`, `deliverable_submitted`, `deliverable_approved`, `deliverable_returned`, `deliverable_discarded`, `memory_proposed`, `memory_decided`, `memory_edited`, `error`. Test that emit persists to events table and notifies subscribers.

(Use the existing event-bus structure as a starting point — only adapt the type enum and event normalization to drop legacy types.)

- [ ] **Step 2: Run, verify fail (or pass partial)**

```bash
npx vitest run src/broker/event-bus.test.ts
```

- [ ] **Step 3: Modify event-bus.ts**

In `packages/server/src/broker/event-bus.ts`, ensure:
1. `EVENT_TYPES` const matches the 12 types from spec section 3.2
2. `emit(e)` writes to `events` table AND notifies SSE subscribers
3. Drop any references to `eval_*`, `workflow_*`, `cron_*`, `task_*`, `campaign_*` event types

- [ ] **Step 4: Modify recovery.ts**

In `packages/server/src/broker/recovery.ts`, simplify to:
- On boot, find `agent_sessions WHERE ended_at IS NULL`:
  - If `lifecycle === 'warm'` (Director) → mark as ended (will be respawned on first chat)
  - If `lifecycle === 'transient'` → mark session ended + delegation `failed` + emit `error` event
- Find `delegations WHERE status='requested'` → leave them; the next `dispatchBrief` re-call (manual operator action) will handle

Drop any references to `evals`, `workflow_runs`, `tasks`.

- [ ] **Step 5: Run, verify all broker tests pass**

```bash
npx vitest run src/broker/
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/broker/
git commit -m "refactor(broker): adapt event-bus + recovery to MVP event types"
```

---

## Phase 5 — HTTP routes

### Task 18: Rewrite server/routes/briefs.ts

**Files:**
- Rewrite: `packages/server/src/server/routes/briefs.ts`
- Rewrite: `packages/server/src/server/routes/briefs.test.ts`

- [ ] **Step 1: Write failing test**

Replace `packages/server/src/server/routes/briefs.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { briefsRoutes } from './briefs.js';
import * as schema from '../../db/schema.js';

let app: FastifyInstance;
let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: () => {} };

beforeEach(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'marquee-routes-'));
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  app = Fastify();
  await app.register(briefsRoutes, { db, broker, dataDir: baseDir });
});

describe('briefs routes', () => {
  it('POST /api/briefs — creates brief (n8n-driven)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/briefs',
      payload: {
        title: 't',
        content_md: 'b',
        deliverable_type: 'social_post',
        target_specialist: 'social-manager',
        platform: 'instagram',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.brief_id).toMatch(/^[a-z0-9]+$/);
    const briefs = await db.select().from(schema.briefs).all();
    expect(briefs).toHaveLength(1);
    expect(briefs[0].status).toBe('draft');
  });

  it('GET /api/briefs — lists briefs for default client', async () => {
    await db.insert(schema.briefs).values({
      id: 'br_1', clientSlug: 'default', sourceThreadId: null,
      contentMd: '{"title":"x","body":"y","deliverable_type":"email","target_specialist":"copywriter"}',
      status: 'draft', createdAt: Date.now(), dispatchedAt: null,
    });
    const res = await app.inject({ method: 'GET', url: '/api/briefs' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('POST /api/briefs/:id/dispatch — dispatches the brief', async () => {
    const create = await app.inject({
      method: 'POST', url: '/api/briefs',
      payload: { title: 't', content_md: 'b', deliverable_type: 'social_post', target_specialist: 'social-manager' },
    });
    const briefId = create.json().brief_id;
    const res = await app.inject({ method: 'POST', url: `/api/briefs/${briefId}/dispatch` });
    expect(res.statusCode).toBe(200);
    const briefs = await db.select().from(schema.briefs).all();
    expect(briefs[0].status).toBe('dispatched');
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/server/routes/briefs.test.ts
```

- [ ] **Step 3: Implement**

Replace `packages/server/src/server/routes/briefs.ts`:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { briefs } from '../../db/schema.js';
import { dispatchBrief } from '../../broker/router.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface BriefsRoutesOpts {
  db: Db;
  broker: Broker;
  dataDir: string;
}

export const briefsRoutes: FastifyPluginAsync<BriefsRoutesOpts> = async (app, opts) => {
  const { db, broker, dataDir } = opts;

  app.post<{ Body: any }>('/api/briefs', async (req, reply) => {
    const b = req.body;
    const id = createId();
    await db.insert(briefs).values({
      id,
      clientSlug: 'default',
      sourceThreadId: null,
      contentMd: JSON.stringify({
        title: b.title,
        body: b.content_md,
        deliverable_type: b.deliverable_type,
        target_specialist: b.target_specialist,
        platform: b.platform ?? null,
      }),
      status: 'draft',
      createdAt: Date.now(),
      dispatchedAt: null,
    });
    return reply.code(201).send({ brief_id: id });
  });

  app.get('/api/briefs', async () => {
    const all = await db.select().from(briefs).where(eq(briefs.clientSlug, 'default')).orderBy(desc(briefs.createdAt)).all();
    return all;
  });

  app.post<{ Params: { id: string } }>('/api/briefs/:id/dispatch', async (req, reply) => {
    try {
      await dispatchBrief({ db, broker, dataDir, briefId: req.params.id });
      return reply.send({ ok: true });
    } catch (err) {
      return reply.code(400).send({ error: String((err as Error).message) });
    }
  });
};
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run src/server/routes/briefs.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server/routes/briefs.ts packages/server/src/server/routes/briefs.test.ts
git commit -m "feat(routes): briefs CRUD + dispatch endpoint"
```

---

### Task 19: Rewrite server/routes/deliverables.ts (approve / return / discard)

**Files:**
- Rewrite: `packages/server/src/server/routes/deliverables.ts`
- Rewrite: `packages/server/src/server/routes/deliverables.test.ts`

- [ ] **Step 1: Write failing test**

Replace test with cases for: `GET /api/deliverables` (with `?status=` filter), `GET /api/deliverables/:id`, `GET /api/deliverables/:id/revisions`, `POST /api/deliverables/:id/approve`, `POST /api/deliverables/:id/return` (with feedback note in body), `POST /api/deliverables/:id/discard`.

Each test seeds a deliverable with one revision in `awaiting_approval`, then:
- approve → status `shipped`, `approvals` row inserted, n8n outbound webhook event emitted
- return → status `drafting`, new delegation row, `approvals` row with `requested_changes`
- discard → status `archived`, `approvals` row with `discarded`

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { deliverables, deliverableRevisions, approvals, delegations, briefs } from '../../db/schema.js';
import { spawnAgent } from '../../agents/factory.js';
import { fireDeliverableShipped } from '../../webhooks/n8n-outbound.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface DeliverablesRoutesOpts {
  db: Db;
  broker: Broker;
  dataDir: string;
  n8nWebhookUrl: string | null;
}

export const deliverablesRoutes: FastifyPluginAsync<DeliverablesRoutesOpts> = async (app, opts) => {
  const { db, broker, dataDir, n8nWebhookUrl } = opts;

  // List with optional status filter
  app.get<{ Querystring: { status?: string } }>('/api/deliverables', async (req) => {
    const statuses = req.query.status ? [req.query.status] : ['drafting', 'awaiting_approval', 'shipped', 'archived'];
    return db.select().from(deliverables)
      .where(and(eq(deliverables.clientSlug, 'default'), inArray(deliverables.status, statuses as never)))
      .orderBy(desc(deliverables.updatedAt)).all();
  });

  // Single deliverable + current revision
  app.get<{ Params: { id: string } }>('/api/deliverables/:id', async (req, reply) => {
    const ds = await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all();
    if (ds.length === 0) return reply.code(404).send({ error: 'not_found' });
    const revs = await db.select().from(deliverableRevisions)
      .where(eq(deliverableRevisions.deliverableId, req.params.id))
      .orderBy(asc(deliverableRevisions.revisionNo)).all();
    return { deliverable: ds[0], revisions: revs };
  });

  // Approve
  app.post<{ Params: { id: string } }>('/api/deliverables/:id/approve', async (req, reply) => {
    const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
    if (!d) return reply.code(404).send({ error: 'not_found' });
    if (d.status !== 'awaiting_approval') return reply.code(400).send({ error: 'not_awaiting_approval' });
    const now = Date.now();
    await db.update(deliverables).set({ status: 'shipped', updatedAt: now }).where(eq(deliverables.id, d.id));
    await db.insert(approvals).values({
      id: createId(), deliverableId: d.id, revisionId: d.currentRevisionId!,
      decision: 'approved', note: null, decidedAt: now,
    });
    broker.emit({ type: 'deliverable_approved', deliverable_id: d.id });
    if (n8nWebhookUrl) {
      void fireDeliverableShipped(n8nWebhookUrl, db, d.id).catch((err) => {
        broker.emit({ type: 'error', source: 'n8n_webhook', message: String(err) });
      });
    }
    return reply.send({ ok: true });
  });

  // Return for changes
  app.post<{ Params: { id: string }; Body: { note?: string } }>('/api/deliverables/:id/return', async (req, reply) => {
    const note = req.body?.note ?? null;
    const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
    if (!d) return reply.code(404).send({ error: 'not_found' });
    if (d.status !== 'awaiting_approval') return reply.code(400).send({ error: 'not_awaiting_approval' });
    const now = Date.now();

    await db.update(deliverables).set({ status: 'drafting', updatedAt: now }).where(eq(deliverables.id, d.id));
    await db.insert(approvals).values({
      id: createId(), deliverableId: d.id, revisionId: d.currentRevisionId!,
      decision: 'requested_changes', note, decidedAt: now,
    });

    // Spawn new specialist with feedback prepended to brief
    const oldDel = (await db.select().from(delegations).where(eq(delegations.id, d.delegationId)).all())[0];
    const brief = (await db.select().from(briefs).where(eq(briefs.id, oldDel.briefId)).all())[0];
    const newDelId = createId();
    await db.insert(delegations).values({
      id: newDelId, briefId: brief.id, clientSlug: brief.clientSlug, fromAgent: 'director',
      toAgent: oldDel.toAgent, payloadJson: brief.contentMd, status: 'in_progress',
      requestedAt: now, completedAt: null,
    });
    // Re-attach the SAME deliverable to the new delegation (revision will be appended)
    await db.update(deliverables).set({ delegationId: newDelId, updatedAt: now }).where(eq(deliverables.id, d.id));

    const payload = JSON.parse(brief.contentMd);
    const { agent, session } = await spawnAgent({
      db, broker, dataDir, clientSlug: brief.clientSlug,
      role: oldDel.toAgent as never,
      delegationId: newDelId, deliverableType: d.type as never,
    });
    broker.emit({ type: 'deliverable_returned', deliverable_id: d.id, delegation_id: newDelId });
    broker.emit({ type: 'delegation_started', delegation_id: newDelId, agent_slug: oldDel.toAgent, session_id: session.id });

    const prevRev = (await db.select().from(deliverableRevisions).where(eq(deliverableRevisions.id, d.currentRevisionId!)).all())[0];
    const prompt = [
      `# Brief: ${payload.title}`,
      `Deliverable típus: ${payload.deliverable_type}`,
      payload.platform ? `Platform: ${payload.platform}` : '',
      '',
      payload.body,
      '',
      '## ELŐZŐ VERZIÓ (file)',
      prevRev.artifactPath,
      '',
      '## OPERATOR FEEDBACK',
      note ?? '(nincs konkrét megjegyzés)',
      '',
      'Készítsd el az új verziót a feedback alapján.',
    ].filter(Boolean).join('\n');
    void agent.prompt(prompt).catch((err) => broker.emit({ type: 'error', source: 'specialist', message: String(err) }));

    return reply.send({ ok: true });
  });

  // Discard
  app.post<{ Params: { id: string }; Body: { note?: string } }>('/api/deliverables/:id/discard', async (req, reply) => {
    const d = (await db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).all())[0];
    if (!d) return reply.code(404).send({ error: 'not_found' });
    const now = Date.now();
    await db.update(deliverables).set({ status: 'archived', updatedAt: now }).where(eq(deliverables.id, d.id));
    await db.insert(approvals).values({
      id: createId(), deliverableId: d.id, revisionId: d.currentRevisionId!,
      decision: 'discarded', note: req.body?.note ?? null, decidedAt: now,
    });
    broker.emit({ type: 'deliverable_discarded', deliverable_id: d.id });
    return reply.send({ ok: true });
  });
};
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server/routes/deliverables.ts packages/server/src/server/routes/deliverables.test.ts
git commit -m "feat(routes): deliverables list + approve/return/discard with new revision spawn"
```

---

### Task 20: Rewrite server/routes/memory.ts (files + proposals)

**Files:**
- Rewrite: `packages/server/src/server/routes/memory.ts`
- Rewrite: `packages/server/src/server/routes/memory.test.ts`

Routes to implement:
- `GET /api/memory/clients/:slug/files` — list memory files (3 fixed names + which exist)
- `GET /api/memory/clients/:slug/:file` — read file (returns null if missing)
- `PUT /api/memory/clients/:slug/:file` — overwrite file (atomic + audit log; source `'user'`)
- `GET /api/memory/clients/:slug/proposals?status=pending` — list proposals
- `POST /api/memory/proposals/:id/approve` — apply proposal
- `POST /api/memory/proposals/:id/reject` — mark rejected
- `GET /api/memory/clients/:slug/:file/audit` — audit log for a file

Steps follow the standard TDD pattern from previous tasks. Use `readMemoryFile`, `writeMemoryFile`, `listPending`, `decideProposal` helpers. Include test for atomic-write `.tmp` cleanup and for invalid frontmatter rejection on PUT.

- [ ] **Step 1: Write failing test**

Test cases:
- GET files returns 3 entries with `exists` flag
- GET file returns content + frontmatter parsed for existing
- GET file returns 404 for missing
- PUT writes file + creates audit row with source='user'
- PUT rejects invalid frontmatter (400)
- GET proposals returns only pending
- POST approve writes file + marks proposal approved + audit row source='agent:director'
- POST reject does not write file

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement** following same pattern as briefs route, using helpers from `memory/`

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server/routes/memory.ts packages/server/src/server/routes/memory.test.ts
git commit -m "feat(routes): memory files + proposals + audit"
```

---

### Task 21: Modify server/routes/messages.ts and threads.ts; add auth middleware

**Files:**
- Modify: `packages/server/src/server/routes/messages.ts`
- Modify: `packages/server/src/server/routes/threads.ts`
- Create: `packages/server/src/server/auth-middleware.ts`
- Create: `packages/server/src/server/auth-middleware.test.ts`

- [ ] **Step 1: Write auth-middleware test + implementation (TDD)**

Test asserts:
- If `MARQUEE_API_TOKEN` env unset → POST endpoints pass without Authorization header
- If env set + matching `Authorization: Bearer <token>` → passes
- If env set + missing/mismatched → 401

Implementation:

```typescript
import type { FastifyPluginAsync } from 'fastify';

export const authMiddleware: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET') return;
    const expected = process.env.MARQUEE_API_TOKEN;
    if (!expected) return;
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${expected}`) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
};
```

- [ ] **Step 2: Modify messages.ts**

Routes:
- `POST /api/messages` — body: `{ thread_id, content }`. Insert human message + emit `chat_message` event. If Director is warm and idle, prompt the Director with the new message.
- `GET /api/messages?thread_id=...` — list messages for a thread.

- [ ] **Step 3: Modify threads.ts**

Routes:
- `POST /api/threads` — create new thread for default client. Returns `{ thread_id }`.
- `GET /api/threads` — list threads (active first).

In v1 we usually have one active thread; create one on first run if none exists.

- [ ] **Step 4: Run all route tests**

```bash
npx vitest run src/server/routes/
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server/auth-middleware.ts packages/server/src/server/auth-middleware.test.ts packages/server/src/server/routes/messages.ts packages/server/src/server/routes/threads.ts
git commit -m "feat(server): bearer-token auth + messages/threads routes"
```

---

## Phase 6 — N8n integration

### Task 22: Implement webhooks/n8n-outbound.ts

**Files:**
- Create: `packages/server/src/webhooks/n8n-outbound.ts`
- Create: `packages/server/src/webhooks/n8n-outbound.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fireDeliverableShipped } from './n8n-outbound.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
const fetchMock = vi.fn();
global.fetch = fetchMock as never;

beforeEach(async () => {
  fetchMock.mockReset();
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.briefs).values({ id: 'br_1', clientSlug: 'default', sourceThreadId: null, contentMd: '{}', status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now() });
  await db.insert(schema.delegations).values({ id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director', toAgent: 'social-manager', payloadJson: '{}', status: 'complete', requestedAt: Date.now(), completedAt: Date.now() });
  await db.insert(schema.deliverables).values({ id: 'dl_1', delegationId: 'del_1', clientSlug: 'default', type: 'social_post', status: 'shipped', currentRevisionId: 'rv_1', createdAt: Date.now(), updatedAt: Date.now() });
  await db.insert(schema.deliverableRevisions).values({ id: 'rv_1', deliverableId: 'dl_1', revisionNo: 1, artifactPath: '/tmp/fake.md', createdByAgent: 'social-manager', feedbackNote: null, ts: Date.now() });
});

describe('fireDeliverableShipped', () => {
  it('POSTs payload to webhook URL', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });
    await fireDeliverableShipped('http://n8n.example/webhook', db, 'dl_1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://n8n.example/webhook');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.event).toBe('deliverable_shipped');
    expect(body.deliverable_id).toBe('dl_1');
    expect(body.deliverable_type).toBe('social_post');
  });

  it('retries 3x with backoff on failure, then throws', async () => {
    fetchMock.mockRejectedValue(new Error('econnrefused'));
    await expect(fireDeliverableShipped('http://n8n.example/webhook', db, 'dl_1', { retryDelaysMs: [1, 1, 1] }))
      .rejects.toThrow(/econnrefused/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement**

```typescript
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { deliverables, deliverableRevisions } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;

export interface FireOpts {
  retryDelaysMs?: number[];
}

export async function fireDeliverableShipped(
  webhookUrl: string,
  db: Db,
  deliverableId: string,
  opts: FireOpts = {}
): Promise<void> {
  const d = (await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).all())[0];
  if (!d) throw new Error(`deliverable not found: ${deliverableId}`);
  const rev = (await db.select().from(deliverableRevisions).where(eq(deliverableRevisions.id, d.currentRevisionId!)).all())[0];
  let contentMd = '';
  let structured: Record<string, unknown> | null = null;
  try {
    const raw = await readFile(rev.artifactPath, 'utf8');
    contentMd = raw;
    const m = raw.match(/<!--\s*structured_data\s*([\s\S]*?)\s*-->/);
    if (m) structured = JSON.parse(m[1]);
  } catch { /* artifact missing — still send with empty content */ }

  const payload = {
    event: 'deliverable_shipped',
    deliverable_id: d.id,
    deliverable_type: d.type,
    client_slug: d.clientSlug,
    current_revision: rev.revisionNo,
    artifact_path: rev.artifactPath,
    content_md: contentMd,
    structured_data: structured,
    shipped_at: d.updatedAt,
    approved_by: 'human',
  };

  const delays = opts.retryDelaysMs ?? [1000, 5000, 30000];
  let lastErr: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < delays.length - 1) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/webhooks/
git commit -m "feat(webhooks): n8n outbound dispatcher with 3x retry backoff"
```

---

## Phase 7 — Skill loader + seed content

### Task 23: Update skills/loader.ts (role-scope + memory injection)

**Files:**
- Modify: `packages/server/src/skills/loader.ts`
- Modify: `packages/server/src/skills/loader.test.ts`

- [ ] **Step 1: Write failing test**

Test that:
- `loadSkillRecipes(dataDir, role)` returns concatenated markdown of all recipes in `<dataDir>/skills/<role>/*.md`
- Returns empty string if mappa missing
- Sorted by filename for stability

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement (replace existing if it does git/per-client)**

```typescript
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function loadSkillRecipes(dataDir: string, role: string): Promise<string> {
  const dir = join(dataDir, 'skills', role);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
  const parts: string[] = [];
  for (const f of files) {
    const c = await readFile(join(dir, f), 'utf8');
    parts.push(c);
  }
  return parts.join('\n\n---\n\n');
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/skills/loader.ts packages/server/src/skills/loader.test.ts
git commit -m "refactor(skills): role-scoped recipe loader"
```

---

### Task 24: Update agents/transform-context.ts (memory render with mustache)

**Files:**
- Modify: `packages/server/src/agents/transform-context.ts`
- Modify: `packages/server/src/agents/transform-context.test.ts`

- [ ] **Step 1: Write failing test**

Test:
- `renderMemoryContext(dataDir, clientSlug, role)` for each role returns string containing the right files
- Director gets profile + brand_voice + ongoing_campaigns
- Specialists get profile + brand_voice (no ongoing_campaigns)
- Returns block formatted as `<memory>...</memory>` xml-like wrapper

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement**

```typescript
import { readMemoryFile } from '../memory/read.js';
import { MEMORY_FILES, MemoryFile } from '../memory/validate.js';
import { RoleSlug } from './config.js';

const FILES_FOR_ROLE: Record<RoleSlug, MemoryFile[]> = {
  director: ['profile.md', 'brand_voice.md', 'ongoing_campaigns.md'],
  copywriter: ['profile.md', 'brand_voice.md'],
  'social-manager': ['profile.md', 'brand_voice.md'],
  'paid-specialist': ['profile.md', 'brand_voice.md'],
};

export async function renderMemoryContext(dataDir: string, clientSlug: string, role: RoleSlug): Promise<string> {
  const files = FILES_FOR_ROLE[role];
  const parts: string[] = [];
  for (const f of files) {
    const r = await readMemoryFile(dataDir, clientSlug, f);
    if (!r) continue;
    parts.push(`### memory/${f}\n${r.rawContent.trim()}`);
  }
  if (parts.length === 0) return '';
  return `<memory>\n${parts.join('\n\n')}\n</memory>`;
}

// Mustache-szerű string replace a skill recipe-kben.
// Példa: "{{memory.brand_voice.tone}}" → "barátságos-hozzáértő"
export async function applyMemoryTemplate(
  template: string, dataDir: string, clientSlug: string
): Promise<string> {
  // 1. Find all unique {{memory.<file>.<key>}} references
  const pattern = /\{\{\s*memory\.([a-z_]+)\.([a-z_]+)\s*\}\}/g;
  const referencedFiles = new Set<string>();
  for (const m of template.matchAll(pattern)) {
    referencedFiles.add(`${m[1]}.md`);
  }

  // 2. Load each referenced memory file once
  const cache: Record<string, Record<string, unknown>> = {};
  for (const f of referencedFiles) {
    const r = await readMemoryFile(dataDir, clientSlug, f);
    cache[f] = r?.frontmatter ?? {};
  }

  // 3. Replace with stringified value (or empty if missing)
  return template.replace(pattern, (_, file, key) => {
    const fm = cache[`${file}.md`];
    const value = fm?.[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  });
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/agents/transform-context.ts packages/server/src/agents/transform-context.test.ts
git commit -m "feat(agents): renderMemoryContext + applyMemoryTemplate"
```

---

### Task 25: Write seed content (3 memory templates + 8 skill recipes, all in Hungarian)

**Files:**
- Create: `packages/server/seed/memory/profile.md`
- Create: `packages/server/seed/memory/brand_voice.md`
- Create: `packages/server/seed/memory/ongoing_campaigns.md`
- Create: `packages/server/seed/skills/director/client_profile_setup.md`
- Create: `packages/server/seed/skills/director/brief_intake.md`
- Create: `packages/server/seed/skills/director/delegate.md`
- Create: `packages/server/seed/skills/copywriter/blog_post_writer.md`
- Create: `packages/server/seed/skills/copywriter/email_writer.md`
- Create: `packages/server/seed/skills/social-manager/social_post_writer.md`
- Create: `packages/server/seed/skills/paid-specialist/meta_ad_copy.md`
- Create: `packages/server/seed/skills/paid-specialist/google_ad_copy.md`

- [ ] **Step 1: Write `seed/memory/profile.md` template**

```markdown
---
business_description: ""
target_audience: []
usp: ""
competitors: []
---

<!-- Az ügyfél részletes profilja. A Director onboarding skill-je tölti fel
     az interjú során. Az operátor utólag bármikor szerkesztheti. -->
```

- [ ] **Step 2: Write `seed/memory/brand_voice.md` template** (similar empty frontmatter shell)

- [ ] **Step 3: Write `seed/memory/ongoing_campaigns.md` template** (`campaigns: []`)

- [ ] **Step 4: Write `seed/skills/director/client_profile_setup.md`** (the 6-question interview, content from spec section 6.6)

- [ ] **Step 5: Write `seed/skills/director/brief_intake.md`** — instrukciók a Directornak, hogyan vegyen át egy informális chat-üzenetet és alakítsa briefé. Magyar nyelvű. Tartalmazza: scope tisztázása kérdésekkel, deliverable_type és target_specialist felismerés, platform megadás amikor releváns, `propose_brief` hívás explicit instrukciója.

- [ ] **Step 6: Write `seed/skills/director/delegate.md`** — táblázat melyik specialist mit csinál + melyik deliverable_type-hoz melyik target_specialist megy.

- [ ] **Step 7: Write `seed/skills/copywriter/blog_post_writer.md`** — magyar instrukciók: brand voice betartás, struktúra (hook → 3-5 fő pont → CTA), 1500-2500 szó, SEO-tudatos, mustache template hivatkozás `{{memory.brand_voice.tone}}` etc.

- [ ] **Step 8: Write `seed/skills/copywriter/email_writer.md`** — subject + preheader + body + CTA, structured_data formátum.

- [ ] **Step 9: Write `seed/skills/social-manager/social_post_writer.md`** — platform-aware: Instagram (hook + lifestyle, visual_brief kötelező), LinkedIn (insight + tapasztalat), Twitter (rövid + tweet thread variáns), Threads. structured_data formátum platform szerint.

- [ ] **Step 10: Write `seed/skills/paid-specialist/meta_ad_copy.md`** — Meta ad limitek (headline 40, primary_text 125, description 30), 3-5 variáns, CTA opciók, audience_brief, visual_brief.

- [ ] **Step 11: Write `seed/skills/paid-specialist/google_ad_copy.md`** — Google Responsive Search Ads: 15 headline (30 char), 4 description (90 char).

- [ ] **Step 12: Commit**

```bash
git add packages/server/seed/
git commit -m "feat(seed): Hungarian memory templates + 8 skill recipes"
```

---

### Task 26: Update memory/seed.ts (copy seed templates on first run)

**Files:**
- Rewrite: `packages/server/src/memory/seed.ts`
- Create: `packages/server/src/memory/seed.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedClientIfNeeded } from './seed.js';

let dataDir: string;
let seedDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'marquee-data-'));
  seedDir = mkdtempSync(join(tmpdir(), 'marquee-seed-'));
  // Fake seed content
  mkdirSync(join(seedDir, 'memory'), { recursive: true });
  writeFileSync(join(seedDir, 'memory', 'profile.md'), '---\nbusiness_description: ""\ntarget_audience: []\nusp: ""\ncompetitors: []\n---\n', 'utf8');
  mkdirSync(join(seedDir, 'skills', 'director'), { recursive: true });
  writeFileSync(join(seedDir, 'skills', 'director', 'a.md'), 'director recipe', 'utf8');
});

describe('seedClientIfNeeded', () => {
  it('copies seed memory + skills on first run', async () => {
    await seedClientIfNeeded(dataDir, seedDir, 'default');
    expect(existsSync(join(dataDir, 'memory', 'clients', 'default', 'profile.md'))).toBe(true);
    expect(existsSync(join(dataDir, 'skills', 'director', 'a.md'))).toBe(true);
  });

  it('does not overwrite existing files', async () => {
    await seedClientIfNeeded(dataDir, seedDir, 'default');
    const path = join(dataDir, 'memory', 'clients', 'default', 'profile.md');
    writeFileSync(path, 'modified by user', 'utf8');
    await seedClientIfNeeded(dataDir, seedDir, 'default');
    expect(readFileSync(path, 'utf8')).toBe('modified by user');
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement**

```typescript
import { mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function seedClientIfNeeded(dataDir: string, seedDir: string, clientSlug: string): Promise<void> {
  // 1. Memory templates → memory/clients/<slug>/
  const memTarget = join(dataDir, 'memory', 'clients', clientSlug);
  await mkdir(memTarget, { recursive: true });
  for (const f of await readdir(join(seedDir, 'memory'))) {
    const target = join(memTarget, f);
    if (await exists(target)) continue;
    await copyFile(join(seedDir, 'memory', f), target);
  }
  // 2. Skill recipes → skills/<role>/
  for (const role of await readdir(join(seedDir, 'skills'))) {
    const roleTarget = join(dataDir, 'skills', role);
    await mkdir(roleTarget, { recursive: true });
    for (const f of await readdir(join(seedDir, 'skills', role))) {
      const target = join(roleTarget, f);
      if (await exists(target)) continue;
      await copyFile(join(seedDir, 'skills', role, f), target);
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/memory/seed.ts packages/server/src/memory/seed.test.ts
git commit -m "feat(memory): seed client memory + skills from package seed/ on first run"
```

---

## Phase 8 — Frontend rebuild

### Task 27: Rebuild App.tsx + TopNav (delete sidebar, drawer)

**Files:**
- Rewrite: `packages/web/src/App.tsx`
- Create: `packages/web/src/components/TopNav.tsx`
- Create: `packages/web/src/components/EmptyState.tsx`
- Create: `packages/web/src/lib/design.ts`

- [ ] **Step 1: Rewrite App.tsx**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/TopNav.js';
import { Workshop } from './views/Workshop.js';
import { Approvals } from './views/Approvals.js';
import { DeliverableDetail } from './views/DeliverableDetail.js';
import { Memory } from './views/Memory.js';

export function App() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <TopNav />
      <main className="max-w-screen-xl mx-auto px-8 py-6">
        <Routes>
          <Route path="/" element={<Workshop />} />
          <Route path="/jovahagyas" element={<Approvals />} />
          <Route path="/jovahagyas/:id" element={<DeliverableDetail />} />
          <Route path="/memoria" element={<Memory />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create TopNav.tsx with 3 items + count badge**

```tsx
import { NavLink } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function TopNav() {
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);
  return (
    <header className="border-b border-divider bg-parchment">
      <div className="max-w-screen-xl mx-auto px-8 h-14 flex items-center gap-6">
        <span className="font-serif text-lg font-semibold">MARQUEE</span>
        <nav className="flex gap-2 ml-4">
          <NavItem to="/" label="Műhely" />
          <NavItem to="/jovahagyas" label={`Jóváhagyás${pending > 0 ? ` (${pending})` : ''}`} />
          <NavItem to="/memoria" label="Memória" />
        </nav>
      </div>
    </header>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-md text-sm font-medium ${
          isActive ? 'bg-primary-soft text-primary-hover' : 'text-slate hover:bg-cream'
        }`
      }
    >
      {label}
    </NavLink>
  );
}
```

- [ ] **Step 3: Create EmptyState.tsx**

```tsx
export function EmptyState({ title, body, actionLabel, onAction }: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="border border-divider rounded-lg bg-surface-white p-8 text-center">
      <h2 className="font-serif text-xl mb-2">{title}</h2>
      <p className="text-slate mb-6">{body}</p>
      {actionLabel && onAction && (
        <button
          className="bg-primary text-on-primary px-4 py-2 rounded-md hover:bg-primary-hover"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd packages/web
npx tsc --noEmit
```

Expected: no errors (assumes Tailwind config has the design tokens; existing config from DESIGN.md should suffice).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/components/TopNav.tsx packages/web/src/components/EmptyState.tsx packages/web/src/lib/design.ts
git commit -m "feat(web): App + TopNav + EmptyState (no sidebar, no drawer)"
```

---

### Task 28: Build Workshop view (chat + composer + brief proposal cards)

**Files:**
- Create: `packages/web/src/views/Workshop.tsx`
- Create: `packages/web/src/components/ChatThread.tsx`
- Create: `packages/web/src/components/ChatComposer.tsx`
- Create: `packages/web/src/components/BriefProposalCard.tsx`
- Create: `packages/web/src/components/BulbIndicator.tsx`
- Modify: `packages/web/src/store/useMarqueeStore.ts`
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/lib/sse.ts`

- [ ] **Step 1: Implement Workshop.tsx**

```tsx
import { useEffect } from 'react';
import { ChatThread } from '../components/ChatThread.js';
import { ChatComposer } from '../components/ChatComposer.js';
import { EmptyState } from '../components/EmptyState.js';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function Workshop() {
  const { memoryEmpty, fetchInitialState, sendMessage } = useMarqueeStore();

  useEffect(() => { fetchInitialState(); }, [fetchInitialState]);

  if (memoryEmpty) {
    return (
      <EmptyState
        title="Üdv a Marquee-ban."
        body="Kezdjük az ügyfeled brand profiljának felépítésével. Beszélj a Directorral, ő végigvezet 6 kérdésen."
        actionLabel="Beszélgetés indítása"
        onAction={() => sendMessage('Segíts beállítani az ügyfél profilját')}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <ChatThread />
      <ChatComposer />
    </div>
  );
}
```

- [ ] **Step 2: Implement ChatThread.tsx**

Render messages array from store. For each message, dispatch by `type`:
- `chat` (sender director or human) → bubble
- `brief_proposal` → BriefProposalCard with Approve / Edit / Discard buttons
- `tool_call` → kompakt jelzés (`Director hívja: read_memory`)
- `tool_result` → elnyelni (a következő chat üzenet jön mindig)
- system messages → centered note

- [ ] **Step 3: Implement ChatComposer.tsx**

Textarea + Send button. On submit, calls `useMarqueeStore.sendMessage(text)`.

- [ ] **Step 4: Implement BriefProposalCard.tsx**

```tsx
import { useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function BriefProposalCard({ briefId, title, deliverableType, targetSpecialist, platform }: {
  briefId: string;
  title: string;
  deliverableType: string;
  targetSpecialist: string;
  platform?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const { dispatchBrief, discardBrief } = useMarqueeStore();
  return (
    <div className="border-2 border-primary rounded-lg p-6 bg-surface-white my-3">
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <div className="text-sm text-slate mt-1">
        Deliverable: <strong>{deliverableType}</strong>
        {platform && <span> · platform: {platform}</span>}
        <br />
        Specialista: <strong>{targetSpecialist}</strong>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          className="bg-primary text-on-primary px-4 py-2 rounded-md disabled:opacity-50"
          disabled={busy}
          onClick={async () => { setBusy(true); await dispatchBrief(briefId); setBusy(false); }}
        >
          Jóváhagy & dispatch
        </button>
        <button className="border border-divider-strong px-4 py-2 rounded-md text-ink-soft" disabled={busy}>
          Szerkeszt
        </button>
        <button
          className="px-3 py-2 rounded-md text-slate hover:bg-cream"
          disabled={busy}
          onClick={async () => { setBusy(true); await discardBrief(briefId); setBusy(false); }}
        >
          Eldob
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement BulbIndicator.tsx** (per DESIGN.md spec — 8px circle, amber when active)

- [ ] **Step 6: Update store, api, sse**

In `useMarqueeStore.ts`:
- State: `messages[]`, `awaitingApprovalCount`, `memoryEmpty`, `currentThreadId`
- Actions: `fetchInitialState()`, `sendMessage(text)`, `dispatchBrief(id)`, `discardBrief(id)`
- SSE handlers: on `chat_message` push, on `brief_proposed` insert as message of type 'brief_proposal', on `deliverable_submitted` increment awaitingApprovalCount, etc.

In `api.ts`: REST helpers for new endpoints (briefs CRUD/dispatch, deliverables list/approve/return, memory CRUD/proposals, messages, threads).

In `sse.ts`: subscribe to `/api/events`, dispatch event type to store handler.

- [ ] **Step 7: Verify build**

```bash
cd packages/web
npx tsc --noEmit
npm run build
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/views/Workshop.tsx packages/web/src/components/{ChatThread,ChatComposer,BriefProposalCard,BulbIndicator}.tsx packages/web/src/store/useMarqueeStore.ts packages/web/src/lib/{api,sse}.ts
git commit -m "feat(web): Workshop view with chat + brief proposal cards + SSE wiring"
```

---

### Task 29: Build Approvals view + DeliverableDetail + status/type badges

**Files:**
- Create: `packages/web/src/views/Approvals.tsx`
- Create: `packages/web/src/views/DeliverableDetail.tsx`
- Create: `packages/web/src/components/DeliverableRow.tsx`
- Create: `packages/web/src/components/DeliverableActions.tsx`
- Create: `packages/web/src/components/StatusBadge.tsx`
- Create: `packages/web/src/components/TypeBadge.tsx`
- Create: `packages/web/src/components/RevisionTabs.tsx`
- Create: `packages/web/src/components/SendBackModal.tsx`

- [ ] **Step 1: StatusBadge.tsx + TypeBadge.tsx**

```tsx
const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  drafting:           { text: 'Vázlat',           cls: 'bg-secondary-soft text-warning-deep' },
  awaiting_approval:  { text: 'Jóváhagyásra vár', cls: 'bg-primary-soft text-primary-hover' },
  shipped:            { text: 'Lezárva',          cls: 'bg-success-soft text-success-deep' },
  archived:           { text: 'Archív',           cls: 'bg-cream text-slate' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { text: status, cls: 'bg-cream text-slate' };
  return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${s.cls}`}>{s.text}</span>;
}

const TYPE_LABEL: Record<string, string> = {
  social_post: 'Social poszt',
  email: 'Email',
  blog_post: 'Blog poszt',
  ad_copy: 'Hirdetés szöveg',
};
export function TypeBadge({ type }: { type: string }) {
  return <span className="text-xs px-2.5 py-0.5 rounded-full bg-parchment text-ink-soft border border-divider">{TYPE_LABEL[type] ?? type}</span>;
}
```

- [ ] **Step 2: Approvals.tsx with filter dropdown + DeliverableRow**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { TypeBadge } from '../components/TypeBadge.js';

const FILTERS = [
  { value: 'awaiting_approval', label: 'Jóváhagyásra vár' },
  { value: 'all',               label: 'Mind' },
  { value: 'drafting',          label: 'Vázlat' },
  { value: 'shipped',           label: 'Lezárva' },
  { value: 'archived',          label: 'Archív' },
];

export function Approvals() {
  const [filter, setFilter] = useState('awaiting_approval');
  const { deliverables, fetchDeliverables } = useMarqueeStore();

  useEffect(() => {
    fetchDeliverables(filter === 'all' ? undefined : filter);
  }, [filter, fetchDeliverables]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-serif text-2xl">Jóváhagyás</h1>
        <select className="ml-auto border border-divider-strong rounded-md px-3 py-1.5 bg-surface-white" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <ul className="space-y-2">
        {deliverables.map((d) => (
          <li key={d.id}>
            <Link to={`/jovahagyas/${d.id}`} className="block bg-surface-white border border-divider rounded-lg px-4 py-3 hover:bg-parchment">
              <div className="flex items-center gap-3">
                <span className="font-medium">{d.id}</span>
                <TypeBadge type={d.type} />
                <StatusBadge status={d.status} />
                <span className="ml-auto text-sm text-slate">{new Date(d.updatedAt).toLocaleString('hu-HU')}</span>
              </div>
            </Link>
          </li>
        ))}
        {deliverables.length === 0 && <li className="text-slate text-center py-12">Nincs deliverable ebben a szűrőben.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: DeliverableDetail.tsx with revision tabs + actions**

(Implementation follows the same pattern: fetch via `GET /api/deliverables/:id`, render markdown of selected revision, render `DeliverableActions` if status is `awaiting_approval`.)

- [ ] **Step 4: DeliverableActions.tsx + SendBackModal.tsx**

3 buttons: Jóváhagy / Visszaküld / Eldob. SendBackModal shows textarea, calls `POST /api/deliverables/:id/return` with `{ note }`.

- [ ] **Step 5: RevisionTabs.tsx**

Renders tabs `Verzió N (jelenlegi) | Verzió N-1 | ...`. On click, switches the markdown render below.

- [ ] **Step 6: Verify build**

```bash
cd packages/web
npx tsc --noEmit && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/views/Approvals.tsx packages/web/src/views/DeliverableDetail.tsx packages/web/src/components/{DeliverableRow,DeliverableActions,StatusBadge,TypeBadge,RevisionTabs,SendBackModal}.tsx
git commit -m "feat(web): Approvals + DeliverableDetail with revision tabs and approve/return/discard"
```

---

### Task 30: Build Memory view (file list + editor + proposal queue)

**Files:**
- Rewrite: `packages/web/src/views/Memory.tsx`
- Create: `packages/web/src/components/MemoryFileList.tsx`
- Create: `packages/web/src/components/MemoryEditor.tsx`
- Create: `packages/web/src/components/MemoryProposalCard.tsx`

- [ ] **Step 1: Memory.tsx (split layout)**

Split: left sidebar `MemoryFileList`, right column has `MemoryProposalCard[]` (pending) on top + `MemoryEditor` for selected file below.

- [ ] **Step 2: MemoryFileList.tsx**

Lists 3 files with green dot if exists, gray if missing. Click selects.

- [ ] **Step 3: MemoryEditor.tsx**

Textarea full content + "Mentés" button. On save, `PUT /api/memory/clients/default/<file>`. Show server error inline if validation fails.

- [ ] **Step 4: MemoryProposalCard.tsx**

Side-by-side old/new content (collapsed/expandable), Approve/Reject buttons. POST to `/api/memory/proposals/:id/approve` or `/reject`.

- [ ] **Step 5: Verify build**

```bash
cd packages/web
npx tsc --noEmit && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/views/Memory.tsx packages/web/src/components/{MemoryFileList,MemoryEditor,MemoryProposalCard}.tsx
git commit -m "feat(web): Memory view with file editor + proposal queue"
```

---

## Phase 9 — Smoke + deploy + acceptance

### Task 31: Rewrite scripts/smoke.ts (end-to-end test)

**Files:**
- Rewrite: `packages/server/src/scripts/smoke.ts`

- [ ] **Step 1: Implement smoke script**

```typescript
import 'dotenv/config';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = `http://localhost:${process.env.PORT ?? 7892}`;

async function main() {
  console.log('🚀 Marquee smoke test');

  // 1. Create a thread
  const thread = await postJson('/api/threads', {});
  console.log(`✅ thread: ${thread.thread_id}`);

  // 2. Send a message that triggers Director to propose a brief
  await postJson('/api/messages', {
    thread_id: thread.thread_id,
    content: 'Kérek egy Instagram posztot a reggeli rituálé témára.',
  });
  console.log('📤 message sent, waiting for Director...');

  // 3. Poll until a draft brief shows up
  let brief: any = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const briefs = await getJson('/api/briefs');
    brief = briefs.find((b: any) => b.status === 'draft');
    if (brief) break;
  }
  if (!brief) throw new Error('no brief proposed within 120s');
  console.log(`✅ brief proposed: ${brief.id}`);

  // 4. Dispatch
  await postJson(`/api/briefs/${brief.id}/dispatch`, {});
  console.log('📨 dispatched, waiting for specialist...');

  // 5. Poll until awaiting_approval
  let deliverable: any = null;
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const ds = await getJson('/api/deliverables?status=awaiting_approval');
    if (ds.length > 0) { deliverable = ds[0]; break; }
  }
  if (!deliverable) throw new Error('no deliverable submitted within 180s');
  console.log(`✅ deliverable awaiting approval: ${deliverable.id}`);

  // 6. Approve
  await postJson(`/api/deliverables/${deliverable.id}/approve`, {});
  console.log(`✅ approved → shipped`);
  console.log('🎉 smoke OK');
}

async function postJson(path: string, body: unknown) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

async function getJson(path: string) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run smoke locally**

```bash
# Start the server in one terminal:
DATA_DIR=$HOME/.marquee-dev npm run dev

# In another terminal, run the smoke:
DATA_DIR=$HOME/.marquee-dev npm run smoke
```

Expected: prints success messages, no errors, takes ~30-90 seconds.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/scripts/smoke.ts
git commit -m "feat(scripts): rewrite smoke for new MVP flow"
```

---

### Task 32: First production deploy (mvp-redesign branch → VM 260)

**Files:**
- Verify: `scripts/deploy.sh`
- Verify: `infra/marquee.service`
- N/A: deploy operations

- [ ] **Step 1: Backup and stop on VM**

```bash
ssh balazs@192.168.2.60 'mv ~/.marquee ~/.marquee.v0.2-archive 2>/dev/null || true'
ssh balazs@192.168.2.60 'sudo systemctl stop marquee'
```

- [ ] **Step 2: Build locally + deploy**

```bash
cd ~/Projects/Homelab/marquee/.worktrees/mvp-redesign
npm run build
bash scripts/deploy.sh
```

Expected: rsync completes, npm install on VM completes, `systemctl restart marquee` returns 0.

- [ ] **Step 3: First-time OAuth setup on VM**

```bash
ssh balazs@192.168.2.60 'cd /opt/marquee && npm run auth:openai'
```

(This is interactive — opens browser flow. Tokens saved to `~/.marquee/auth.json`.)

- [ ] **Step 4: Restart service after auth**

```bash
ssh balazs@192.168.2.60 'sudo systemctl restart marquee'
ssh balazs@192.168.2.60 'sudo systemctl status marquee --no-pager | head -20'
```

Expected: status active (running).

- [ ] **Step 5: Verify health**

```bash
curl -fsS http://192.168.2.60:7892/api/health
```

Expected: `200 OK` with some health JSON.

- [ ] **Step 6: Test in browser**

Open `http://marquee.lab2.home.arpa` — empty state banner should appear.

- [ ] **Step 7: Run remote smoke**

```bash
ssh balazs@192.168.2.60 'cd /opt/marquee && PORT=7892 DATA_DIR=/home/balazs/.marquee npm run smoke'
```

Expected: smoke passes against the production instance.

- [ ] **Step 8: No commit (deploy operation only)**

---

### Task 33: Acceptance run (12-point checklist + 7-day reliability)

**Files:**
- N/A (verification activity)

- [ ] **Step 1: Run onboarding interactively**

In browser: trigger onboarding via empty state banner. Director walks through 6 questions in Hungarian. Approve at least 2 memory proposals.

Expected: `~/.marquee/memory/clients/default/profile.md` and `brand_voice.md` populated. Check via:

```bash
ssh balazs@192.168.2.60 'cat ~/.marquee/memory/clients/default/profile.md'
```

- [ ] **Step 2: Generate one of each deliverable type via chat**

```
"Kérek egy Instagram posztot a reggeli rituálé témára"   → social_post
"Kérek egy newsletter-t az új akcióhoz"                  → email
"Kérek egy blog posztot a bullet journal témáról"        → blog_post
"Kérek 3 Meta ad copy variánst a kupon-akcióhoz"         → ad_copy
```

Each should propose-brief → dispatch → submit → appear in approval queue. Approve all 4.

Expected: 4 deliverable, mind shipped.

- [ ] **Step 3: Test "visszaküld javításra" flow**

Pick one deliverable, return for changes with feedback "tegyük személyesebbé". Expect new revision (rev_002.md) and back to awaiting_approval. Approve.

Expected: deliverable has 2+ revisions.

- [ ] **Step 4: Set up an n8n flow that logs the webhook payload**

In n8n at `http://n8n.lab2.home.arpa`:
- Webhook trigger node + console log node
- Note the webhook URL
- SSH to VM and add to `.env`:

```bash
ssh balazs@192.168.2.60 'echo N8N_WEBHOOK_URL=http://192.168.2.30:5678/webhook/<id> >> /opt/marquee/.env && sudo systemctl restart marquee'
```

- [ ] **Step 5: Approve a new deliverable, verify n8n receives the webhook**

Expected: n8n logs show the `deliverable_shipped` payload.

- [ ] **Step 6: Test n8n inbound API**

Set `MARQUEE_API_TOKEN` in .env, restart, then from n8n use HTTP Request node to POST `/api/briefs` with bearer token.

Expected: brief created in Marquee.

- [ ] **Step 7: 7-day reliability run**

Leave the service running; check daily:

```bash
ssh balazs@192.168.2.60 'sudo systemctl status marquee --no-pager | head -5'
ssh balazs@192.168.2.60 'sudo journalctl -u marquee --since "1 day ago" | grep -i error | head -20'
```

Expected: status active throughout, no recurring errors.

- [ ] **Step 8: 1-week real-use bar**

Use Marquee daily for your own (or a test client's) marketing tasks. Approve at least 5 real deliverables that you'd actually publish.

Expected: 5+ shipped deliverables in the audit log:

```bash
ssh balazs@192.168.2.60 'sqlite3 ~/.marquee/state.db "SELECT type, status, datetime(updated_at/1000, \"unixepoch\") FROM deliverables WHERE status=\"shipped\" ORDER BY updated_at;"'
```

- [ ] **Step 9: Tick all 12 acceptance boxes in the spec**

Update the spec by checking off the acceptance criteria, commit:

```bash
cd ~/Projects/Homelab/marquee
# (or .worktrees/mvp-redesign — whichever branch you've decided is canonical at this point)
# Edit docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md, change [ ] to [x] on all 12 lines
git add docs/superpowers/specs/2026-04-29-marquee-mvp-redesign-design.md
git commit -m "docs: MVP acceptance checklist all green ✓"
```

- [ ] **Step 10: Decide on branch promotion**

If MVP fully accepted:
- Option A: Merge `mvp-redesign` into `master` (squash recommended given the strip commit history)
- Option B: Keep `mvp-redesign` as the new active branch, archive `master` to `master-v0.2`
- Document the decision in a follow-up commit

---

## End of plan

When all 33 tasks are complete and the 12-point acceptance checklist is fully ticked, the MVP is shipped. The `v0.2-final` git tag remains as a permanent reference point for the pre-redesign state.
