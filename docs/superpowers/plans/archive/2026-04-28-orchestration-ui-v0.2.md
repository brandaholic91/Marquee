# Orchestration UI v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete v0.1 gaps (Pipeline view, Eval/Revisions tabs, Memory inline editor, skill recipes), add 4 new agent roles (Distribution Lead, Insights Lead, Social Manager, SEO Analyst) with new deliverable types, and establish n8n bidirectional integration foundation with kanban drag-and-drop.

**Architecture:** Three sequential phases. Phase 1 fixes broken/missing UI and backend endpoints with no architectural changes. Phase 2 extends the tool registry, broker routing, and agent factory with 4 new roles — the framework is already in place. Phase 3 adds outbound webhook dispatch to the Broker and API token auth guard to the Fastify server, then wraps the Pipeline view in dnd-kit for drag-and-drop.

**Tech Stack:** Node.js 22, TypeScript, pi-agent-core, Fastify 5, better-sqlite3 + Drizzle, Zod, vitest, React 19, Vite, Tailwind, Zustand, @dnd-kit/core, simple-git

**Spec reference:** `docs/superpowers/specs/2026-04-28-orchestration-ui-v0.2.md`

---

## File map

### Backend — new/modified

| File | Change |
|---|---|
| `packages/server/src/server/routes/deliverables.ts` | Add `GET /:id/revisions`, `GET /:id/eval`, `PATCH /:id/status` |
| `packages/server/src/server/routes/deliverables.test.ts` | New — route tests for above |
| `packages/server/src/server/routes/memory.ts` | Add `GET /files`, `GET /:filename`, `PUT /:filename` |
| `packages/server/src/server/routes/memory.test.ts` | New — route tests for above |
| `packages/server/src/server/index.ts` | Add API token auth hook |
| `packages/server/src/tools/delegation.ts` | Extend KNOWN_LEADS + KNOWN_SPECIALISTS_BY_LEAD |
| `packages/server/src/tools/delegation.test.ts` | Extend with new role assertions |
| `packages/server/src/tools/deliverables.ts` | Add type allowlist to submit_deliverable |
| `packages/server/src/tools/deliverables.test.ts` | New — type validation test |
| `packages/server/src/tools/registry.ts` | Add 4 new roles |
| `packages/server/src/tools/registry.test.ts` | Extend snapshot test |
| `packages/server/src/broker/router.ts` | Add distribution-lead + insights-lead to WARM_ROLES + routing |
| `packages/server/src/broker/event-bus.ts` | Add N8N_WEBHOOK_URL outbound dispatch |
| `packages/server/src/skills/defaults/` | New directory — 13 skill recipe markdown files |
| `packages/server/src/skills/loader.ts` | Add `seedDefaultSkills()` function |
| `packages/server/src/index.ts` | Call `seedDefaultSkills(dataDir)` on startup |

### Frontend — new/modified

| File | Change |
|---|---|
| `packages/web/src/store/useAgencyStore.ts` | Add `"pipeline"` to currentView union |
| `packages/web/src/App.tsx` | Add `{currentView === "pipeline" && <PipelineView />}` |
| `packages/web/src/components/layout/Sidebar.tsx` | Wire pipeline nav to `setView("pipeline")` |
| `packages/web/src/views/pipeline.tsx` | New — kanban columns with dnd-kit |
| `packages/web/src/views/deliverable.tsx` | Wire Eval tab + Revisions tab to new endpoints |
| `packages/web/src/views/memory.tsx` | Add inline editor (Edit button + textarea + Save) |
| `packages/web/src/lib/api.ts` | Add `deliverables.revisions()`, `deliverables.eval()`, `deliverables.patchStatus()`, `memory.files()`, `memory.get()`, `memory.put()` |
| `packages/web/package.json` | Add `@dnd-kit/core` |

---

## Phase 1 — v0.1 Gaps

---

### Task 1: Deliverables — revisions list + eval endpoints

**Files:**
- Modify: `packages/server/src/server/routes/deliverables.ts`
- Create: `packages/server/src/server/routes/deliverables.test.ts`

- [ ] **Create the test file**

`packages/server/src/server/routes/deliverables.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import { delegations, deliverables, deliverableRevisions, evals } from "../../db/schema.js";
import type { AgentRouter } from "../../broker/router.js";

function makeTestDep() {
	const dir = mkdtempSync(join(tmpdir(), "agency-route-test-"));
	const { db, close } = openDb(join(dir, "test.db"));
	const broker = new Broker(db);
	const router = {} as AgentRouter;
	return { dir, db, close, broker, router };
}

async function makeApp(db: AgencyDb, broker: Broker, router: AgentRouter, dir: string) {
	return buildServer({ db, broker, router, dataDir: dir, webRoot: "/nonexistent" });
}

function seedDeliverable(db: AgencyDb, status = "awaiting_approval") {
	const dlgId = randomUUID();
	const delId = randomUUID();
	const revId = randomUUID();
	db.insert(delegations).values({
		id: dlgId, fromAgent: "director", toAgent: "content-lead",
		status: "complete", payloadJson: {} as never,
	}).run();
	db.insert(deliverables).values({
		id: delId, delegationId: dlgId, type: "blog_post",
		title: "Test Post", status, currentRevisionId: revId,
	}).run();
	db.insert(deliverableRevisions).values({
		id: revId, deliverableId: delId,
		artifactPath: "/dev/null", createdByAgent: "copywriter",
	}).run();
	return { dlgId, delId, revId };
}

describe("GET /api/deliverables/:id/revisions", () => {
	let deps: ReturnType<typeof makeTestDep>;

	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("returns revision list for a known deliverable", async () => {
		const { db, broker, router, dir } = deps;
		const { delId, revId } = seedDeliverable(db);
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/${delId}/revisions` });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string }[]>();
		expect(body).toHaveLength(1);
		expect(body[0].id).toBe(revId);
	});

	it("returns empty array for deliverable with no revisions", async () => {
		const { db, broker, router, dir } = deps;
		const dlgId = randomUUID(); const delId = randomUUID();
		db.insert(delegations).values({ id: dlgId, fromAgent: "director", toAgent: "content-lead", status: "complete", payloadJson: {} as never }).run();
		db.insert(deliverables).values({ id: delId, delegationId: dlgId, type: "blog_post", title: "T", status: "drafting" }).run();
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/${delId}/revisions` });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});
});

describe("GET /api/deliverables/:id/eval", () => {
	let deps: ReturnType<typeof makeTestDep>;

	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("returns null when no eval exists", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db);
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/${delId}/eval` });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toBeNull();
	});

	it("returns the latest eval record", async () => {
		const { db, broker, router, dir } = deps;
		const { delId, revId } = seedDeliverable(db);
		const evalId = randomUUID();
		db.insert(evals).values({
			id: evalId, revisionId: revId,
			scoresJson: { brand_voice: 4, factual_accuracy: 5, usp_usage: 3 } as never,
			summaryMd: "Good post",
		}).run();
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({ method: "GET", url: `/api/deliverables/${delId}/eval` });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string; summaryMd: string }>();
		expect(body.id).toBe(evalId);
		expect(body.summaryMd).toBe("Good post");
	});
});
```

- [ ] **Run — expect failures**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- --reporter=verbose 2>&1 | grep -A2 "deliverables.test"
```

