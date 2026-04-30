# Multi-Brief per Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow multiple briefs to belong to one campaign — both via the `propose_brief` Director tool and via the `POST /api/briefs` human endpoint — and display campaign briefs in the Campaigns detail view.

**Architecture:** No schema changes needed (`briefs.campaignId` FK already exists). Both brief-creation paths get an optional `campaignId` parameter: if provided and valid, the brief joins an existing campaign; if omitted, a new campaign is auto-created (current behavior preserved). The `GET /api/campaigns/:id` endpoint gains a `briefs` array, and `CampaignDetailPanel` gains a Briefs section.

**Tech Stack:** Node.js 22, TypeScript, Drizzle ORM, Fastify 5, React 19, Vitest, Zod.

---

## File Structure

**Modified files:**
- `packages/server/src/tools/proposals.ts` — add optional `campaignId` to `proposeBrief`
- `packages/server/src/tools/proposals.test.ts` — extend with new test
- `packages/server/src/server/routes/briefs.ts` — accept optional `campaignId` in POST body
- `packages/server/src/server/routes/briefs.test.ts` — extend with new test
- `packages/server/src/server/routes/campaigns.ts` — add `briefs` to GET /:id response
- `packages/server/src/server/routes/campaigns.test.ts` — extend with new test
- `packages/web/src/lib/api.ts` — update `briefs.create` signature + `campaigns.get` return type
- `packages/web/src/views/campaigns.tsx` — extend `CampaignDetail` + add Briefs section
- `packages/web/src/views/home.tsx` — add campaign dropdown to `NewBriefForm`

---

## Task 1: proposeBrief tool — optional campaignId

**Files:**
- Modify: `packages/server/src/tools/proposals.ts`
- Modify: `packages/server/src/tools/proposals.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/server/src/tools/proposals.test.ts` (inside the existing `describe("proposal tools")` block, after current tests). Also add `eq` to the drizzle-orm import if not already present.

```typescript
it("propose_brief uses existing campaign when campaignId provided", async () => {
  const emit = vi.fn();
  const campaignId = randomUUID();
  db.insert(campaigns).values({ id: campaignId, title: "Existing", status: "active" }).run();

  const result = await proposeBrief.execute(
    { threadId: randomUUID(), title: "New Brief", scope: "blog", deliverables: ["blog_post"], campaignId },
    { db, agentSlug: "director", agentSessionId: randomUUID(), emit },
  );

  const brief = db.select().from(briefs).where(eq(briefs.id, result.briefId)).get()!;
  expect(brief.campaignId).toBe(campaignId);
  // no new campaign created — still only 1 campaign in DB
  expect(db.select().from(campaigns).all()).toHaveLength(1);
});

it("propose_brief throws when campaignId does not exist", async () => {
  const emit = vi.fn();
  await expect(
    proposeBrief.execute(
      { threadId: randomUUID(), title: "Brief", scope: "blog", deliverables: ["blog_post"], campaignId: "nonexistent" },
      { db, agentSlug: "director", agentSessionId: randomUUID(), emit },
    ),
  ).rejects.toThrow("Campaign nonexistent not found");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npm test -- proposals 2>&1 | tail -15
```

Expected: FAIL — `campaignId` is not a recognized field.

- [ ] **Step 3: Implement**

