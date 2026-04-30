# Agent Config UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Ügynökség agent configuration UI (card grid overview + per-agent Identitás/Skillek/Beállítások tabs) with skill progressive disclosure — only the frontmatter catalog enters the system prompt at spawn; skill bodies load on-demand via a `load_skill` tool.

**Architecture:** Backend adds `loadSkillCatalog` (frontmatter-only XML) and `loadAgentIdentity` to the system prompt assembly, replaces `loadSkillRecipes` in factory.ts, and exposes CRUD routes at `/api/agents`. Frontend adds `/ugynokseg` and `/ugynokseg/:role` routes with two new React views plus nav updates.

**Tech Stack:** Node.js 22, TypeScript, Fastify 5, Vitest, React 19, Vite, Tailwind 3, Zustand, react-router-dom 7, gray-matter

---

## File Map

**New files:**
- `packages/server/src/agents/loader.ts` — seedDefaultAgents, loadAgentIdentity, saveAgentIdentity, loadAgentConfig, saveAgentConfig, loadAgentDescription
- `packages/server/src/agents/loader.test.ts` — unit tests for the above
- `packages/server/src/server/routes/agents.ts` — all /api/agents CRUD routes
- `packages/server/src/server/routes/agents.test.ts` — route integration tests
- `packages/web/src/views/Agency.tsx` — Ügynökség overview (card grid)
- `packages/web/src/views/AgentConfig.tsx` — per-agent config page (tabs)

**Modified files:**
- `packages/server/src/skills/loader.ts` — add loadSkillCatalog, saveSkill, deleteSkill, loadBrandVoiceInstruction
- `packages/server/src/skills/loader.test.ts` — tests for the 4 new functions
- `packages/server/src/agents/config.ts` — add ROLE_DISPLAY_NAMES export
- `packages/server/src/providers/index.ts` — export ROLE_MODEL, add modelForRoleWithOverride
- `packages/server/src/agents/factory.ts` — use identity+catalog+config override+load_skill tool
- `packages/server/src/index.ts` — call seedDefaultAgents at startup
- `packages/server/src/server/index.ts` — register agentsRoutes
- `packages/web/src/App.tsx` — add /ugynokseg routes
- `packages/web/src/components/Sidebar.tsx` — add Ügynökség nav item
- `packages/web/src/components/BottomNav.tsx` — add Ügynökség nav item
- `packages/web/src/lib/api.ts` — add agentsApi export

---

## Task 1: loadSkillCatalog + saveSkill + deleteSkill + loadBrandVoiceInstruction in skills/loader.ts

**Files:**
- Modify: `packages/server/src/skills/loader.ts`
- Modify: `packages/server/src/skills/loader.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/server/src/skills/loader.test.ts` — append these describe blocks:

```typescript
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
// (add unlinkSync, existsSync to the existing import at line 1)
import { loadSkillCatalog, saveSkill, deleteSkill, loadBrandVoiceInstruction } from "./loader.js";
// (add these 4 to the existing import at line 5)

describe("loadSkillCatalog", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marquee-catalog-"));
    mkdirSync(join(dir, "skills/director"), { recursive: true });
    writeFileSync(
      join(dir, "skills/director/brief_parser.md"),
      "---\nname: brief_parser\ndescription: Parses incoming briefs\n---\n\nBody text here.",
    );
    writeFileSync(
      join(dir, "skills/director/lead_router.md"),
      "---\nname: lead_router\ndescription: Routes to correct lead\n---\n\nRouter body.",
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns XML with name and description only, no body", () => {
    const out = loadSkillCatalog(dir, "director");
    expect(out).toContain('<skill name="brief_parser">Parses incoming briefs</skill>');
    expect(out).toContain('<skill name="lead_router">Routes to correct lead</skill>');
    expect(out).not.toContain("Body text here");
    expect(out).not.toContain("Router body");
  });

  it("wraps in <skills> element", () => {
    const out = loadSkillCatalog(dir, "director");
    expect(out).toMatch(/^<skills>/);
    expect(out).toMatch(/<\/skills>$/);
  });

  it("returns empty string for unknown role", () => {
    expect(loadSkillCatalog(dir, "ghost")).toBe("");
  });

  it("sorts skills alphabetically by filename", () => {
    const out = loadSkillCatalog(dir, "director");
    expect(out.indexOf("brief_parser")).toBeLessThan(out.indexOf("lead_router"));
  });
});

describe("saveSkill + deleteSkill", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marquee-skill-write-"));
    mkdirSync(join(dir, "skills/copywriter"), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("saveSkill writes a parseable .md file", () => {
    saveSkill(dir, "copywriter", "my_skill", "Does something useful", "Step 1: do the thing.");
    const raw = readFileSync(join(dir, "skills/copywriter/my_skill.md"), "utf8");
    const parsed = matter(raw);
    expect(parsed.data.name).toBe("my_skill");
    expect(parsed.data.description).toBe("Does something useful");
    expect(parsed.content.trim()).toBe("Step 1: do the thing.");
  });

  it("saveSkill creates the role directory if missing", () => {
    saveSkill(dir, "new-role", "a_skill", "desc", "body");
    expect(existsSync(join(dir, "skills/new-role/a_skill.md"))).toBe(true);
  });

  it("deleteSkill removes the file", () => {
    saveSkill(dir, "copywriter", "to_delete", "desc", "body");
    deleteSkill(dir, "copywriter", "to_delete");
    expect(existsSync(join(dir, "skills/copywriter/to_delete.md"))).toBe(false);
  });

  it("deleteSkill is silent for nonexistent skill", () => {
    expect(() => deleteSkill(dir, "copywriter", "ghost")).not.toThrow();
  });
});

describe("loadBrandVoiceInstruction", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marquee-bvi-"));
    mkdirSync(join(dir, "skills/_common"), { recursive: true });
    writeFileSync(
      join(dir, "skills/_common/brand_voice_instruction.md"),
      "---\nname: bvi\n---\n\nFollow brand voice guidelines.",
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns body (no frontmatter) for non-guardian roles", () => {
    const out = loadBrandVoiceInstruction(dir, "copywriter");
    expect(out).toContain("Follow brand voice guidelines.");
    expect(out).not.toContain("name: bvi");
  });

  it("returns empty string for brand-voice-guardian", () => {
    expect(loadBrandVoiceInstruction(dir, "brand-voice-guardian")).toBe("");
  });

  it("returns empty string when file is missing", () => {
    rmSync(join(dir, "skills/_common"), { recursive: true });
    expect(loadBrandVoiceInstruction(dir, "copywriter")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/skills/loader.test.ts 2>&1 | tail -20
```

Expected: FAIL — `loadSkillCatalog is not a function` and similar.

- [ ] **Step 3: Implement the four functions**

In `packages/server/src/skills/loader.ts`:

At the top, extend the existing node:fs sync import to include `writeFileSync` and `unlinkSync`:
```typescript
import { cpSync, existsSync as fsExists, mkdirSync as fsMkdir, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
```