Expected: `GET /api/deliverables/:id/revisions` and `GET /api/deliverables/:id/eval` tests fail (routes don't exist yet).

- [ ] **Add the two endpoints to `packages/server/src/server/routes/deliverables.ts`**

Add at the end of `registerDeliverableRoutes`, before the closing `}`:

```typescript
app.get<{ Params: { id: string } }>("/api/deliverables/:id/revisions", async (req) => {
    return opts.db
        .select()
        .from(deliverableRevisions)
        .where(eq(deliverableRevisions.deliverableId, req.params.id))
        .orderBy(deliverableRevisions.createdAt)
        .all();
});

app.get<{ Params: { id: string } }>("/api/deliverables/:id/eval", async (req) => {
    const d = opts.db
        .select()
        .from(deliverables)
        .where(eq(deliverables.id, req.params.id))
        .get();
    if (!d || !d.currentRevisionId) return null;
    return opts.db
        .select()
        .from(evals)
        .where(eq(evals.revisionId, d.currentRevisionId))
        .get() ?? null;
});
```

Add `evals` to the import at the top of the file:

```typescript
import { deliverableRevisions, deliverables, evals } from "../../db/schema.js";
```

- [ ] **Run — expect pass**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- --reporter=verbose 2>&1 | grep -A2 "deliverables.test"
```

Expected: all tests in `deliverables.test.ts` PASS.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/server/routes/deliverables.ts packages/server/src/server/routes/deliverables.test.ts
git commit -m "feat(api): add GET deliverables/:id/revisions and /:id/eval endpoints"
```

---

### Task 2: Deliverables — PATCH status endpoint

**Files:**
- Modify: `packages/server/src/server/routes/deliverables.ts`
- Modify: `packages/server/src/server/routes/deliverables.test.ts`

- [ ] **Add failing tests** — append to `deliverables.test.ts`:

```typescript
describe("PATCH /api/deliverables/:id/status", () => {
	let deps: ReturnType<typeof makeTestDep>;

	beforeEach(() => { deps = makeTestDep(); });
	afterEach(() => { deps.close(); rmSync(deps.dir, { recursive: true, force: true }); });

	it("transitions awaiting_approval → shipped", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db, "awaiting_approval");
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "PATCH",
			url: `/api/deliverables/${delId}/status`,
			headers: { "content-type": "application/json" },
			payload: { status: "shipped" },
		});
		expect(res.statusCode).toBe(200);
		const updated = db.select().from(deliverables).where(eq(deliverables.id, delId)).get();
		expect(updated?.status).toBe("shipped");
	});

	it("rejects an invalid transition (shipped → drafting)", async () => {
		const { db, broker, router, dir } = deps;
		const { delId } = seedDeliverable(db, "shipped");
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "PATCH",
			url: `/api/deliverables/${delId}/status`,
			headers: { "content-type": "application/json" },
			payload: { status: "drafting" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("returns 404 for unknown deliverable", async () => {
		const { db, broker, router, dir } = deps;
		const app = await makeApp(db, broker, router, dir);
		const res = await app.inject({
			method: "PATCH",
			url: `/api/deliverables/${randomUUID()}/status`,
			headers: { "content-type": "application/json" },
			payload: { status: "shipped" },
		});
		expect(res.statusCode).toBe(404);
	});
});
```

Also add `eq` and `deliverables` import note — `eq` is already imported in the route file, but the test file imports from schema directly. Add to test file imports:

```typescript
import { eq } from "drizzle-orm";
```

- [ ] **Run — expect failures**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- --reporter=verbose 2>&1 | grep -E "(PATCH|status)" | head -10
```

Expected: 3 PATCH tests fail.

- [ ] **Add PATCH endpoint to `packages/server/src/server/routes/deliverables.ts`**

Add the valid transitions map and handler inside `registerDeliverableRoutes`:

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
    drafting: ["awaiting_eval"],
    awaiting_eval: ["awaiting_approval", "drafting"],
    awaiting_approval: ["shipped", "drafting"],
    shipped: ["archived"],
    archived: [],
};

app.patch<{ Params: { id: string }; Body: { status: string } }>(
    "/api/deliverables/:id/status",
    async (req, reply) => {
        const d = opts.db
            .select()
            .from(deliverables)
            .where(eq(deliverables.id, req.params.id))
            .get();
        if (!d) return reply.code(404).send({ error: "not found" });
        const allowed = VALID_TRANSITIONS[d.status] ?? [];
        if (!allowed.includes(req.body.status)) {
            return reply.code(400).send({
                error: `cannot transition ${d.status} → ${req.body.status}`,
            });
        }
        opts.db
            .update(deliverables)
            .set({ status: req.body.status as typeof d.status, updatedAt: new Date() })
            .where(eq(deliverables.id, req.params.id))
            .run();
        opts.broker.emit("deliverable_status_changed", {
            deliverableId: req.params.id,
            from: d.status,
            to: req.body.status,
        });
        return { ok: true };
    },
);
```

- [ ] **Run — expect pass**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- --reporter=verbose 2>&1 | grep -E "✓|✗" | grep -i "status\|PATCH" | head -10
```

Expected: all 3 PATCH tests pass.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/server/routes/deliverables.ts packages/server/src/server/routes/deliverables.test.ts
git commit -m "feat(api): add PATCH deliverables/:id/status with valid transition guard"
```

---

### Task 3: Memory — file list, read, write endpoints

**Files:**
- Modify: `packages/server/src/server/routes/memory.ts`
- Create: `packages/server/src/server/routes/memory.test.ts`

- [ ] **Create the test file**

`packages/server/src/server/routes/memory.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import type { AgentRouter } from "../../broker/router.js";

async function makeTestApp() {
	const dir = mkdtempSync(join(tmpdir(), "agency-memory-test-"));
	const memDir = join(dir, "memory");
	mkdirSync(memDir, { recursive: true });
	// initialise git repo so writeMemoryFile can commit
	const git = simpleGit(dir);
	await git.init();
	await git.addConfig("user.name", "test");
	await git.addConfig("user.email", "test@test.com");
	const { db, close } = openDb(join(dir, "test.db"));
	const broker = new Broker(db);
	const router = {} as AgentRouter;
	const app = await buildServer({ db, broker, router, dataDir: dir, webRoot: "/nonexistent" });
	return { dir, memDir, close, app, cleanup: () => { close(); rmSync(dir, { recursive: true, force: true }); } };
}

describe("GET /api/memory/files", () => {
	it("returns empty array when no memory files", async () => {
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({ method: "GET", url: "/api/memory/files" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
		cleanup();
	});

	it("returns file names for existing .md files", async () => {
		const { memDir, app, cleanup } = await makeTestApp();
		writeFileSync(join(memDir, "client_profile.md"), "---\nclient_name: Stackly\n---\nbody");
		const res = await app.inject({ method: "GET", url: "/api/memory/files" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ name: string }[]>();
		expect(body.map((f) => f.name)).toContain("client_profile.md");
		cleanup();
	});
});

describe("GET /api/memory/:filename", () => {
	it("returns parsed frontmatter and body", async () => {
		const { memDir, app, cleanup } = await makeTestApp();
		writeFileSync(join(memDir, "client_profile.md"), "---\nclient_name: Stackly\n---\nBody text here");
		const res = await app.inject({ method: "GET", url: "/api/memory/client_profile.md" });
		expect(res.statusCode).toBe(200);
		const body = res.json<{ frontmatter: Record<string, unknown>; body: string }>();
		expect(body.frontmatter.client_name).toBe("Stackly");
		expect(body.body.trim()).toBe("Body text here");
		cleanup();
	});

	it("returns 404 for missing file", async () => {
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({ method: "GET", url: "/api/memory/nonexistent.md" });
		expect(res.statusCode).toBe(404);
		cleanup();
	});
});

describe("PUT /api/memory/:filename", () => {
	it("writes content and returns ok", async () => {
		const { memDir, app, cleanup } = await makeTestApp();
		writeFileSync(join(memDir, "client_profile.md"), "---\nclient_name: Old\n---\nold body");
		const res = await app.inject({
			method: "PUT",
			url: "/api/memory/client_profile.md",
			headers: { "content-type": "application/json" },
			payload: { content: "---\nclient_name: Stackly\n---\nnew body" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ ok: true });
		cleanup();
	});

	it("returns 400 for invalid YAML frontmatter", async () => {
		const { app, cleanup } = await makeTestApp();
		const res = await app.inject({
			method: "PUT",
			url: "/api/memory/client_profile.md",
			headers: { "content-type": "application/json" },
			payload: { content: "no frontmatter here" },
		});
		expect(res.statusCode).toBe(400);
		cleanup();
	});
});
```

- [ ] **Run — expect failures**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- --reporter=verbose 2>&1 | grep -E "memory\.test" | head -10
```

Expected: all 5 memory route tests fail.

- [ ] **Implement memory routes in `packages/server/src/server/routes/memory.ts`**

Replace the full file content:

```typescript
import { eq } from "drizzle-orm";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import matter from "gray-matter";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { memoryProposals } from "../../db/schema.js";
import { readMemoryFile } from "../../memory/read.js";

export function registerMemoryRoutes(app: FastifyInstance, opts: ServerOpts) {
	const memDir = () => join(opts.dataDir, "memory");

	// existing proposal endpoints
	app.get("/api/memory-proposals", async () =>
		opts.db.select().from(memoryProposals).all(),
	);

	app.post<{ Params: { id: string }; Body: { decision: "approved" | "rejected" } }>(
		"/api/memory-proposals/:id/approve",
		async (req) => {
			const { id } = req.params;
			const decision = req.body?.decision ?? "approved";
			opts.db.update(memoryProposals)
				.set({ status: decision === "approved" ? "approved" : "rejected" })
				.where(eq(memoryProposals.id, id))
				.run();
			opts.broker.emit("memory_proposal_decided", { proposalId: id, decision });
			return { ok: true };
		},
	);

	// new: list memory files
	app.get("/api/memory/files", async () => {
		const dir = memDir();
		if (!existsSync(dir)) return [];
		return readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.map((name) => ({ name }));
	});

	// new: read a memory file
	app.get<{ Params: { filename: string } }>("/api/memory/:filename", async (req, reply) => {
		const name = req.params.filename.replace(/\.md$/, "");
		const path = join(memDir(), `${name}.md`);
		if (!existsSync(path)) return reply.code(404).send({ error: "not found" });
		return readMemoryFile(opts.dataDir, name);
	});

	// new: write a memory file (inline editor)
	app.put<{ Params: { filename: string }; Body: { content: string } }>(
		"/api/memory/:filename",
		async (req, reply) => {
			const name = req.params.filename.replace(/\.md$/, "");
			const { content } = req.body;
			// require YAML frontmatter
			const parsed = matter(content);
			if (Object.keys(parsed.data).length === 0) {
				return reply.code(400).send({ error: "content must have YAML frontmatter" });
			}
			const dir = memDir();
			if (!existsSync(dir)) {
				const { mkdirSync } = await import("node:fs");
				mkdirSync(dir, { recursive: true });
			}
			const filePath = join(dir, `${name}.md`);
			writeFileSync(filePath, content, "utf8");
			try {
				const git = simpleGit(opts.dataDir);
				await git.add(filePath);
				await git.commit(`memory: update ${name}.md`, [filePath]);
			} catch {
				// git not initialised in test env — ignore
			}
			opts.broker.emit("memory_updated", { file: `${name}.md`, by: "human" });
			return { ok: true };
		},
	);
}
```

- [ ] **Run — expect pass**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- --reporter=verbose 2>&1 | grep -E "✓|✗" | grep -i memory | head -15
```

Expected: all 5 memory route tests pass.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/server/routes/memory.ts packages/server/src/server/routes/memory.test.ts
git commit -m "feat(api): add GET/PUT memory file endpoints for inline editor"
```

---

### Task 4: Skill recipe defaults — 5 files for existing roles + seeder

**Files:**
- Create: `packages/server/src/skills/defaults/director/brief_parser.md`
- Create: `packages/server/src/skills/defaults/director/lead_router.md`
- Create: `packages/server/src/skills/defaults/content-lead/editorial_brief_handoff.md`
- Create: `packages/server/src/skills/defaults/copywriter/blog_post_writer.md`
- Create: `packages/server/src/skills/defaults/eval-judge/three_dim_review.md`
- Modify: `packages/server/src/skills/loader.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Create `packages/server/src/skills/defaults/director/brief_parser.md`**

```markdown
---
name: brief_parser
when_to_use: When you receive a new brief from the human operator
---

Parse incoming briefs into a structured summary before routing.

Extract these fields from every brief:
- **Client**: Always Stackly ("The dashboard built for PLG SaaS")
- **Deliverable type**: blog_post | linkedin_post | landing_page | seo_report
- **Target audience**: PLG SaaS growth teams (10–100 person companies)
- **Key message**: One sentence — the core claim or insight
- **Deadline**: If stated; otherwise assume "next available"

Validate against Stackly's ICP: the content must be relevant to product-led growth metrics, SaaS dashboards, or PLG team workflows. If it is not, ask the human operator to clarify before routing.

Output a one-paragraph summary before calling delegate_to_lead.
```

- [ ] **Create `packages/server/src/skills/defaults/director/lead_router.md`**

```markdown
---
name: lead_router
when_to_use: After parsing a brief, to decide which lead(s) to delegate to
---

Routing rules for Stackly briefs:

| If brief asks for... | Delegate to |
|---|---|
| Blog post, article, long-form content | content-lead |
| LinkedIn post, social copy | distribution-lead |
| Landing page copy | distribution-lead |
| SEO keyword research, on-page audit | insights-lead |
| Multiple deliverables in one brief | Delegate to each relevant lead sequentially |

Always brief the lead with: the deliverable type, the target keyword or topic, the intended audience segment (e.g. "early-stage PLG founders"), and any hard constraints (word count, deadline, tone notes).

Never delegate to a specialist directly. Director speaks only to leads.
```

- [ ] **Create `packages/server/src/skills/defaults/content-lead/editorial_brief_handoff.md`**

```markdown
---
name: editorial_brief_handoff
when_to_use: When delegating a writing task to the copywriter
---

When briefing the copywriter for a Stackly blog post:

1. **Topic + angle**: State the H1 candidate and the PLG angle (e.g. "How to track activation rate in a PLG SaaS — for growth teams using fragmented tools")
2. **Target keyword**: Primary SEO keyword (if provided by insights-lead) or derive from topic
3. **Brand voice**: Terse, data-driven, no fluff. Reference style: Lenny's Newsletter, Reforge. Show, don't tell.
4. **Word count**: 1500–2000 words
5. **Structure**: Intro (hook + problem) → 3-4 H2 sections → CTA
6. **Stackly USP to weave in**: "The dashboard built for PLG SaaS" — mention naturally in context, not as an ad
7. **CTA**: Soft — invite readers to explore Stackly, no hard sell

Pass this brief verbatim to the copywriter using delegate_to_specialist.
```

- [ ] **Create `packages/server/src/skills/defaults/copywriter/blog_post_writer.md`**

```markdown
---
name: blog_post_writer
when_to_use: When your delegation is to write a blog_post deliverable
---

Write every Stackly blog post with this structure:

**H1**: Keyword-optimized, specific, no clickbait. Example: "How PLG SaaS Teams Track Activation Rate Without a Data Warehouse"

**Introduction (150–200 words)**:
- Open with a concrete problem statement ("Most PLG teams are working with 4 dashboards and none of them talk to each other.")
- State what the reader will learn
- No filler phrases ("In this article, we will...")

**Body (3–4 H2 sections, 300–400 words each)**:
- Each section answers one specific question
- Use real PLG metrics as examples: activation rate, PQL, expansion MRR, feature adoption
- Data-driven: cite specific numbers, even if illustrative ("teams using dedicated PLG dashboards report 2x faster experiment cycles")
- Short paragraphs, no walls of text

**Conclusion + CTA (100–150 words)**:
- Summarise the key insight in 2 sentences
- Soft CTA: "If you're building a PLG motion, [Stackly](https://stackly.io) was designed for exactly this." — keep it low-pressure

**Voice**: Lenny's Newsletter meets Reforge. Authoritative but not corporate. Use "you" not "one". No jargon without explanation.

Submit as submit_deliverable with type="blog_post".
```

- [ ] **Create `packages/server/src/skills/defaults/eval-judge/three_dim_review.md`**

```markdown
---
name: three_dim_review
when_to_use: When you receive a deliverable to evaluate
---

Score every deliverable on three dimensions, each 1–5:

**1. Brand voice illeszkedés**
- 5: Terse, data-driven, reads like Lenny's Newsletter. No fluff.
- 3: Mostly on-brand, a few generic sentences.
- 1: Generic marketing copy, over-promises, uses "leverage" or "synergy".

**2. Factual accuracy**
- 5: All claims verifiable or clearly illustrative. No hallucinated statistics.
- 3: Mostly sound, minor unsupported claims.
- 1: Specific statistics cited without source that seem fabricated.

**3. USP usage**
- 5: "PLG SaaS dashboard" wedge appears naturally and reinforces the content's message.
- 3: Stackly mentioned but the PLG angle is weak.
- 1: No mention of PLG or Stackly's specific positioning.

After scoring, write a 2-3 sentence summary explaining your scores.

If the total score is < 9 (out of 15), flag the specific issues clearly so the lead can re-brief the specialist.

Submit your evaluation using submit_eval_report.
```

- [ ] **Add `seedDefaultSkills()` to `packages/server/src/skills/loader.ts`**

Add this function at the bottom of the file:

```typescript
import { cpSync, existsSync as fsExists } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function seedDefaultSkills(dataDir: string): void {
	const defaultsDir = join(dirname(fileURLToPath(import.meta.url)), "defaults");
	const targetDir = join(dataDir, "skills");
	if (!fsExists(defaultsDir)) return; // no defaults bundled (e.g. test env)
	cpSync(defaultsDir, targetDir, { recursive: true, force: false }); // never overwrite custom skills
}
```

> Note: `force: false` with `cpSync` will not overwrite existing files — custom skills the user has placed in dataDir/skills/ are preserved.

- [ ] **Call seeder in `packages/server/src/index.ts`**

After `const dataDir = ...` line, add:

```typescript
import { seedDefaultSkills } from "./skills/loader.js";
```

Add after the `const dataDir` line:

```typescript
seedDefaultSkills(dataDir);
```

- [ ] **Verify seeder works**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
DATA_DIR=/tmp/marquee-seed-test npm run dev --workspace=packages/server &
sleep 3
ls /tmp/marquee-seed-test/skills/
kill %1
```

Expected: directories `director/`, `content-lead/`, `copywriter/`, `eval-judge/` appear.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/skills/defaults packages/server/src/skills/loader.ts packages/server/src/index.ts
git commit -m "feat(skills): add default skill recipes for 4 existing roles + startup seeder"
```

---

### Task 5: Frontend — api.ts additions for new endpoints

**Files:**
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Add new methods to `api.ts`**

In the `deliverables` section, add:

```typescript
revisions: (id: string) =>
  fetch(`/api/deliverables/${id}/revisions`).then(json),
eval: (id: string) =>
  fetch(`/api/deliverables/${id}/eval`).then(json),
patchStatus: (id: string, status: string) =>
  fetch(`/api/deliverables/${id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  }).then(json),