Full updated `packages/server/src/tools/proposals.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { briefs, campaigns, memoryProposals } from "../db/schema.js";
import type { AgentToolDef } from "./types.js";

const proposeBriefInput = z.object({
	threadId: z.string(),
	title: z.string(),
	scope: z.string(),
	deliverables: z.array(z.string()).min(1),
	deadline: z.string().optional(),
	campaignId: z.string().optional(),
});

export const proposeBrief: AgentToolDef<z.infer<typeof proposeBriefInput>, { briefId: string }> = {
	name: "propose_brief",
	description: "Propose a structured brief in the chat. Human reviews and approves to dispatch.",
	schema: {
		type: "object",
		properties: {
			threadId: { type: "string" },
			title: { type: "string" },
			scope: { type: "string" },
			deliverables: { type: "array", items: { type: "string" }, minItems: 1 },
			deadline: { type: "string" },
			campaignId: { type: "string" },
		},
		required: ["threadId", "title", "scope", "deliverables"],
	},
	input: proposeBriefInput,
	async execute(input, ctx) {
		let campaignId: string;
		if (input.campaignId) {
			const existing = ctx.db.select().from(campaigns).where(eq(campaigns.id, input.campaignId)).get();
			if (!existing) throw new Error(`Campaign ${input.campaignId} not found`);
			campaignId = input.campaignId;
		} else {
			campaignId = randomUUID();
			ctx.db.insert(campaigns).values({ id: campaignId, title: input.title, status: "active" }).run();
		}

		const id = randomUUID();
		const md = [
			`# ${input.title}`, "",
			`**Scope:** ${input.scope}`, "",
			`**Deliverables:** ${input.deliverables.join(", ")}`,
			input.deadline ? `**Deadline:** ${input.deadline}` : "",
		].filter(Boolean).join("\n");
		// sourceThreadId is a soft reference — store null to avoid FK constraint when thread
		// hasn't been created yet (e.g. during early-stage proposal flows).
		ctx.db.insert(briefs).values({
			id, sourceThreadId: null, status: "draft", contentMd: md, campaignId,
		}).run();
		ctx.emit("brief_proposed", { briefId: id, threadId: input.threadId, title: input.title });
		return { briefId: id };
	},
};

const proposeMemoryUpdateInput = z.object({
	file: z.string(),
	patch: z.string().min(10),
	rationale: z.string().optional(),
});

export const proposeMemoryUpdate: AgentToolDef<z.infer<typeof proposeMemoryUpdateInput>, { proposalId: string }> = {
	name: "propose_memory_update",
	description: "Propose a unified-diff patch to a memory file. Human approves, then git-committed.",
	schema: {
		type: "object",
		properties: {
			file: { type: "string" },
			patch: { type: "string", minLength: 10 },
			rationale: { type: "string" },
		},
		required: ["file", "patch"],
	},
	input: proposeMemoryUpdateInput,
	async execute(input, ctx) {
		// Validate input explicitly so the schema constraints are enforced at runtime.
		proposeMemoryUpdateInput.parse(input);
		const id = randomUUID();
		ctx.db.insert(memoryProposals).values({
			id, agentSessionId: ctx.agentSessionId, file: input.file, patch: input.patch, status: "pending",
		}).run();
		ctx.emit("memory_proposed", { proposalId: id, file: input.file, by: ctx.agentSlug });
		return { proposalId: id };
	},
};
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npm test -- proposals 2>&1 | tail -10
```

Expected: all proposal tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/tools/proposals.ts packages/server/src/tools/proposals.test.ts
git commit -m "feat: proposeBrief accepts optional campaignId to join existing campaign"
```

---

## Task 2: POST /api/briefs — optional campaignId in body

**Files:**
- Modify: `packages/server/src/server/routes/briefs.ts`
- Modify: `packages/server/src/server/routes/briefs.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/server/src/server/routes/briefs.test.ts` (inside the existing `describe("POST /api/briefs")` block):

```typescript
it("uses existing campaign when campaignId provided in body", async () => {
  const { db, broker, dir, cleanup } = makeApp();
  const campaignId = randomUUID();
  db.insert(campaigns).values({ id: campaignId, title: "Existing", status: "active" }).run();

  const app = await buildServer({ db, broker, router: { queueBrief: () => {} } as unknown as AgentRouter, dataDir: dir, webRoot: "/nonexistent" });
  const res = await app.inject({
    method: "POST", url: "/api/briefs",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentMd: "Write a post.", campaignId }),
  });
  expect(res.statusCode).toBe(200);
  const body = res.json<{ id: string }>();
  const brief = db.select().from(briefs).all().find(b => b.id === body.id)!;
  expect(brief.campaignId).toBe(campaignId);
  // no new campaign created
  expect(db.select().from(campaigns).all()).toHaveLength(1);
  cleanup();
});

it("returns 400 when provided campaignId does not exist", async () => {
  const { db, broker, dir, cleanup } = makeApp();
  const app = await buildServer({ db, broker, router: { queueBrief: () => {} } as unknown as AgentRouter, dataDir: dir, webRoot: "/nonexistent" });
  const res = await app.inject({
    method: "POST", url: "/api/briefs",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentMd: "Write a post.", campaignId: "nonexistent" }),
  });
  expect(res.statusCode).toBe(400);
  cleanup();
});
```