Add these four functions at the end of the file (before the async imports block):

```typescript
export function loadSkillCatalog(dataDir: string, role: string): string {
  const metas = listSkillsForRole(dataDir, role);
  if (metas.length === 0) return "";
  const lines = metas.map(({ name, description }) =>
    `  <skill name="${name}">${description}</skill>`,
  );
  return `<skills>\n${lines.join("\n")}\n</skills>`;
}

export function saveSkill(
  dataDir: string,
  role: string,
  name: string,
  description: string,
  body: string,
): void {
  const dir = join(skillsDir(dataDir), role);
  if (!fsExists(dir)) fsMkdir(dir, { recursive: true });
  const content = matter.stringify(body, { name, description });
  writeFileSync(join(dir, `${name}.md`), content, "utf8");
}

export function deleteSkill(dataDir: string, role: string, name: string): void {
  try {
    unlinkSync(join(skillsDir(dataDir), role, `${name}.md`));
  } catch {
    // already gone — not an error
  }
}

export function loadBrandVoiceInstruction(dataDir: string, role: string): string {
  if (role === "brand-voice-guardian") return "";
  const path = join(dataDir, "skills", "_common", "brand_voice_instruction.md");
  try {
    const raw = readFileSync(path, "utf8");
    return matter(raw).content.trim();
  } catch {
    return "";
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/skills/loader.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/skills/loader.ts packages/server/src/skills/loader.test.ts
git commit -m "feat(server): add loadSkillCatalog, saveSkill, deleteSkill, loadBrandVoiceInstruction"
```

---

## Task 2: Create agents/loader.ts (identity, config, seed)

**Files:**
- Create: `packages/server/src/agents/loader.ts`
- Create: `packages/server/src/agents/loader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/server/src/agents/loader.test.ts`:

```typescript
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadAgentIdentity,
  saveAgentIdentity,
  loadAgentConfig,
  saveAgentConfig,
  loadAgentDescription,
} from "./loader.js";

describe("loadAgentIdentity", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marquee-agent-loader-"));
    mkdirSync(join(dir, "agents/director"), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns identity body when file exists", () => {
    writeFileSync(join(dir, "agents/director/identity.md"), "You are the Director.\n\nMore text.");
    expect(loadAgentIdentity(dir, "director")).toContain("You are the Director.");
  });

  it("strips frontmatter if present", () => {
    writeFileSync(
      join(dir, "agents/director/identity.md"),
      "---\ntitle: Director\n---\n\nYou are the Director.",
    );
    const out = loadAgentIdentity(dir, "director");
    expect(out).toContain("You are the Director.");
    expect(out).not.toContain("title: Director");
  });

  it("returns empty string when file missing", () => {
    expect(loadAgentIdentity(dir, "director")).toBe("");
  });
});

describe("saveAgentIdentity", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "marquee-agent-save-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes the body to identity.md", () => {
    saveAgentIdentity(dir, "director", "You are the Director.");
    expect(readFileSync(join(dir, "agents/director/identity.md"), "utf8")).toBe(
      "You are the Director.",
    );
  });

  it("creates the directory if missing", () => {
    saveAgentIdentity(dir, "new-role", "body");
    expect(existsSync(join(dir, "agents/new-role/identity.md"))).toBe(true);
  });
});

describe("loadAgentConfig + saveAgentConfig", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "marquee-agent-cfg-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns empty object when config.json missing", () => {
    expect(loadAgentConfig(dir, "director")).toEqual({});
  });

  it("round-trips model and thinking_level", () => {
    saveAgentConfig(dir, "director", { model: "gpt-5.4", thinking_level: "low" });
    expect(loadAgentConfig(dir, "director")).toEqual({ model: "gpt-5.4", thinking_level: "low" });
  });
});

describe("loadAgentDescription", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marquee-agent-desc-"));
    mkdirSync(join(dir, "agents/director"), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns first non-empty paragraph, max 100 chars", () => {
    writeFileSync(
      join(dir, "agents/director/identity.md"),
      "\n\nYou are the Director agent. You orchestrate everything.\n\nMore details here.",
    );
    const desc = loadAgentDescription(dir, "director");
    expect(desc).toContain("You are the Director agent.");
    expect(desc.length).toBeLessThanOrEqual(100);
    expect(desc).not.toContain("More details here.");
  });

  it("strips markdown headings from description", () => {
    writeFileSync(join(dir, "agents/director/identity.md"), "## Role\n\nYou are the Director.");
    // First paragraph is "## Role" — second is "You are the Director."
    const desc = loadAgentDescription(dir, "director");
    expect(desc).not.toContain("##");
  });

  it("returns empty string when identity.md missing", () => {
    expect(loadAgentDescription(dir, "director")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/agents/loader.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement agents/loader.ts**

Create `packages/server/src/agents/loader.ts`:

```typescript
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const agentsDir = (dataDir: string) => join(dataDir, "agents");

export function loadAgentIdentity(dataDir: string, role: string): string {
  const path = join(agentsDir(dataDir), role, "identity.md");
  try {
    const raw = readFileSync(path, "utf8");
    return matter(raw).content.trim();
  } catch {
    return "";
  }
}

export function saveAgentIdentity(dataDir: string, role: string, body: string): void {
  const dir = join(agentsDir(dataDir), role);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "identity.md"), body, "utf8");
}

export interface AgentConfig {
  model?: string;
  thinking_level?: string;
}

export function loadAgentConfig(dataDir: string, role: string): AgentConfig {
  const path = join(agentsDir(dataDir), role, "config.json");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as AgentConfig;
  } catch {
    return {};
  }
}

export function saveAgentConfig(dataDir: string, role: string, config: AgentConfig): void {
  const dir = join(agentsDir(dataDir), role);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, 2), "utf8");
}