```

In the `memory` section (replace the existing object):

```typescript
memory: {
  files: () => fetch("/api/memory/files").then(json),
  get: (filename: string) => fetch(`/api/memory/${filename}`).then(json),
  put: (filename: string, content: string) =>
    fetch(`/api/memory/${filename}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    }).then(json),
  proposals: () => fetch("/api/memory-proposals").then(json),
  approve: (id: string) =>
    fetch(`/api/memory-proposals/${id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved" }),
    }).then(json),
  reject: (id: string) =>
    fetch(`/api/memory-proposals/${id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "rejected" }),
    }).then(json),
},
```

- [ ] **Verify TypeScript compiles**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run build --workspace=packages/web 2>&1 | grep -i error | head -10
```

Expected: 0 errors.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/web/src/lib/api.ts
git commit -m "feat(web): add api client methods for revisions, eval, status, memory CRUD"
```

---

### Task 6: Frontend — Pipeline view

**Files:**
- Modify: `packages/web/src/store/useAgencyStore.ts`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/components/layout/Sidebar.tsx`
- Create: `packages/web/src/views/pipeline.tsx`

- [ ] **Extend Zustand store** — in `useAgencyStore.ts`, change the `currentView` type:

```typescript
currentView: "home" | "chat" | "deliverable" | "memory" | "onboarding" | "pipeline";
```

- [ ] **Wire Sidebar pipeline nav** — in `Sidebar.tsx`, update `handleNav`:

```typescript
function handleNav(id: NavId) {
  if (id === "home" || id === "memory" || id === "pipeline") {
    setView(id);
  }
}
```

- [ ] **Add pipeline route in `App.tsx`**

Add import:
```typescript
import { PipelineView } from "./views/pipeline";
```

Add render line after `{currentView === "memory" && <MemoryView />}`:
```typescript
{currentView === "pipeline" && <PipelineView />}
```

- [ ] **Create `packages/web/src/views/pipeline.tsx`**

```tsx
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import { useAgencyStore } from "../store/useAgencyStore.js";
import { Sidebar } from "../components/layout/Sidebar.js";

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt?: string;
}

const COLUMNS = [
  { status: "drafting", label: "Drafting" },
  { status: "awaiting_eval", label: "Awaiting Eval" },
  { status: "awaiting_approval", label: "Awaiting Approval" },
  { status: "shipped", label: "Shipped" },
  { status: "archived", label: "Archived" },
];

const STATUS_COLOR: Record<string, string> = {
  drafting: "var(--neutral-mid)",
  awaiting_eval: "var(--primary)",
  awaiting_approval: "var(--accent)",
  shipped: "var(--success, #2d7a4f)",
  archived: "var(--neutral-mid)",
};

export function PipelineView() {
  const setView = useAgencyStore((s) => s.setView);
  const setSelectedDeliverable = useAgencyStore((s) => s.setSelectedDeliverable);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);

  const load = useCallback(() => {
    api.deliverables.list().then((rows: Deliverable[]) => setDeliverables(rows));
  }, []);

  useEffect(() => { load(); }, [load]);

  const byStatus = (status: string) =>
    deliverables.filter((d) => d.status === status);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="pipeline" />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px 12px", borderBottom: "1px solid var(--rule)", flexShrink: 0 }}>
          <div className="headline-md">Pipeline</div>
          <div className="body-sm" style={{ marginTop: 2 }}>
            {deliverables.length} deliverable{deliverables.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Columns */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", gap: 16 }}>
          {COLUMNS.map(({ status, label }) => {
            const cards = byStatus(status);
            return (
              <div
                key={status}
                style={{
                  minWidth: 240, maxWidth: 280, flexShrink: 0,
                  display: "flex", flexDirection: "column", gap: 8,
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: STATUS_COLOR[status],
                    }}
                  />
                  <span className="caption" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {label}
                  </span>
                  <span className="caption" style={{ marginLeft: "auto", opacity: 0.5 }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                {cards.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDeliverable(d.id)}
                    style={{
                      background: "var(--parchment)",
                      border: "1px solid var(--rule)",
                      borderRadius: 8,
                      padding: "12px 14px",
                      cursor: "pointer",
                    }}
                  >
                    <div className="body-sm" style={{ fontWeight: 500, marginBottom: 4 }}>
                      {d.title}
                    </div>
                    <div className="caption" style={{ opacity: 0.6 }}>
                      {d.type.replace(/_/g, " ")}
                    </div>
                  </div>
                ))}

                {cards.length === 0 && (
                  <div className="caption" style={{ opacity: 0.35, padding: "8px 2px" }}>
                    Empty
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Start dev server and manually verify**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
set -a && source .env && set +a && DATA_DIR=~/.marquee-dev npm run dev
```

Open http://localhost:5173, click "Pipeline" in sidebar — columns should appear without errors. Navigate to a deliverable card → opens deliverable detail view.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/web/src/store/useAgencyStore.ts packages/web/src/App.tsx packages/web/src/components/layout/Sidebar.tsx packages/web/src/views/pipeline.tsx
git commit -m "feat(web): add Pipeline view with deliverable kanban columns"
```

---

### Task 7: Frontend — Deliverable eval + revisions tabs

**Files:**
- Modify: `packages/web/src/views/deliverable.tsx`

The deliverable view already has tab switching logic. Find the Eval tab and Revisions tab sections and wire them up.

- [ ] **Find and update Eval tab in `deliverable.tsx`**

Search for the eval tab placeholder (look for "eval" or "Eval" in the render). Replace the placeholder content with:

```tsx
// At the top of the component or inside the component, add state:
const [evalData, setEvalData] = useState<{
  id: string;
  scoresJson: { brand_voice: number; factual_accuracy: number; usp_usage: number };
  summaryMd: string;
} | null>(null);

// In a useEffect watching the active tab or deliverable ID:
useEffect(() => {
  if (activeTab === "eval" && deliverableId) {
    api.deliverables.eval(deliverableId).then(setEvalData);
  }
}, [activeTab, deliverableId]);
```

Replace eval tab placeholder content with:

```tsx
{activeTab === "eval" && (
  <div style={{ padding: "20px 24px" }}>
    {evalData == null ? (
      <div className="body-sm" style={{ opacity: 0.5 }}>Pending evaluation</div>
    ) : (
      <>
        <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
          {Object.entries(evalData.scoresJson).map(([key, score]) => (
            <div key={key} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{score}<span style={{ fontSize: 14, opacity: 0.5 }}>/5</span></div>
              <div className="caption" style={{ marginTop: 2 }}>{key.replace(/_/g, " ")}</div>
            </div>
          ))}
        </div>
        <div className="body-sm" style={{ whiteSpace: "pre-wrap" }}>{evalData.summaryMd}</div>
      </>
    )}
  </div>
)}
```

> Note: `activeTab`, `deliverableId` variable names may differ in the existing component — match the existing naming in `deliverable.tsx`.

- [ ] **Find and update Revisions tab in `deliverable.tsx`**

Add state for revisions list:

```tsx
const [revisions, setRevisions] = useState<Array<{
  id: string; createdByAgent: string; createdAt: string; artifactPath: string;
}>>([]);

useEffect(() => {
  if (activeTab === "revisions" && deliverableId) {
    api.deliverables.revisions(deliverableId).then(setRevisions);
  }
}, [activeTab, deliverableId]);
```

Replace revisions tab placeholder content with:

```tsx
{activeTab === "revisions" && (
  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
    {revisions.length === 0 ? (
      <div className="body-sm" style={{ opacity: 0.5 }}>No revisions yet</div>
    ) : (
      revisions.map((r, i) => (
        <div
          key={r.id}
          style={{
            padding: "10px 14px", borderRadius: 6,
            background: r.id === currentRevisionId ? "var(--primary-soft)" : "var(--parchment)",
            border: "1px solid var(--rule)", cursor: "pointer",
          }}
          onClick={() => api.deliverables.revision(deliverableId, r.id).then((rev) => setRevision(rev))}
        >
          <div className="body-sm" style={{ fontWeight: 500 }}>Revision {i + 1}</div>
          <div className="caption" style={{ opacity: 0.6, marginTop: 2 }}>
            by {r.createdByAgent} · {new Date(r.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))
    )}
  </div>
)}
```

> Note: `currentRevisionId`, `setRevision` variable names — match existing naming in `deliverable.tsx`.

- [ ] **Start dev server and manually verify**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
set -a && source .env && set +a && DATA_DIR=~/.marquee-dev npm run dev
```

Open a deliverable detail view, click Eval tab (shows "Pending evaluation" if no eval), click Revisions tab (shows revision list or "No revisions yet").

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/web/src/views/deliverable.tsx
git commit -m "feat(web): wire Eval tab and Revisions tab to backend endpoints"
```

---

### Task 8: Frontend — Memory inline editor

**Files:**
- Modify: `packages/web/src/views/memory.tsx`

- [ ] **Add editing state to the memory view**

In `memory.tsx`, find the `MemoryFileContent` state and detail panel. Add:

```tsx
const [editing, setEditing] = useState(false);
const [editContent, setEditContent] = useState("");
const [saving, setSaving] = useState(false);
```

- [ ] **Add Edit button to the detail panel header**

Find the area where the selected file's content is shown. After the file title/header, add:

```tsx
{!editing && (
  <button
    onClick={() => {
      setEditContent(fileContent?.raw ?? "");
      setEditing(true);
    }}
    style={{
      padding: "4px 12px", borderRadius: 4, fontSize: 13,
      background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
    }}
  >
    Edit
  </button>
)}
```

> `fileContent` is whatever the state variable holding the loaded file content is named — match existing naming.

- [ ] **Replace content display with editor when `editing === true`**

Where the file body is rendered, wrap it:

```tsx
{editing ? (
  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
    <textarea
      value={editContent}
      onChange={(e) => setEditContent(e.target.value)}
      style={{
        flex: 1, minHeight: 300, fontFamily: "var(--font-mono, monospace)", fontSize: 13,
        padding: 12, borderRadius: 4, border: "1px solid var(--rule)",
        background: "var(--parchment)", resize: "vertical",
      }}
    />
    <div style={{ display: "flex", gap: 8 }}>
      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await api.memory.put(selectedFile + ".md", editContent);
            setEditing(false);
            // reload file content
            const fresh = await api.memory.get(selectedFile + ".md");
            setFileContent(fresh);
          } finally {
            setSaving(false);
          }
        }}
        style={{
          padding: "6px 16px", borderRadius: 4, background: "var(--primary)",
          color: "#fff", border: "none", cursor: saving ? "wait" : "pointer",
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        onClick={() => setEditing(false)}
        style={{
          padding: "6px 16px", borderRadius: 4, background: "transparent",
          color: "var(--ink)", border: "1px solid var(--rule)", cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  </div>
) : (
  /* existing body render */
)}
```

> Replace `selectedFile`, `setFileContent` with the actual state variable names from `memory.tsx`.

- [ ] **Start dev server and manually verify**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
set -a && source .env && set +a && DATA_DIR=~/.marquee-dev npm run dev
```

Open Memory view, select a file, click Edit — textarea should appear with current content. Edit something, click Save — file should update (check `~/.marquee-dev/memory/` and `git log` in that directory).

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/web/src/views/memory.tsx
git commit -m "feat(web): add inline markdown editor to Memory view"
```

---

## Phase 2 — 4 New Roles

---

### Task 9: Extend delegation tools for new leads + specialists

**Files:**
- Modify: `packages/server/src/tools/delegation.ts`
- Modify: `packages/server/src/tools/delegation.test.ts`

- [ ] **Add failing tests** — append to `delegation.test.ts`:

```typescript
describe("delegate_to_lead — new leads", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-tools-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("accepts distribution-lead", async () => {
		const result = await delegateToLead.execute(
			{ lead: "distribution-lead", task: "write linkedin post" },
			{ db, agentSlug: "director", agentSessionId: randomUUID(), emit: vi.fn() },
		);
		expect(result.delegationId).toBeDefined();
	});

	it("accepts insights-lead", async () => {
		const result = await delegateToLead.execute(
			{ lead: "insights-lead", task: "seo keyword research" },
			{ db, agentSlug: "director", agentSessionId: randomUUID(), emit: vi.fn() },
		);
		expect(result.delegationId).toBeDefined();
	});
});

describe("delegate_to_specialist — distribution-lead", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-tools-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("distribution-lead can delegate to social-manager", async () => {
		const result = await delegateToSpecialist.execute(
			{ specialist: "social-manager", task: "write linkedin post" },
			{ db, agentSlug: "distribution-lead", agentSessionId: randomUUID(), emit: vi.fn() },
		);
		expect(result.delegationId).toBeDefined();
	});

	it("content-lead cannot delegate to social-manager", async () => {
		await expect(
			delegateToSpecialist.execute(
				{ specialist: "social-manager", task: "x" },
				{ db, agentSlug: "content-lead", agentSessionId: randomUUID(), emit: vi.fn() },
			),
		).rejects.toThrow(/cannot delegate/i);
	});

	it("insights-lead can delegate to seo-analyst", async () => {
		const result = await delegateToSpecialist.execute(
			{ specialist: "seo-analyst", task: "keyword research for PLG dashboard" },
			{ db, agentSlug: "insights-lead", agentSessionId: randomUUID(), emit: vi.fn() },
		);
		expect(result.delegationId).toBeDefined();
	});
});
```

- [ ] **Run — expect failures**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- --reporter=verbose 2>&1 | grep -E "✗|new leads|distribution" | head -10
```

Expected: 4 new tests fail.

- [ ] **Update `delegation.ts`** — replace KNOWN_LEADS and KNOWN_SPECIALISTS_BY_LEAD:

```typescript
const KNOWN_LEADS = new Set(["content-lead", "distribution-lead", "insights-lead"]);
const KNOWN_SPECIALISTS_BY_LEAD: Record<string, Set<string>> = {
	"content-lead": new Set(["copywriter"]),
	"distribution-lead": new Set(["social-manager"]),
	"insights-lead": new Set(["seo-analyst"]),
};
```

- [ ] **Run — expect pass**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- delegation.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all delegation tests pass.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/tools/delegation.ts packages/server/src/tools/delegation.test.ts
git commit -m "feat(tools): extend delegation to accept distribution-lead, insights-lead, social-manager, seo-analyst"
```

---

### Task 10: Extend submit_deliverable for new types + update tool registry

**Files:**
- Modify: `packages/server/src/tools/deliverables.ts`
- Create: `packages/server/src/tools/deliverables.test.ts`
- Modify: `packages/server/src/tools/registry.ts`
- Modify: `packages/server/src/tools/registry.test.ts`

- [ ] **Create `packages/server/src/tools/deliverables.test.ts`** (it likely exists — check, and if so extend it; otherwise create):

```typescript
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../db/index.js";
import { delegations } from "../db/schema.js";
import { makeSubmitDeliverable } from "./deliverables.js";

describe("submit_deliverable — type validation", () => {
	let dir: string;
	let close: () => void;
	let db: ReturnType<typeof openDb>["db"];

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-del-test-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		// seed a delegation so delegationId is valid
		db.insert(delegations).values({
			id: "dlg-1", fromAgent: "distribution-lead", toAgent: "social-manager",
			status: "in_progress", payloadJson: {} as never,
		}).run();
	});

	afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

	it("accepts linkedin_post type", async () => {
		const tool = makeSubmitDeliverable(dir);
		const result = await tool.execute(
			{ type: "linkedin_post", title: "PLG metrics post", contentMd: "A".repeat(50) },
			{ db, agentSlug: "social-manager", agentSessionId: randomUUID(), delegationId: "dlg-1", emit: () => {} },
		);
		expect(result.deliverableId).toBeDefined();
	});

	it("accepts landing_page type", async () => {
		const tool = makeSubmitDeliverable(dir);
		const result = await tool.execute(
			{ type: "landing_page", title: "Stackly PLG Landing", contentMd: "B".repeat(50) },
			{ db, agentSlug: "copywriter", agentSessionId: randomUUID(), delegationId: "dlg-1", emit: () => {} },
		);
		expect(result.deliverableId).toBeDefined();
	});

	it("accepts seo_report type", async () => {
		const tool = makeSubmitDeliverable(dir);
		const result = await tool.execute(
			{ type: "seo_report", title: "PLG keyword research", contentMd: "C".repeat(50) },
			{ db, agentSlug: "seo-analyst", agentSessionId: randomUUID(), delegationId: "dlg-1", emit: () => {} },
		);
		expect(result.deliverableId).toBeDefined();
	});
});
```

Note: `submit_deliverable` already accepts any string type — these tests confirm the new types work end-to-end (artifact written, DB record created). No code change needed for `deliverables.ts` unless there's a type validation added.

- [ ] **Run — expect pass** (these should pass without changes since type is `z.string()`):

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- deliverables.test.ts --reporter=verbose 2>&1 | tail -15
```

Expected: all 3 type tests pass.

- [ ] **Add failing test for registry** — in `registry.test.ts`, add:

```typescript
it("distribution-lead has delegate_to_specialist and submit_to_director tools", () => {
  const tools = toolsForRole("distribution-lead", "/tmp");
  const names = tools.map((t) => t.name);
  expect(names).toContain("delegate_to_specialist");
  expect(names).toContain("submit_to_director");
  expect(names).not.toContain("delegate_to_lead"); // leads don't delegate upward
});

it("social-manager has submit_deliverable but not delegate_to_specialist", () => {
  const tools = toolsForRole("social-manager", "/tmp");
  const names = tools.map((t) => t.name);
  expect(names).toContain("submit_deliverable");
  expect(names).not.toContain("delegate_to_specialist");
});

it("seo-analyst has submit_deliverable but not delegate_to_specialist", () => {
  const tools = toolsForRole("seo-analyst", "/tmp");
  const names = tools.map((t) => t.name);
  expect(names).toContain("submit_deliverable");
  expect(names).not.toContain("delegate_to_specialist");
});

it("insights-lead has delegate_to_specialist", () => {
  const tools = toolsForRole("insights-lead", "/tmp");
  expect(tools.map((t) => t.name)).toContain("delegate_to_specialist");
});
```

- [ ] **Run — expect failures** on the 4 new registry tests:

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- registry.test.ts --reporter=verbose 2>&1 | tail -20
```

- [ ] **Update `registry.ts`** — add 4 new roles to the switch:

```typescript
case "distribution-lead":
    return [delegateToSpecialist, submitToDirector, readMemory, requestInput] as never;
case "insights-lead":
    return [delegateToSpecialist, submitToDirector, readMemory, requestInput] as never;
case "social-manager":
    return [submitDeliverable, respondToLead, readMemory, proposeMemoryUpdate, webFetch] as never;
case "seo-analyst":
    return [submitDeliverable, respondToLead, readMemory, webFetch] as never;
```

- [ ] **Run — expect pass**:

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- registry.test.ts --reporter=verbose 2>&1 | tail -15
```

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/tools/deliverables.test.ts packages/server/src/tools/registry.ts packages/server/src/tools/registry.test.ts
git commit -m "feat(tools): add 4 new roles to tool registry + deliverable type tests"
```

---

### Task 11: Agent router — add new warm roles + routing

**Files:**
- Modify: `packages/server/src/broker/router.ts`

- [ ] **Update `WARM_ROLES` constant** — change:

```typescript
const WARM_ROLES = ["director", "content-lead", "eval-judge", "distribution-lead", "insights-lead"] as const;
```

- [ ] **Add routing for new delegation targets** — in the `onEvent` method, find the `if (to === "content-lead")` block and extend the pattern. After the content-lead block, add:

```typescript
if (to === "distribution-lead") {
    const agent = this.warmAgents.get("distribution-lead");
    if (!agent) return;
    const message = parts.join("\n");
    void agent.waitForIdle().then(() =>
        agent.prompt(message).catch(console.error),
    );
    return;
}

if (to === "insights-lead") {
    const agent = this.warmAgents.get("insights-lead");
    if (!agent) return;
    const message = parts.join("\n");
    void agent.waitForIdle().then(() =>
        agent.prompt(message).catch(console.error),
    );
    return;
}

if (to === "social-manager" || to === "seo-analyst") {
    this.spawnAndPrompt(to, delegationId, parts.join("\n"));
    return;
}
```

- [ ] **Verify startup works**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
set -a && source .env && set +a && DATA_DIR=~/.marquee-dev npm run dev --workspace=packages/server &
sleep 5
curl -s http://localhost:7892/api/health | python3 -m json.tool
kill %1
```

Expected: health endpoint returns 200 with no errors in server output.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/broker/router.ts
git commit -m "feat(broker): add distribution-lead, insights-lead to warm roles + routing"
```

---

### Task 12: Skill recipe defaults — 8 files for new roles

**Files:**
- Create: `packages/server/src/skills/defaults/distribution-lead/linkedin_brief_coordinator.md`
- Create: `packages/server/src/skills/defaults/distribution-lead/landing_page_coordinator.md`
- Create: `packages/server/src/skills/defaults/insights-lead/seo_insights_coordinator.md`
- Create: `packages/server/src/skills/defaults/insights-lead/keyword_brief.md`
- Create: `packages/server/src/skills/defaults/social-manager/linkedin_post_writer.md`
- Create: `packages/server/src/skills/defaults/seo-analyst/keyword_research.md`
- Create: `packages/server/src/skills/defaults/seo-analyst/on_page_audit.md`
- Create: `packages/server/src/skills/defaults/eval-judge/three_dim_review_extended.md`

- [ ] **Create `distribution-lead/linkedin_brief_coordinator.md`**

```markdown
---
name: linkedin_brief_coordinator
when_to_use: When your delegation is to produce a LinkedIn post
---

Brief the social-manager with these specifics for every Stackly LinkedIn post:

1. **Hook**: The opening line must stop the scroll. Options: a surprising statistic, a contrarian take on a common PLG belief, or a concrete "before/after" scenario.
2. **Core insight**: One specific PLG insight (activation rate tracking, PQL definition, expansion MRR) — not a general "data is important" statement.
3. **Format**: Short paragraphs (1–2 sentences), generous white space. LinkedIn rewards skimmable content.
4. **Length**: 800–1200 characters (not words). Optimal for LinkedIn algorithm.
5. **CTA**: Soft — one question to the audience OR a link to the Stackly blog post this is repurposing.
6. **Hashtags**: 3 max — #PLG #ProductLedGrowth #SaaS — at the very end, not in the body.

Delegate to social-manager with these instructions included verbatim.
```

- [ ] **Create `distribution-lead/landing_page_coordinator.md`**

```markdown
---
name: landing_page_coordinator
when_to_use: When your delegation is to produce a landing_page deliverable
---

For Stackly landing pages, delegate to the copywriter (via content-lead, or request a direct delegation if available). Brief the copywriter with:

**Page structure:**
1. Hero: H1 (PLG-specific claim) + subheadline + CTA button ("See a demo" or "Start free")
2. Problem section: 3 pain points that PLG teams face with fragmented dashboards
3. Solution section: How Stackly solves each pain point — specific feature callouts
4. Social proof: 2–3 customer quotes (placeholder: [QUOTE NEEDED])
5. Pricing tease: Mention tiers without hard-selling
6. Closing CTA

**Voice**: Direct and specific. No "revolutionize your workflow". Every sentence must justify its presence.

**SEO**: Request primary keyword from insights-lead before briefing if not provided in your delegation.
```

- [ ] **Create `insights-lead/seo_insights_coordinator.md`**

```markdown
---
name: seo_insights_coordinator
when_to_use: When your delegation is to provide SEO insights for a content brief
---

Coordinate keyword research and on-page guidance for Stackly content.

When you receive a topic or deliverable brief:
1. Delegate to seo-analyst with: the topic, Stackly's ICP (PLG SaaS growth teams), and any existing target keyword from the content brief
2. Wait for seo-analyst's seo_report
3. Synthesise: extract the primary keyword recommendation and 2–3 supporting keywords
4. Submit to director with a 3-sentence keyword brief that content-lead can use

Stackly's keyword focus areas:
- "PLG dashboard", "product led growth metrics", "activation rate SaaS"
- "PQL tracking", "expansion MRR dashboard"
- Competitor: "Databox alternative", "Geckoboard alternative for PLG"
```

- [ ] **Create `insights-lead/keyword_brief.md`**

```markdown
---
name: keyword_brief
when_to_use: When compiling the final keyword brief for the content team
---

Output format for every keyword brief sent to director or content-lead:

```
Primary keyword: [keyword] (estimated monthly searches: [X], competition: low/medium/high)
Supporting keywords: [kw1], [kw2], [kw3]
Recommended H1 pattern: [example title using primary keyword]
Internal links to suggest: [existing Stackly blog posts or pages — if none, note "TBD"]
```

Keep the brief under 100 words. The copywriter reads this before writing.
```

- [ ] **Create `social-manager/linkedin_post_writer.md`**

```markdown
---
name: linkedin_post_writer
when_to_use: When your delegation is to write a linkedin_post deliverable
---

Write every Stackly LinkedIn post following this structure:

**Line 1 (hook)** — the most important line. Must work as a standalone tweet. Options:
- "Most PLG teams are measuring activation rate wrong. Here's why."
- "We talked to 50 PLG founders. 80% track MRR. 20% track PQL. Here's the difference it makes."

**Lines 2–8 (insight)** — the core content. One idea, developed clearly. Use specific numbers. Short sentences. No "In conclusion".

**Line 9–10 (CTA)** — a question ("What does activation rate look like at your company?") or a link ("Full breakdown on the Stackly blog — link in comments").

**Character count**: 800–1200 characters. Check before submitting.

**Do not**:
- Start with "Excited to share"
- Use generic closing: "I hope this helps!"
- Use more than 3 hashtags

Submit as submit_deliverable with type="linkedin_post".
```

- [ ] **Create `seo-analyst/keyword_research.md`**

```markdown
---
name: keyword_research
when_to_use: When delegated a keyword research task
---

For Stackly keyword research, use the web_fetch tool to check:
1. Google Trends (trends.google.com) for the topic trend (last 12 months, worldwide)
2. Reddit r/SaaS and r/startups for pain points matching the topic

Output a structured seo_report with:
- **Primary keyword recommendation**: most specific, least competitive variation
- **Supporting keywords**: 3–5 long-tail variations
- **Trend signal**: growing / stable / declining (from Google Trends)
- **Community pain point**: 1 quote or paraphrase from Reddit showing real user pain

If web_fetch is unavailable, derive keywords from the topic using PLG-specific terminology from memory. Note which approach was used.

Submit as submit_deliverable with type="seo_report".
```

- [ ] **Create `seo-analyst/on_page_audit.md`**

```markdown
---
name: on_page_audit
when_to_use: When delegated an on-page SEO audit task for a Stackly page
---

Audit checklist for every Stackly page:

1. **Title tag**: Contains primary keyword? Under 60 characters?
2. **Meta description**: 140–160 characters? Contains keyword + CTA?
3. **H1**: Exact or close match to primary keyword?
4. **H2s**: Do they cover related subtopics (supporting keywords)?
5. **Content length**: Blog posts 1500+ words? Landing pages 600+ words?
6. **Internal links**: At least 2 links to other Stackly pages?
7. **CTA placement**: Is there a CTA above the fold and at the end?

Score each item pass/fail. For each fail, include a 1-sentence fix recommendation.

Submit as submit_deliverable with type="seo_report".
```

- [ ] **Create `eval-judge/three_dim_review_extended.md`**

```markdown
---
name: three_dim_review_extended
when_to_use: When evaluating a linkedin_post deliverable
---

For LinkedIn posts, use modified scoring weights:

**1. Brand voice illeszkedés** (weight: high for LinkedIn)
- 5: Hook stops the scroll, no corporate fluff, reads like a practitioner wrote it
- 3: On-brand but generic hook
- 1: "Excited to share" or similar opener, sounds like a press release

**2. Factual accuracy** (same rubric as blog posts)

**3. USP usage** (adapted for LinkedIn format)
- 5: Stackly's PLG angle woven into the insight naturally — not forced
- 3: Stackly mentioned but as an afterthought
- 1: No PLG positioning, could be any SaaS company's post

**Character count check** (bonus, not scored):
- Note if the post is outside the 800–1200 character range

Submit your evaluation using submit_eval_report.
```

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/skills/defaults/
git commit -m "feat(skills): add default skill recipes for 4 new roles"
```

---

## Phase 3 — n8n Foundation + Kanban

---

### Task 13: n8n outbound webhook

**Files:**
- Modify: `packages/server/src/broker/event-bus.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Add failing test** — create `packages/server/src/broker/event-bus.test.ts`:

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb } from "../db/index.js";
import { Broker } from "./event-bus.js";

describe("Broker webhook dispatch", () => {
	let dir: string;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "broker-test-"));
		close = openDb(join(dir, "test.db")).close;
	});
	afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

	it("calls fetch with event payload when webhookUrl is set", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);

		const { db } = openDb(join(dir, "test2.db"));
		const broker = new Broker(db, "http://n8n.test/webhook/abc");
		broker.emit("deliverable_shipped", { deliverableId: "d-1" });

		await new Promise((r) => setTimeout(r, 10)); // let the async fire-and-forget run
		expect(fetchMock).toHaveBeenCalledWith(
			"http://n8n.test/webhook/abc",
			expect.objectContaining({ method: "POST" }),
		);
		vi.unstubAllGlobals();
	});

	it("does not call fetch when webhookUrl is not set", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { db } = openDb(join(dir, "test3.db"));
		const broker = new Broker(db); // no webhookUrl
		broker.emit("deliverable_shipped", { deliverableId: "d-1" });

		await new Promise((r) => setTimeout(r, 10));
		expect(fetchMock).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});
});
```

- [ ] **Run — expect failures**:

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- event-bus.test.ts --reporter=verbose 2>&1 | tail -15
```