Add `campaigns` to the import from `"../../db/schema.js"` in the test file.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npm test -- briefs.test 2>&1 | tail -15
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Full updated `packages/server/src/server/routes/briefs.ts`:

```typescript
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { briefs, campaigns } from "../../db/schema.js";

export function registerBriefRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/briefs", async () => opts.db.select().from(briefs).all());

	app.post<{ Body: { contentMd: string; campaignId?: string } }>("/api/briefs", async (req, reply) => {
		const { contentMd, campaignId: existingCampaignId } = req.body;
		if (!contentMd?.trim()) {
			return reply.status(400).send({ error: "contentMd is required" });
		}

		let campaignId: string;
		if (existingCampaignId) {
			const existing = opts.db.select().from(campaigns).where(eq(campaigns.id, existingCampaignId)).get();
			if (!existing) return reply.status(400).send({ error: `Campaign ${existingCampaignId} not found` });
			campaignId = existingCampaignId;
		} else {
			const firstLine = contentMd.trim().split("\n")[0];
			const headerMatch = firstLine.match(/^#+\s+(.+)$/);
			const campaignTitle = headerMatch
				? headerMatch[1].trim().slice(0, 80)
				: `Brief ${new Date().toISOString().slice(0, 10)}`;
			campaignId = randomUUID();
			opts.db.insert(campaigns).values({ id: campaignId, title: campaignTitle, status: "active" }).run();
		}

		const id = randomUUID();
		opts.db.insert(briefs).values({
			id, status: "draft",
			contentMd: contentMd.trim(),
			campaignId,
		}).run();
		opts.router.queueBrief(id);
		return { id, ok: true };
	});

	app.post<{ Params: { id: string } }>("/api/briefs/:id/dispatch", async (req) => {
		opts.db.update(briefs).set({ status: "dispatched", dispatchedAt: new Date() })
			.where(eq(briefs.id, req.params.id)).run();
		opts.broker.emit("brief_dispatched", { briefId: req.params.id });
		return { ok: true };
	});
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npm test -- briefs.test 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server/routes/briefs.ts packages/server/src/server/routes/briefs.test.ts
git commit -m "feat: POST /api/briefs accepts campaignId to attach brief to existing campaign"
```

---

## Task 3: GET /api/campaigns/:id — add briefs array

**Files:**
- Modify: `packages/server/src/server/routes/campaigns.ts`
- Modify: `packages/server/src/server/routes/campaigns.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/server/src/server/routes/campaigns.test.ts`, inside `describe("GET /api/campaigns/:id")`:

```typescript
it("returns campaign with briefs array", async () => {
  const campaignId = seedCampaign();
  db.insert(briefs).values({ id: randomUUID(), status: "draft", contentMd: "# Brief One\n\nContent here.", campaignId }).run();
  db.insert(briefs).values({ id: randomUUID(), status: "dispatched", contentMd: "# Brief Two\n\nMore content.", campaignId }).run();

  const app = await makeApp();
  const res = await app.inject({ method: "GET", url: `/api/campaigns/${campaignId}` });
  expect(res.statusCode).toBe(200);
  const body = res.json<{ briefs: { id: string; status: string }[] }>();
  expect(body.briefs).toHaveLength(2);
  expect(body.briefs.map((b) => b.status).sort()).toEqual(["dispatched", "draft"]);
});
```