export function loadAgentDescription(dataDir: string, role: string): string {
  const identity = loadAgentIdentity(dataDir, role);
  if (!identity) return "";
  const firstPara = identity.split(/\n\n+/).find((p) => p.trim()) ?? "";
  const text = firstPara
    .replace(/^#+\s*/gm, "")
    .replace(/\n/g, " ")
    .trim();
  return text.length > 100 ? `${text.slice(0, 97)}…` : text;
}

export function seedDefaultAgents(dataDir: string): void {
  const defaultsDir = join(dirname(fileURLToPath(import.meta.url)), "defaults");
  if (!existsSync(defaultsDir)) return;
  for (const role of readdirSync(defaultsDir)) {
    const srcIdentity = join(defaultsDir, role, "identity.md");
    if (!existsSync(srcIdentity)) continue;
    const destDir = join(agentsDir(dataDir), role);
    const destIdentity = join(destDir, "identity.md");
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    if (!existsSync(destIdentity)) cpSync(srcIdentity, destIdentity);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/agents/loader.test.ts 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/agents/loader.ts packages/server/src/agents/loader.test.ts
git commit -m "feat(server): add agents/loader (identity, config, seed)"
```

---

## Task 3: Add ROLE_DISPLAY_NAMES to config.ts + export ROLE_MODEL + modelForRoleWithOverride to providers

**Files:**
- Modify: `packages/server/src/agents/config.ts`
- Modify: `packages/server/src/providers/index.ts`

No new tests needed (pure data + thin wrapper — covered by factory tests in Task 4).

- [ ] **Step 1: Add ROLE_DISPLAY_NAMES to config.ts**

In `packages/server/src/agents/config.ts`, append after the existing `getRoleConfig` function:

```typescript
export const ROLE_DISPLAY_NAMES: Record<RoleSlug, string> = {
  director: "Director",
  copywriter: "Copywriter",
  "social-manager": "Social Manager",
  "paid-specialist": "Paid Specialist",
  "email-marketer": "Email Marketer",
  "seo-specialist": "SEO Specialist",
  "brand-voice-guardian": "Brand Voice Guardian",
};
```

- [ ] **Step 2: Export ROLE_MODEL and add modelForRoleWithOverride to providers/index.ts**

Replace the entire `packages/server/src/providers/index.ts` with:

```typescript
import { getModel } from "@mariozechner/pi-ai";

export const ROLE_MODEL: Record<string, string> = {
  director: "gpt-5.4",
  copywriter: "gpt-5.4",
  "social-manager": "gpt-5.4-mini",
  "paid-specialist": "gpt-5.4-mini",
  "email-marketer": "gpt-5.4",
  "seo-specialist": "gpt-5.4-mini",
  "brand-voice-guardian": "gpt-5.4-mini",
};

export function modelForRole(role: string) {
  const id = ROLE_MODEL[role] ?? "gpt-5.4-mini";
  return getModel("openai-codex", id as never)!;
}

export function modelForRoleWithOverride(role: string, override?: string) {
  const id = override ?? ROLE_MODEL[role] ?? "gpt-5.4-mini";
  return getModel("openai-codex", id as never)!;
}

export { getEnvApiKey } from "@mariozechner/pi-ai";
```

- [ ] **Step 3: Run TS check to confirm no breakage**

```bash
cd packages/server && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/agents/config.ts packages/server/src/providers/index.ts
git commit -m "feat(server): export ROLE_DISPLAY_NAMES, ROLE_MODEL, modelForRoleWithOverride"
```

---

## Task 4: Refactor factory.ts — progressive disclosure + identity + config override + load_skill tool

**Files:**
- Modify: `packages/server/src/agents/factory.ts`
- Modify: `packages/server/src/agents/factory.test.ts`

- [ ] **Step 1: Read the existing factory.test.ts**

```bash
cat packages/server/src/agents/factory.test.ts
```

Note the test setup pattern — you'll extend it.

- [ ] **Step 2: Write failing test for the new system prompt structure**

Add to `packages/server/src/agents/factory.test.ts` — a new `describe` block. (Keep all existing tests; add this after them.)

The test must verify: (a) identity block appears before memory; (b) catalog XML appears instead of full skill body; (c) `load_skill` is in the tool list.

```typescript
// Add these imports at the top of factory.test.ts if not already present:
// import { writeFileSync, mkdirSync } from "node:fs";

describe("spawnAgent — progressive disclosure system prompt", () => {
  // Uses the same setup as existing tests — adapt to match existing beforeEach pattern.
  // Key assertions only; no need to repeat full spawn setup.
  it("includes <skills> catalog but not skill body in system prompt", async () => {
    // Write a skill file in the test dataDir
    mkdirSync(join(testDataDir, "skills/director"), { recursive: true });
    writeFileSync(
      join(testDataDir, "skills/director/brief_parser.md"),
      "---\nname: brief_parser\ndescription: Parses briefs\n---\n\nSECRET BODY TEXT",
    );
    const { agent } = await spawnAgent({ ...baseInput, role: "director" });
    const prompt = agent.state.systemPrompt as string;
    expect(prompt).toContain('<skill name="brief_parser">Parses briefs</skill>');
    expect(prompt).not.toContain("SECRET BODY TEXT");
  });

  it("includes identity block at start of system prompt", async () => {
    mkdirSync(join(testDataDir, "agents/director"), { recursive: true });
    writeFileSync(join(testDataDir, "agents/director/identity.md"), "IDENTITY BLOCK CONTENT");
    const { agent } = await spawnAgent({ ...baseInput, role: "director" });
    const prompt = agent.state.systemPrompt as string;
    expect(prompt.indexOf("IDENTITY BLOCK CONTENT")).toBeLessThan(
      prompt.indexOf("<skills>"),
    );
  });

  it("adds load_skill to the tool list", async () => {
    const { agent } = await spawnAgent({ ...baseInput, role: "director" });
    const toolNames = (agent.state.tools as { name: string }[]).map((t) => t.name);
    expect(toolNames).toContain("load_skill");
  });
});
```

> **Note:** Adjust `testDataDir` and `baseInput` to match the variable names in the existing factory.test.ts. Run `cat packages/server/src/agents/factory.test.ts` first to see them.

- [ ] **Step 3: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/agents/factory.test.ts 2>&1 | tail -15
```

Expected: new tests FAIL, existing tests PASS.

- [ ] **Step 4: Rewrite the relevant part of spawnAgent in factory.ts**

Replace the imports block at the top of `packages/server/src/agents/factory.ts` — add new imports:

```typescript
import { loadSkillCatalog, loadSkillBody, loadBrandVoiceInstruction } from "../skills/loader.js";
import { loadAgentIdentity, loadAgentConfig } from "./loader.js";
import { modelForRoleWithOverride } from "../providers/index.js";
```

Remove the old import of `loadSkillRecipes` from `../skills/loader.js` (it's no longer used in this file).

Replace the system-prompt assembly and Agent construction section inside `spawnAgent` (lines ~97–110 in the original) with:

```typescript
  const agentCfg = loadAgentConfig(input.dataDir, config.slug);
  const rawTools = await buildToolsForRole(config.slug, input, sessionId);

  // load_skill tool — added to every role
  rawTools.push({
    name: "load_skill",
    description:
      "Load the full instructions for a skill by name. Call this when a task matches a skill's description and you need detailed guidance.",
    inputSchema: {
      type: "object" as const,
      properties: { name: { type: "string", description: "Skill name from the <skills> catalog" } },
      required: ["name"],
    },
    execute: async (inp: unknown) => {
      const { name } = inp as { name: string };
      return loadSkillBody(input.dataDir, config.slug, name) ?? `Skill '${name}' not found.`;
    },
  });

  const tools: AgentTool<TSchema>[] = rawTools.map(wrapTool);

  const identityBlock = loadAgentIdentity(input.dataDir, config.slug);
  const memoryBlock = await renderMemoryContext(input.dataDir, input.clientSlug, config.slug);
  const brandVoiceBlock = await renderBrandVoiceBlock(input.dataDir, input.clientSlug, config.slug);
  const brandVoiceInstructionBlock = loadBrandVoiceInstruction(input.dataDir, config.slug);
  const skillCatalog = loadSkillCatalog(input.dataDir, config.slug);
  const systemPrompt = [identityBlock, memoryBlock, brandVoiceBlock, brandVoiceInstructionBlock, skillCatalog]
    .filter(Boolean)
    .join("\n\n");

  const model = modelForRoleWithOverride(config.slug, agentCfg.model);
  const thinkingLevel = (agentCfg.thinking_level ?? "off") as
    | "off"
    | "minimal"
    | "low"
    | "medium"
    | "high";

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools,
      thinkingLevel,
    },
    getApiKey: (provider: string) =>
      input.authManager?.getApiKey(provider) ?? getEnvApiKey(provider) ?? undefined,
  });
```

Also remove the old lines that declared `const skills`, `const tools`, and the old Agent construction (they're replaced above).

- [ ] **Step 5: Run all server tests**

```bash
cd packages/server && npx vitest run 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/agents/factory.ts packages/server/src/agents/factory.test.ts
git commit -m "feat(server): progressive disclosure — identity+catalog in prompt, load_skill tool"
```

---

## Task 5: Wire startup — seedDefaultAgents + register agentsRoutes placeholder

**Files:**
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/server/index.ts`

- [ ] **Step 1: Call seedDefaultAgents in index.ts**

In `packages/server/src/index.ts`, add the import after the existing seed imports:

```typescript
import { seedDefaultAgents } from "./agents/loader.js";
```

In the `main()` function, after the `await seedClientIfNeeded(...)` call (step 1 comment), add:

```typescript
  seedDefaultAgents(dataDir);
```

- [ ] **Step 2: Pre-register agentsRoutes in server/index.ts**

In `packages/server/src/server/index.ts`, add a temporary import + empty plugin (will be replaced in Task 6 with the real implementation):

Add import after the existing route imports:
```typescript
import { agentsRoutes } from "./routes/agents.js";
```

In `buildServer`, after the `memoryRoutes` registration, add:
```typescript
  await app.register(agentsRoutes, { dataDir: opts.dataDir });
```

> The real `agentsRoutes` implementation is written in Task 6. For now, create a stub so the server still starts.

Create `packages/server/src/server/routes/agents.ts` with the stub:

```typescript
import type { FastifyPluginAsync } from "fastify";

export interface AgentsRoutesOpts {
  dataDir: string;
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOpts> = async (_app, _opts) => {
  // routes added in subsequent tasks
};
```

- [ ] **Step 3: TS check**

```bash
cd packages/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/index.ts packages/server/src/server/index.ts packages/server/src/server/routes/agents.ts
git commit -m "feat(server): wire seedDefaultAgents + stub agentsRoutes"
```

---

## Task 6: Implement agents routes — identity + config + list

**Files:**
- Modify: `packages/server/src/server/routes/agents.ts`
- Create: `packages/server/src/server/routes/agents.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/server/routes/agents.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentsRoutes } from "./agents.js";

let app: FastifyInstance;
let dataDir: string;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "marquee-agents-routes-"));
  app = Fastify();
  await app.register(agentsRoutes, { dataDir });
});

afterEach(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("GET /api/agents", () => {
  it("returns an array of 7 agent summaries", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(body).toHaveLength(7);
  });

  it("each entry has role, name, lifecycle, model, tools, skillCount, description", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    const body = res.json<Record<string, unknown>[]>();
    const director = body.find((a) => a.role === "director");
    expect(director).toBeDefined();
    expect(director!.lifecycle).toBe("warm");
    expect(typeof director!.model).toBe("string");
    expect(Array.isArray(director!.tools)).toBe(true);
    expect(typeof director!.skillCount).toBe("number");
  });
});