- [ ] **Update `event-bus.ts`** — add webhookUrl parameter to constructor and fire-and-forget dispatch:

```typescript
export class Broker {
	private ee = new EventEmitter();
	constructor(
		private db: AgencyDb,
		private webhookUrl?: string,
	) {
		this.ee.setMaxListeners(0);
	}

	emit(type: string, payload: Record<string, unknown>, meta: EmitMeta = {}): PersistedEvent {
		const insert = this.db
			.insert(events)
			.values({
				type, payloadJson: payload as never,
				agentSlug: meta.agentSlug, sessionId: meta.sessionId, turnId: meta.turnId,
			})
			.returning()
			.get();
		const evt: PersistedEvent = {
			id: insert.id as number,
			ts: insert.ts as Date,
			agentSlug: insert.agentSlug ?? null,
			sessionId: insert.sessionId ?? null,
			turnId: insert.turnId ?? null,
			type,
			payload,
		};
		this.ee.emit("event", evt);
		if (this.webhookUrl) {
			// fire-and-forget, never throws
			fetch(this.webhookUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(evt),
			}).catch(() => {});
		}
		return evt;
	}

	subscribe(fn: (e: PersistedEvent) => void): () => void {
		this.ee.on("event", fn);
		return () => this.ee.off("event", fn);
	}
}
```