Add `briefs` to the import from `"../../db/schema.js"` in the test file.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npm test -- campaigns.test 2>&1 | tail -15
```

Expected: FAIL — `body.briefs` is undefined.

- [ ] **Step 3: Implement**

Updated `packages/server/src/server/routes/campaigns.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { briefs, campaigns, deliverables, tasks } from "../../db/schema.js";

export function registerCampaignRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/campaigns", async () => {
		const allCampaigns = opts.db.select().from(campaigns).all();
		const allDeliverables = opts.db.select().from(deliverables).all();
		const allTasks = opts.db.select().from(tasks).all();
		return allCampaigns.map((c) => ({
			...c,
			deliverableCount: allDeliverables.filter((d) => d.campaignId === c.id).length,
			taskCount: allTasks.filter((t) => t.campaignId === c.id).length,
			pendingApprovals: allDeliverables.filter((d) => d.campaignId === c.id && d.status === "awaiting_approval").length,
		}));
	});

	app.get<{ Params: { id: string } }>("/api/campaigns/:id", async (req, reply) => {
		const c = opts.db.select().from(campaigns).where(eq(campaigns.id, req.params.id)).get();
		if (!c) return reply.code(404).send({ error: "not found" });
		const campaignBriefs = opts.db.select().from(briefs)
			.where(eq(briefs.campaignId, req.params.id)).all();
		const campaignDeliverables = opts.db.select().from(deliverables)
			.where(eq(deliverables.campaignId, req.params.id)).all();
		const campaignTasks = opts.db.select().from(tasks)
			.where(eq(tasks.campaignId, req.params.id)).all();
		return { ...c, briefs: campaignBriefs, deliverables: campaignDeliverables, tasks: campaignTasks };
	});

	app.patch<{ Params: { id: string }; Body: { title?: string; description?: string; status?: string } }>(
		"/api/campaigns/:id",
		async (req, reply) => {
			const c = opts.db.select().from(campaigns).where(eq(campaigns.id, req.params.id)).get();
			if (!c) return reply.code(404).send({ error: "not found" });
			const { title, description, status } = req.body;
			const patch: Partial<{ title: string; description: string | null; status: "active" | "completed" | "archived" }> = {};
			if (title !== undefined) patch.title = title;
			if (description !== undefined) patch.description = description;
			if (status !== undefined) patch.status = status as "active" | "completed" | "archived";
			opts.db.update(campaigns).set(patch).where(eq(campaigns.id, req.params.id)).run();
			return { ok: true };
		},
	);
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npm test -- campaigns.test 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 5: Run full suite**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: all 203+ tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/server/routes/campaigns.ts packages/server/src/server/routes/campaigns.test.ts
git commit -m "feat: GET /api/campaigns/:id returns briefs array"
```

---

## Task 4: Web — CampaignDetail type + Briefs section in panel

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/views/campaigns.tsx`

- [ ] **Step 1: Update api.ts**

In `packages/web/src/lib/api.ts`, update the `campaigns.get` return type to include `briefs`:

```typescript
get: (id: string) => fetch(`/api/campaigns/${id}`).then(json) as Promise<
  import("../store/useAgencyStore.js").Campaign & {
    briefs: { id: string; status: string; contentMd: string; createdAt: string }[];
    deliverables: { id: string; title: string; type: string; status: string }[];
    tasks: { id: string; title: string; status: string; assignedTo: string }[];
  }
>,
```

- [ ] **Step 2: Update CampaignDetail interface in campaigns.tsx**

In `packages/web/src/views/campaigns.tsx`, update the `CampaignDetail` interface (lines 13–16):

```typescript
interface CampaignDetail extends Campaign {
  briefs: { id: string; status: string; contentMd: string; createdAt: string }[];
  deliverables: { id: string; title: string; type: string; status: string }[];
  tasks: { id: string; title: string; status: string; assignedTo: string }[];
}
```

- [ ] **Step 3: Add Briefs section to CampaignDetailPanel**