describe("GET /api/agents/:role/identity", () => {
  it("returns empty body when identity.md missing", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/identity" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ body: string }>().body).toBe("");
  });

  it("returns body when identity.md exists", async () => {
    mkdirSync(join(dataDir, "agents/director"), { recursive: true });
    writeFileSync(join(dataDir, "agents/director/identity.md"), "You are the Director.");
    const res = await app.inject({ method: "GET", url: "/api/agents/director/identity" });
    expect(res.json<{ body: string }>().body).toContain("You are the Director.");
  });

  it("returns 404 for unknown role", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/ghost-role/identity" });
    expect(res.statusCode).toBe(404);
  });
});

describe("PUT /api/agents/:role/identity", () => {
  it("saves identity and returns ok", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agents/director/identity",
      payload: { body: "New identity text." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);

    const get = await app.inject({ method: "GET", url: "/api/agents/director/identity" });
    expect(get.json<{ body: string }>().body).toContain("New identity text.");
  });
});

describe("GET /api/agents/:role/config", () => {
  it("returns empty object when config.json missing", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
  });
});

describe("PUT /api/agents/:role/config", () => {
  it("saves and returns ok", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agents/director/config",
      payload: { model: "gpt-5.4", thinking_level: "low" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);

    const get = await app.inject({ method: "GET", url: "/api/agents/director/config" });
    expect(get.json<{ model: string; thinking_level: string }>()).toEqual({
      model: "gpt-5.4",
      thinking_level: "low",
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/server/routes/agents.test.ts 2>&1 | tail -15
```

Expected: FAIL — routes not implemented.

- [ ] **Step 3: Implement identity + config + list routes**

Replace `packages/server/src/server/routes/agents.ts` with:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROLE_CONFIGS, ROLE_DISPLAY_NAMES, type RoleSlug } from "../../agents/config.js";
import { ROLE_MODEL } from "../../providers/index.js";
import {
  loadAgentIdentity,
  saveAgentIdentity,
  loadAgentConfig,
  saveAgentConfig,
  loadAgentDescription,
} from "../../agents/loader.js";
import { listSkillsForRole, loadSkillBody, saveSkill, deleteSkill } from "../../skills/loader.js";

export interface AgentsRoutesOpts {
  dataDir: string;
}

function isValidRole(role: string): role is RoleSlug {
  return role in ROLE_CONFIGS;
}

function skillCount(dataDir: string, role: string): number {
  try {
    return readdirSync(join(dataDir, "skills", role)).filter((f) => f.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOpts> = async (app, { dataDir }) => {
  // GET /api/agents — list all agents
  app.get("/api/agents", async () =>
    Object.entries(ROLE_CONFIGS).map(([role, cfg]) => {
      const config = loadAgentConfig(dataDir, role);
      return {
        role,
        name: ROLE_DISPLAY_NAMES[role as RoleSlug] ?? role,
        lifecycle: cfg.lifecycle,
        model: config.model ?? ROLE_MODEL[role] ?? "gpt-5.4-mini",
        thinkingLevel: config.thinking_level ?? "off",
        tools: cfg.tools,
        skillCount: skillCount(dataDir, role),
        description: loadAgentDescription(dataDir, role),
      };
    }),
  );

  // GET /api/agents/:role/identity
  app.get<{ Params: { role: string } }>("/api/agents/:role/identity", async (req, reply) => {
    const { role } = req.params;
    if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
    return { body: loadAgentIdentity(dataDir, role) };
  });

  // PUT /api/agents/:role/identity
  app.put<{ Params: { role: string }; Body: { body: string } }>(
    "/api/agents/:role/identity",
    async (req, reply) => {
      const { role } = req.params;
      if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
      saveAgentIdentity(dataDir, role, req.body.body ?? "");
      return reply.send({ ok: true });
    },
  );

  // GET /api/agents/:role/config
  app.get<{ Params: { role: string } }>("/api/agents/:role/config", async (req, reply) => {
    const { role } = req.params;
    if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
    return loadAgentConfig(dataDir, role);
  });

  // PUT /api/agents/:role/config
  app.put<{ Params: { role: string }; Body: { model?: string; thinking_level?: string } }>(
    "/api/agents/:role/config",
    async (req, reply) => {
      const { role } = req.params;
      if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
      const existing = loadAgentConfig(dataDir, role);
      const updated = { ...existing, ...req.body };
      // Remove keys explicitly set to null/undefined (treat empty string model as "reset to default")
      if (!updated.model) delete updated.model;
      if (!updated.thinking_level || updated.thinking_level === "off") delete updated.thinking_level;
      saveAgentConfig(dataDir, role, updated);
      return reply.send({ ok: true });
    },
  );

  // Skill routes added in Task 7
};
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/server/routes/agents.test.ts 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server/routes/agents.ts packages/server/src/server/routes/agents.test.ts
git commit -m "feat(server): agents routes — identity, config, list"
```

---

## Task 7: Add skills CRUD routes to agents.ts

**Files:**
- Modify: `packages/server/src/server/routes/agents.ts`
- Modify: `packages/server/src/server/routes/agents.test.ts`

- [ ] **Step 1: Write failing tests for skill routes**

Append to `packages/server/src/server/routes/agents.test.ts`:

```typescript
describe("GET /api/agents/:role/skills", () => {
  it("returns empty array when no skills exist", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/skills" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns frontmatter-only list when skills exist", async () => {
    mkdirSync(join(dataDir, "skills/director"), { recursive: true });
    writeFileSync(
      join(dataDir, "skills/director/brief_parser.md"),
      "---\nname: brief_parser\ndescription: Parses briefs\n---\n\nSECRET BODY",
    );
    const res = await app.inject({ method: "GET", url: "/api/agents/director/skills" });
    const body = res.json<{ name: string; description: string }[]>();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("brief_parser");
    expect(body[0].description).toBe("Parses briefs");
    expect(JSON.stringify(body)).not.toContain("SECRET BODY");
  });
});

describe("GET /api/agents/:role/skills/:name", () => {
  it("returns 404 for unknown skill", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/skills/ghost" });
    expect(res.statusCode).toBe(404);
  });

  it("returns name, description, body for existing skill", async () => {
    mkdirSync(join(dataDir, "skills/director"), { recursive: true });
    writeFileSync(
      join(dataDir, "skills/director/brief_parser.md"),
      "---\nname: brief_parser\ndescription: Parses briefs\n---\n\nStep 1: parse.",
    );
    const res = await app.inject({ method: "GET", url: "/api/agents/director/skills/brief_parser" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ name: string; description: string; body: string }>();
    expect(body.name).toBe("brief_parser");
    expect(body.description).toBe("Parses briefs");
    expect(body.body).toContain("Step 1: parse.");
  });
});

describe("PUT /api/agents/:role/skills/:name", () => {
  it("creates or updates a skill", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agents/director/skills/my_skill",
      payload: { description: "Does something", body: "Step 1: do it." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);

    const get = await app.inject({ method: "GET", url: "/api/agents/director/skills/my_skill" });
    expect(get.json<{ body: string }>().body).toContain("Step 1: do it.");
  });
});

describe("POST /api/agents/:role/skills", () => {
  it("creates a new skill and returns ok", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/director/skills",
      payload: { name: "new_skill", description: "A new skill", body: "Do something new." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);

    const list = await app.inject({ method: "GET", url: "/api/agents/director/skills" });
    const names = list.json<{ name: string }[]>().map((s) => s.name);
    expect(names).toContain("new_skill");
  });
});

describe("DELETE /api/agents/:role/skills/:name", () => {
  it("deletes an existing skill", async () => {
    mkdirSync(join(dataDir, "skills/director"), { recursive: true });
    writeFileSync(
      join(dataDir, "skills/director/to_delete.md"),
      "---\nname: to_delete\ndescription: d\n---\nbody",
    );
    const res = await app.inject({
      method: "DELETE",
      url: "/api/agents/director/skills/to_delete",
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/agents/director/skills" });
    expect(list.json<unknown[]>()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/server/routes/agents.test.ts 2>&1 | grep -E "FAIL|PASS|Error" | head -15
```

Expected: new skill tests FAIL.

- [ ] **Step 3: Add skill routes to agents.ts**

Append these routes inside the `agentsRoutes` plugin, after the config PUT route (before the closing `}`):

```typescript
  // GET /api/agents/:role/skills
  app.get<{ Params: { role: string } }>("/api/agents/:role/skills", async (req, reply) => {
    const { role } = req.params;
    if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
    return listSkillsForRole(dataDir, role);
  });

  // GET /api/agents/:role/skills/:name
  app.get<{ Params: { role: string; name: string } }>(
    "/api/agents/:role/skills/:name",
    async (req, reply) => {
      const { role, name } = req.params;
      if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
      const metas = listSkillsForRole(dataDir, role);
      const meta = metas.find((s) => s.name === name);
      if (!meta) return reply.code(404).send({ error: "skill not found" });
      const body = loadSkillBody(dataDir, role, name) ?? "";
      return { ...meta, body };
    },
  );

  // PUT /api/agents/:role/skills/:name
  app.put<{ Params: { role: string; name: string }; Body: { description: string; body: string } }>(
    "/api/agents/:role/skills/:name",
    async (req, reply) => {
      const { role, name } = req.params;
      if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
      saveSkill(dataDir, role, name, req.body.description ?? "", req.body.body ?? "");
      return reply.send({ ok: true });
    },
  );

  // POST /api/agents/:role/skills
  app.post<{ Params: { role: string }; Body: { name: string; description: string; body: string } }>(
    "/api/agents/:role/skills",
    async (req, reply) => {
      const { role } = req.params;
      if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
      const { name, description, body } = req.body;
      if (!name || !description) return reply.code(400).send({ error: "name and description required" });
      saveSkill(dataDir, role, name, description, body ?? "");
      return reply.send({ ok: true });
    },
  );

  // DELETE /api/agents/:role/skills/:name
  app.delete<{ Params: { role: string; name: string } }>(
    "/api/agents/:role/skills/:name",
    async (req, reply) => {
      const { role, name } = req.params;
      if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
      deleteSkill(dataDir, role, name);
      return reply.send({ ok: true });
    },
  );
```

- [ ] **Step 4: Run all agent route tests**

```bash
cd packages/server && npx vitest run src/server/routes/agents.test.ts 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd packages/server && npx vitest run 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/server/routes/agents.ts packages/server/src/server/routes/agents.test.ts
git commit -m "feat(server): agents routes — skills CRUD (GET list, GET one, PUT, POST, DELETE)"
```

---

## Task 8: Frontend — nav + routes

**Files:**
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/components/Sidebar.tsx`
- Modify: `packages/web/src/components/BottomNav.tsx`

No automated tests — verify manually in browser.

- [ ] **Step 1: Add routes to App.tsx**

Replace `packages/web/src/App.tsx` with:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.js';
import { BottomNav } from './components/BottomNav.js';
import { HQ } from './views/HQ.js';
import { Workshop } from './views/Workshop.js';
import { Approvals } from './views/Approvals.js';
import { Memory } from './views/Memory.js';
import { Campaigns } from './views/Campaigns.js';
import { Agency } from './views/Agency.js';
import { AgentConfig } from './views/AgentConfig.js';

export function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Routes>
          <Route path="/hq" element={<HQ />} />
          <Route path="/" element={<Workshop />} />
          <Route path="/jovahagyas" element={<Approvals />} />
          <Route path="/jovahagyas/:id" element={<Approvals />} />
          <Route path="/kampanyok" element={<Campaigns />} />
          <Route path="/memoria" element={<Memory />} />
          <Route path="/ugynokseg" element={<Agency />} />
          <Route path="/ugynokseg/:role" element={<AgentConfig />} />
          <Route path="*" element={<Navigate to="/hq" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Add Ügynökség to Sidebar.tsx**

In `packages/web/src/components/Sidebar.tsx`, add the nav link after the Memória item:

```tsx
        <SidebarItem to="/memoria" label="Memória" />
        <SidebarItem to="/ugynokseg" label="Ügynökség" />
```

- [ ] **Step 3: Add Ügynökség to BottomNav.tsx**

In `packages/web/src/components/BottomNav.tsx`, add after the Memória item:

```tsx
      <BottomNavItem to="/memoria" label="Memória" />
      <BottomNavItem to="/ugynokseg" label="Ügynökség" />
```

- [ ] **Step 4: TS check**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors about missing Agency and AgentConfig modules (views don't exist yet — that's fine, they come in Tasks 10–11). If errors are only about missing imports, continue.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/components/Sidebar.tsx packages/web/src/components/BottomNav.tsx
git commit -m "feat(web): add /ugynokseg routes and Ügynökség nav items"
```

---

## Task 9: agents API client in api.ts

**Files:**
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: Append agentsApi to api.ts**

Add at the end of `packages/web/src/lib/api.ts`:

```typescript
// -------------------------
// Agents
// -------------------------

export interface AgentSummary {
  role: string;
  name: string;
  lifecycle: "warm" | "transient";
  model: string;
  thinkingLevel: string;
  tools: string[];
  skillCount: number;
  description: string;
}

export interface AgentSkillMeta {
  name: string;
  description: string;
}

export interface AgentSkillFull extends AgentSkillMeta {
  body: string;
}

export interface AgentConfigPayload {
  model?: string;
  thinking_level?: string;
}

export const agentsApi = {
  list: (): Promise<AgentSummary[]> => fetch("/api/agents").then(json),

  getIdentity: (role: string): Promise<{ body: string }> =>
    fetch(`/api/agents/${role}/identity`).then(json),

  putIdentity: (role: string, body: string): Promise<{ ok: true }> =>
    put(`/api/agents/${role}/identity`, { body }),

  listSkills: (role: string): Promise<AgentSkillMeta[]> =>
    fetch(`/api/agents/${role}/skills`).then(json),

  getSkill: (role: string, name: string): Promise<AgentSkillFull> =>
    fetch(`/api/agents/${role}/skills/${name}`).then(json),

  putSkill: (role: string, name: string, data: { description: string; body: string }): Promise<{ ok: true }> =>
    put(`/api/agents/${role}/skills/${name}`, data),

  postSkill: (role: string, data: { name: string; description: string; body: string }): Promise<{ ok: true }> =>
    post(`/api/agents/${role}/skills`, data),

  deleteSkill: (role: string, name: string): Promise<{ ok: true }> =>
    fetch(`/api/agents/${role}/skills/${name}`, { method: "DELETE" }).then(json),

  getConfig: (role: string): Promise<AgentConfigPayload> =>
    fetch(`/api/agents/${role}/config`).then(json),

  putConfig: (role: string, config: AgentConfigPayload): Promise<{ ok: true }> =>
    put(`/api/agents/${role}/config`, config),
};
```

- [ ] **Step 2: TS check**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | grep "api.ts" | head -10
```

Expected: no errors in api.ts.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat(web): add agentsApi client methods"
```

---

## Task 10: Create Agency.tsx — overview card grid

**Files:**
- Create: `packages/web/src/views/Agency.tsx`

- [ ] **Step 1: Create Agency.tsx**

Create `packages/web/src/views/Agency.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentsApi, type AgentSummary } from '../lib/api.js';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

const THINKING_LABELS: Record<string, string> = {
  off: 'Ki', minimal: 'Minimális', low: 'Alacsony', medium: 'Közepes', high: 'Magas',
};

export function Agency() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const activeAgents = useMarqueeStore((s) => s.activeAgents);
  const navigate = useNavigate();

  useEffect(() => {
    agentsApi.list().then(setAgents).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 overflow-auto p-6 md:p-8">
      <h1 className="text-xl font-bold text-ink-1 mb-6">Ügynökség</h1>

      {loading ? (
        <p className="text-sm text-ink-3">Betöltés…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.role}
              agent={agent}
              isActive={activeAgents.has(agent.role)}
              onClick={() => navigate(`/ugynokseg/${agent.role}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  isActive,
  onClick,
}: {
  agent: AgentSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  const visibleTools = agent.tools.slice(0, 3);
  const hiddenCount = agent.tools.length - visibleTools.length;

  return (
    <button
      onClick={onClick}
      className="text-left bg-sidebar-bg border border-sidebar-border rounded-lg p-4 hover:border-primary/40 transition-colors group"
    >
      <div className="flex items-start gap-2 mb-1">
        <span
          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-sidebar-border'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-ink-1">{agent.name}</span>
            <span className="text-sidebar-muted group-hover:text-ink-3 text-xs transition-colors">›</span>
          </div>
          {agent.description && (
            <p className="text-xs text-ink-3 mt-0.5 leading-relaxed line-clamp-2">
              {agent.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
          agent.lifecycle === 'warm'
            ? 'bg-blue-950/40 text-blue-400 border-blue-800/50'
            : 'bg-green-950/40 text-green-400 border-green-800/50'
        }`}>
          {agent.lifecycle}
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sidebar-active text-ink-3 border border-sidebar-border">
          {agent.model}
        </span>
        <span className="text-[10px] text-ink-3">
          {agent.skillCount} skill
        </span>
      </div>

      <div className="mt-2">
        <p className="text-[10px] text-ink-3 leading-relaxed">
          <span className="text-sidebar-muted mr-1">Tools:</span>
          {visibleTools.join(', ')}
          {hiddenCount > 0 && <span className="text-sidebar-muted"> +{hiddenCount}</span>}
        </p>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: TS check**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | grep "Agency" | head -10
```

Expected: no errors in Agency.tsx.

- [ ] **Step 3: Manual smoke test**

```bash
# In one terminal:
cd ~/Projects/Homelab/marquee && DATA_DIR=~/.marquee-dev npm run dev

# Open http://localhost:5173/ugynokseg
# Verify: 7 agent cards visible, bulb indicators match sidebar state
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/views/Agency.tsx
git commit -m "feat(web): Agency view — agent card grid"
```

---

## Task 11: Create AgentConfig.tsx — Identitás + Beállítások tabs

**Files:**
- Create: `packages/web/src/views/AgentConfig.tsx`

- [ ] **Step 1: Create AgentConfig.tsx with Identitás and Beállítások tabs**

Create `packages/web/src/views/AgentConfig.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentsApi, type AgentSkillMeta, type AgentSkillFull, type AgentConfigPayload } from '../lib/api.js';

type Tab = 'identity' | 'skills' | 'settings';

const MODEL_OPTIONS = [
  { value: '', label: '— alapértelmezett —' },
  { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini (fast)' },
  { value: 'gpt-5.4', label: 'gpt-5.4 (balanced)' },
  { value: 'gpt-5.5', label: 'gpt-5.5 (powerful)' },
];

const THINKING_OPTIONS = [
  { value: 'off', label: 'Ki' },
  { value: 'minimal', label: 'Minimális' },
  { value: 'low', label: 'Alacsony' },
  { value: 'medium', label: 'Közepes' },
  { value: 'high', label: 'Magas' },
];

export function AgentConfig() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('identity');

  if (!role) return null;

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-sidebar-border bg-sidebar-bg shrink-0">
        <button
          onClick={() => navigate('/ugynokseg')}
          className="text-xs text-ink-3 hover:text-ink-1 transition-colors"
        >
          ← Ügynökség
        </button>
        <span className="text-sidebar-border">|</span>
        <span className="font-semibold text-sm text-ink-1 capitalize">{role}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-sidebar-border bg-sidebar-bg shrink-0 px-6">
        {(['identity', 'skills', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-3 hover:text-ink-1'
            }`}
          >
            {t === 'identity' ? 'Identitás' : t === 'skills' ? 'Skillek' : 'Beállítások'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'identity' && <IdentityTab role={role} />}
        {tab === 'skills' && <SkillsTab role={role} />}
        {tab === 'settings' && <SettingsTab role={role} />}
      </div>
    </div>
  );
}

// ─── Identitás tab ───────────────────────────────────────────────────────────

function IdentityTab({ role }: { role: string }) {
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    agentsApi.getIdentity(role).then((r) => { setBody(r.body); setSaved(r.body); });
  }, [role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await agentsApi.putIdentity(role, body);
      setSaved(body);
    } catch {
      setToast('Mentés sikertelen.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const dirty = body !== saved;

  return (
    <div className="max-w-2xl">
      {toast && (
        <div className="mb-3 text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {toast}
        </div>
      )}
      <p className="text-xs text-ink-3 mb-3">
        Az agent személyisége és szerepe. Ez a system prompt első blokkjaként töltődik be.
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={20}
        placeholder={`Te vagy a ${role} agentje ennek az AI marketing ügynökségnek.\n\nÍrd le a szerepét, feladatait és döntéshozatali stílusát.`}
        className="w-full font-mono text-xs bg-sidebar-bg border border-sidebar-border rounded-lg p-3 text-ink-1 placeholder:text-ink-3 resize-y focus:outline-none focus:border-primary/50"
      />
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="text-xs font-medium px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Mentés…' : 'Mentés'}
        </button>
        {dirty && <span className="text-xs text-ink-3">Nem mentett változások</span>}
      </div>
    </div>
  );
}

// ─── Beállítások tab ─────────────────────────────────────────────────────────

function SettingsTab({ role }: { role: string }) {
  const [model, setModel] = useState('');
  const [thinkingLevel, setThinkingLevel] = useState('off');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    agentsApi.getConfig(role).then((cfg) => {
      setModel(cfg.model ?? '');
      setThinkingLevel(cfg.thinking_level ?? 'off');
    });
  }, [role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await agentsApi.putConfig(role, {
        model: model || undefined,
        thinking_level: thinkingLevel === 'off' ? undefined : thinkingLevel,
      });
    } catch {
      setToast('Mentés sikertelen.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-sm space-y-4">
      {toast && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {toast}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1.5 uppercase tracking-wider">
          Modell
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full text-xs bg-sidebar-bg border border-sidebar-border rounded-lg px-3 py-2 text-ink-1"
        >
          {MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1.5 uppercase tracking-wider">
          Gondolkodási szint
        </label>
        <select
          value={thinkingLevel}
          onChange={(e) => setThinkingLevel(e.target.value)}
          className="w-full text-xs bg-sidebar-bg border border-sidebar-border rounded-lg px-3 py-2 text-ink-1"
        >
          {THINKING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs font-medium px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {saving ? 'Mentés…' : 'Mentés'}
      </button>
    </div>
  );
}

// ─── Skillek tab placeholder (implemented in Task 12) ────────────────────────

function SkillsTab({ role }: { role: string }) {
  return (
    <div className="text-xs text-ink-3">Skillek — következő task</div>
  );
}
```

- [ ] **Step 2: TS check**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | grep "AgentConfig" | head -10
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
# Dev server futtatása:
cd ~/Projects/Homelab/marquee && DATA_DIR=~/.marquee-dev npm run dev

# 1. Nyisd meg http://localhost:5173/ugynokseg — ellenőrizd: 7 kártya jelenik meg
# 2. Kattints a Director kártyára → /ugynokseg/director
# 3. Identitás fül: szerkeszthető textarea, Mentés gomb
# 4. Beállítások fül: model + thinking level dropdownok, Mentés
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/views/AgentConfig.tsx
git commit -m "feat(web): AgentConfig view — Identitás + Beállítások tabs"
```

---

## Task 12: AgentConfig.tsx — Skillek tab (cards + modal)

**Files:**
- Modify: `packages/web/src/views/AgentConfig.tsx`

- [ ] **Step 1: Replace the SkillsTab placeholder**

In `packages/web/src/views/AgentConfig.tsx`, replace the `SkillsTab` function (the placeholder at the bottom) with the full implementation:

```tsx
// ─── Skillek tab ─────────────────────────────────────────────────────────────

function SkillsTab({ role }: { role: string }) {
  const [skills, setSkills] = useState<AgentSkillMeta[]>([]);
  const [modalSkill, setModalSkill] = useState<AgentSkillFull | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    agentsApi.listSkills(role).then(setSkills);
  }, [role]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  function openEdit(name: string) {
    agentsApi.getSkill(role, name).then((s) => setModalSkill(s));
  }

  function openNew() {
    setModalSkill('new');
  }

  async function handleSave(data: AgentSkillFull) {
    try {
      if (modalSkill === 'new') {
        await agentsApi.postSkill(role, data);
      } else {
        await agentsApi.putSkill(role, data.name, { description: data.description, body: data.body });
      }
      setModalSkill(null);
      loadSkills();
    } catch {
      setToast('Mentés sikertelen.');
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Törlöd a „${name}" skillt? Ez nem visszavonható.`)) return;
    try {
      await agentsApi.deleteSkill(role, name);
      setModalSkill(null);
      loadSkills();
    } catch {
      setToast('Törlés sikertelen.');
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div>
      {toast && (
        <div className="mb-3 text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {toast}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {skills.map((s) => (
          <div
            key={s.name}
            className="bg-sidebar-bg border border-sidebar-border rounded-lg p-3"
          >
            <p className="text-xs font-semibold text-ink-1 mb-1">{s.name}</p>
            <p className="text-xs text-ink-3 line-clamp-2 mb-3">{s.description}</p>
            <button
              onClick={() => openEdit(s.name)}
              className="text-xs font-medium px-3 py-1 rounded bg-sidebar-active text-ink-2 hover:text-ink-1 transition-colors"
            >
              Szerkesztés
            </button>
          </div>
        ))}
        {/* New skill card */}
        <button
          onClick={openNew}
          className="border border-dashed border-sidebar-border rounded-lg p-3 flex items-center justify-center text-xs text-ink-3 hover:border-primary/40 hover:text-ink-1 transition-colors"
        >
          + Új skill
        </button>
      </div>

      {modalSkill !== null && (
        <SkillModal
          initial={modalSkill === 'new' ? { name: '', description: '', body: '' } : modalSkill}
          isNew={modalSkill === 'new'}
          onSave={handleSave}
          onDelete={modalSkill !== 'new' ? () => handleDelete((modalSkill as AgentSkillFull).name) : undefined}
          onClose={() => setModalSkill(null)}
        />
      )}
    </div>
  );
}

function SkillModal({
  initial,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  initial: AgentSkillFull;
  isNew: boolean;
  onSave: (data: AgentSkillFull) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [body, setBody] = useState(initial.body);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await onSave({ name, description, body });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-sidebar-bg border border-sidebar-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border shrink-0">
          <h2 className="text-sm font-semibold text-ink-1">
            {isNew ? 'Új skill' : `Szerkesztés: ${initial.name}`}
          </h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink-1 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1 uppercase tracking-wider">
              Skill neve
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={!isNew}
              placeholder="pl. brief_parser"
              className="w-full text-xs bg-cream border border-sidebar-border rounded-lg px-3 py-2 text-ink-1 placeholder:text-ink-3 font-mono read-only:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1 uppercase tracking-wider">
              Leírás <span className="normal-case font-normal">(description — ez jelenik meg a catalog-ban)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mikor aktiválja az agent ezt a skillt…"
              className="w-full text-xs bg-cream border border-sidebar-border rounded-lg px-3 py-2 text-ink-1 placeholder:text-ink-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1 uppercase tracking-wider">
              Body <span className="normal-case font-normal">(instrukciók — on-demand töltődik be)</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Részletes instrukciók az agent számára…"
              className="w-full font-mono text-xs bg-cream border border-sidebar-border rounded-lg px-3 py-2 text-ink-1 placeholder:text-ink-3 resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-sidebar-border shrink-0">
          <div>
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Törlés
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg border border-sidebar-border text-ink-3 hover:text-ink-1 transition-colors"
            >
              Mégse
            </button>
            <button
              onClick={submit}
              disabled={saving || !name || !description}
              className="text-xs font-medium px-4 py-1.5 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {saving ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TS check**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
# Dev server futtatása:
cd ~/Projects/Homelab/marquee && DATA_DIR=~/.marquee-dev npm run dev

# 1. Nyisd meg http://localhost:5173/ugynokseg/director
# 2. Kattints a Skillek fülre — skill kártyák megjelennek
# 3. Kattints egy Szerkesztés gombra — modal megnyílik, description + body betöltődik
# 4. Módosíts valamit, mentsd el — kártya frissül
# 5. Kattints "+ Új skill" — üres modal nyílik, kitölthető és menthető
# 6. Törlés gombra kattintva: confirm dialóg jelenik meg, majd a skill eltűnik
```

- [ ] **Step 4: Run full test suite**

```bash
cd packages/server && npx vitest run 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 5: Final TS check**

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -10
cd packages/server && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors in either package.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/views/AgentConfig.tsx
git commit -m "feat(web): AgentConfig Skillek tab — card grid + edit/create/delete modal"
```

---

## Self-Review Checklist

- [x] **loadSkillCatalog** — Task 1 ✓
- [x] **loadBrandVoiceInstruction** — Task 1 ✓
- [x] **saveSkill / deleteSkill** — Task 1 ✓
- [x] **agents/loader.ts** (identity, config, seed, description) — Task 2 ✓
- [x] **ROLE_DISPLAY_NAMES / ROLE_MODEL / modelForRoleWithOverride** — Task 3 ✓
- [x] **factory.ts refactor** (progressive disclosure + load_skill tool) — Task 4 ✓
- [x] **seedDefaultAgents wired at startup** — Task 5 ✓
- [x] **agentsRoutes registered** — Task 5 ✓
- [x] **Identity + config + list routes** — Task 6 ✓
- [x] **Skills CRUD routes** — Task 7 ✓
- [x] **Nav + routes** (Sidebar, BottomNav, App.tsx) — Task 8 ✓
- [x] **agentsApi client** — Task 9 ✓
- [x] **Agency.tsx** (card grid) — Task 10 ✓
- [x] **AgentConfig.tsx** (Identitás + Beállítások tabs) — Task 11 ✓
- [x] **AgentConfig.tsx** (Skillek tab + modal) — Task 12 ✓
- [x] **_common/brand_voice_instruction.md** — handled as brandVoiceInstructionBlock in Task 4 ✓
- [x] **Card description source** — loadAgentDescription (first para of identity.md, max 100 chars) in Task 2 + GET /api/agents route in Task 6 ✓
- [x] **New skill filename** — `<name>.md` convention documented in Task 7 route (POST uses saveSkill which writes `${name}.md`) ✓