- [ ] **Update `index.ts`** — pass N8N_WEBHOOK_URL to Broker:

```typescript
const webhookUrl = process.env.N8N_WEBHOOK_URL ?? undefined;
const broker = new Broker(db, webhookUrl);
```

- [ ] **Run — expect pass**:

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspace=packages/server -- event-bus.test.ts --reporter=verbose 2>&1 | tail -10
```

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/broker/event-bus.ts packages/server/src/broker/event-bus.test.ts packages/server/src/index.ts
git commit -m "feat(broker): add N8N_WEBHOOK_URL outbound event dispatch"
```

---

### Task 14: API token auth guard

**Files:**
- Modify: `packages/server/src/server/index.ts`

- [ ] **Add auth guard hook** — in `buildServer`, before registering routes, add:

```typescript
const apiToken = process.env.MARQUEE_API_TOKEN;

if (apiToken) {
    app.addHook("preHandler", async (req, reply) => {
        const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
        if (!writeMethods.includes(req.method)) return;
        if (!req.routeOptions.url?.startsWith("/api/")) return;
        const auth = req.headers.authorization;
        if (!auth || auth !== `Bearer ${apiToken}`) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
}
```

Pass `apiToken` through `ServerOpts` or read from env directly inside `buildServer`. Since env reading is already done in `index.ts`, reading from `process.env` inside `buildServer` is acceptable (it's called once at startup).

- [ ] **Verify dev server still starts**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
set -a && source .env && set +a && DATA_DIR=~/.marquee-dev npm run dev --workspace=packages/server &
sleep 3
# Without token set, all requests should work
curl -s http://localhost:7892/api/health
kill %1
```

Expected: health endpoint responds normally. Without `MARQUEE_API_TOKEN` set, no auth guard applies.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/server/src/server/index.ts
git commit -m "feat(server): add MARQUEE_API_TOKEN bearer guard on write endpoints"
```

---

### Task 15: Kanban drag-and-drop

**Files:**
- Modify: `packages/web/package.json`
- Modify: `packages/web/src/views/pipeline.tsx`

- [ ] **Install dnd-kit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee/packages/web
npm install @dnd-kit/core
```

- [ ] **Update `pipeline.tsx`** — replace the full file with the dnd-kit version:

```tsx
import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { api } from "../lib/api.js";
import { useAgencyStore } from "../store/useAgencyStore.js";
import { Sidebar } from "../components/layout/Sidebar.js";

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt?: string;
}