In `packages/web/src/views/campaigns.tsx`, inside `CampaignDetailPanel`, add a Briefs section BEFORE the existing Deliverables section. The existing Deliverables section starts with `<div style={{ marginBottom: 20 }}>` and `className="caption"` "Deliverables".

Add this block right after the `{campaign.description && (...)}` block and before the Deliverables section:

```typescript
<div style={{ marginBottom: 20 }}>
  <div className="caption" style={{ marginBottom: 8 }}>Briefs ({campaign.briefs.length})</div>
  {campaign.briefs.length === 0
    ? <div style={{ fontSize: 13, color: "var(--ink-3)" }}>None yet</div>
    : campaign.briefs.map((b) => {
        const statusLabel = b.status === "draft" ? "Draft" : b.status === "dispatched" ? "In progress" : "Done";
        const title = b.contentMd.split("\n")[0].replace(/^#+\s*/, "").trim().slice(0, 60) || "Untitled brief";
        return (
          <div key={b.id} style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4, display: "flex", gap: 8 }}>
            <span style={{ color: "var(--ink-3)", flexShrink: 0 }}>{statusLabel}</span>
            <span>{title}</span>
          </div>
        );
      })
  }
</div>
```

- [ ] **Step 4: TypeScript check**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 5: Build**

```bash
npm run build --workspace=packages/web 2>&1 | tail -3
```

Expected: successful build.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/api.ts packages/web/src/views/campaigns.tsx
git commit -m "feat: show briefs list in campaign detail panel"
```

---

## Task 5: NewBriefForm — campaign selector dropdown

**Files:**
- Modify: `packages/web/src/views/home.tsx`
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: Update api.briefs.create signature in api.ts**

In `packages/web/src/lib/api.ts`, update `briefs.create`:

```typescript
create: (contentMd: string, campaignId?: string) =>
  post<{ id: string; ok: boolean }>("/api/briefs", { contentMd, ...(campaignId ? { campaignId } : {}) }),
```

- [ ] **Step 2: Update NewBriefForm in home.tsx**

Replace the existing `NewBriefForm` component (lines 99–133) with:

```typescript
function NewBriefForm({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [campaigns, setCampaigns] = useState<import("../store/useAgencyStore.js").Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await api.briefs.create(text.trim(), selectedCampaignId || undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ padding: "16px 18px", marginTop: 16 }}>
      <textarea
        className="textarea-chat"
        style={{ width: "100%", minHeight: 80, border: "1px solid var(--rule-strong)", borderRadius: 4, padding: 8, resize: "vertical" }}
        placeholder="Describe what you need…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {campaigns.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label className="caption" style={{ display: "block", marginBottom: 4 }}>Campaign</label>
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
          >
            <option value="">— New campaign —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting || !text.trim()}>
          Send brief
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 4: Build**

```bash
npm run build --workspace=packages/web 2>&1 | tail -3
```

Expected: successful build.

- [ ] **Step 5: Run server tests**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/views/home.tsx packages/web/src/lib/api.ts
git commit -m "feat: add campaign selector to NewBriefForm"
```

---

## Self-Review

**Spec coverage:**
- [x] `proposeBrief` tool: optional `campaignId` param, validate existence, use or create (Task 1)
- [x] `POST /api/briefs`: optional `campaignId` in body, validate, 400 on not found (Task 2)
- [x] `GET /api/campaigns/:id`: `briefs` array in response (Task 3)
- [x] `api.campaigns.get` return type includes `briefs` (Task 4)
- [x] `CampaignDetail` interface extended (Task 4)
- [x] Briefs section in `CampaignDetailPanel` (Task 4)
- [x] `api.briefs.create` accepts `campaignId?` (Task 5)
- [x] Campaign dropdown in `NewBriefForm` (Task 5)

**Placeholder scan:** clean.

**Type consistency:** `briefs` array shape `{ id, status, contentMd, createdAt }` defined in Task 3 test, Task 4 api.ts type, and Task 4 CampaignDetailPanel — all consistent.