const COLUMNS = [
  { status: "drafting", label: "Drafting" },
  { status: "awaiting_eval", label: "Awaiting Eval" },
  { status: "awaiting_approval", label: "Awaiting Approval" },
  { status: "shipped", label: "Shipped" },
  { status: "archived", label: "Archived" },
];

const STATUS_COLOR: Record<string, string> = {
  drafting: "var(--neutral-mid)",
  awaiting_eval: "var(--primary)",
  awaiting_approval: "var(--accent)",
  shipped: "var(--success, #2d7a4f)",
  archived: "var(--neutral-mid)",
};

function DeliverableCard({
  d,
  onClick,
}: {
  d: Deliverable;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{
        background: "var(--parchment)",
        border: "1px solid var(--rule)",
        borderRadius: 8,
        padding: "12px 14px",
        cursor: isDragging ? "grabbing" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
      }}
    >
      <div className="body-sm" style={{ fontWeight: 500, marginBottom: 4 }}>{d.title}</div>
      <div className="caption" style={{ opacity: 0.6 }}>{d.type.replace(/_/g, " ")}</div>
    </div>
  );
}

function Column({
  status,
  label,
  cards,
  onCardClick,
}: {
  status: string;
  label: string;
  cards: Deliverable[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 240,
        maxWidth: 280,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: isOver ? "var(--primary-soft)" : "transparent",
        borderRadius: 8,
        padding: 4,
        transition: "background 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: STATUS_COLOR[status],
          }}
        />
        <span className="caption" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        <span className="caption" style={{ marginLeft: "auto", opacity: 0.5 }}>{cards.length}</span>
      </div>
      {cards.map((d) => (
        <DeliverableCard key={d.id} d={d} onClick={() => onCardClick(d.id)} />
      ))}
      {cards.length === 0 && (
        <div className="caption" style={{ opacity: 0.35, padding: "8px 2px" }}>Empty</div>
      )}
    </div>
  );
}

export function PipelineView() {
  const setSelectedDeliverable = useAgencyStore((s) => s.setSelectedDeliverable);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [dragging, setDragging] = useState<Deliverable | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(() => {
    api.deliverables.list().then((rows: Deliverable[]) => setDeliverables(rows));
  }, []);

  useEffect(() => { load(); }, [load]);

  const byStatus = (status: string) => deliverables.filter((d) => d.status === status);

  const handleDragStart = ({ active }: { active: { id: string } }) => {
    setDragging(deliverables.find((d) => d.id === active.id) ?? null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const card = deliverables.find((d) => d.id === active.id);
    const newStatus = over.id as string;
    if (!card || card.status === newStatus) return;
    // optimistic update
    setDeliverables((prev) =>
      prev.map((d) => (d.id === card.id ? { ...d, status: newStatus } : d)),
    );
    const result = await api.deliverables.patchStatus(card.id, newStatus);
    if (!result.ok) {
      // revert on rejection
      setDeliverables((prev) =>
        prev.map((d) => (d.id === card.id ? { ...d, status: card.status } : d)),
      );
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="pipeline" />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 28px 12px", borderBottom: "1px solid var(--rule)", flexShrink: 0 }}>
          <div className="headline-md">Pipeline</div>
          <div className="body-sm" style={{ marginTop: 2 }}>
            {deliverables.length} deliverable{deliverables.length !== 1 ? "s" : ""}
          </div>
        </div>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", gap: 16 }}>
            {COLUMNS.map(({ status, label }) => (
              <Column
                key={status}
                status={status}
                label={label}
                cards={byStatus(status)}
                onCardClick={(id) => setSelectedDeliverable(id)}
              />
            ))}
          </div>
          <DragOverlay>
            {dragging && (
              <div
                style={{
                  background: "var(--parchment)",
                  border: "1px solid var(--primary)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                  cursor: "grabbing",
                }}
              >
                <div className="body-sm" style={{ fontWeight: 500 }}>{dragging.title}</div>
                <div className="caption" style={{ opacity: 0.6 }}>{dragging.type.replace(/_/g, " ")}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
```

- [ ] **Start dev server and manually verify drag-and-drop**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
set -a && source .env && set +a && DATA_DIR=~/.marquee-dev npm run dev
```

Open http://localhost:5173, navigate to Pipeline. Create a test deliverable via the API or smoke test, then drag the card between columns — column highlight appears on hover, card moves, optimistic update visible.

- [ ] **Verify TypeScript compiles without errors**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run build --workspace=packages/web 2>&1 | grep -i error | head -10
```

Expected: 0 errors.

- [ ] **Commit**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add packages/web/package.json packages/web/src/views/pipeline.tsx package-lock.json
git commit -m "feat(web): add kanban drag-and-drop to Pipeline view (dnd-kit)"
```

---

### Task 16: Full test run + deploy

- [ ] **Run all tests**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
npm run test --workspaces --if-present 2>&1 | tail -30
```

Expected: all tests pass, no failures.

- [ ] **Update `CLAUDE.md` in marquee** — replace the v0.1 known gaps section with v0.2 status:

In `marquee/CLAUDE.md`, replace the `## v0.1 ismert hiányosságok (v0.2-re halasztva)` section with:

```markdown
## v0.2 állapot (aktuális)

Jelenlegi verzió: **v0.2.0**

### Aktív role-ok (8)
director, content-lead, copywriter, eval-judge (warm/transient, v0.1-ből)
distribution-lead, insights-lead, social-manager, seo-analyst (v0.2-ben hozzáadva)

### Aktív deliverable típusok
blog_post, linkedin_post, landing_page, seo_report

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
```

- [ ] **Deploy**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
bash scripts/deploy.sh
```

- [ ] **Verify live**

```bash
ssh -i ~/.ssh/id_ed25519 balazs@192.168.2.60 "curl -s http://localhost:7892/api/health"
```

Expected: 200 OK.

- [ ] **Commit CLAUDE.md update**

```bash
cd /home/brandaholic/Projects/Homelab/marquee
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for v0.2 — 8 roles, n8n integration, new deliverable types"
```
