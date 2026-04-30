# Marquee v0.4 — ChatGPT Subscription Provider + Context Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `openai-subscription` provider mode backed by OAuth credentials, and compress old tool result messages to 1-line summaries to reduce context window size.

**Architecture:** `AuthManager` (`src/providers/auth.ts`) caches the openai-codex OAuth token in memory and auto-refreshes before expiry; `factory.ts` prepends `[tool:name]` to every tool result; `transform-context.ts` replaces old tool results outside the recency window with 1-line summaries. `AgentConfig` gains a `model` field for per-role model override in subscription mode.

**Tech Stack:** Node.js 22, TypeScript, `@mariozechner/pi-ai` (already installed — exports `openaiCodexOAuthProvider`, `refreshOpenAICodexToken`, `OAuthCredentials`), Vitest.

---

## File Map

**New files**
- `packages/server/src/providers/auth.ts` — `AuthManager` class
- `packages/server/src/providers/auth.test.ts`

**Modified files**
- `packages/server/src/agents/config.ts` — add `model?: string` to `AgentConfig`
- `packages/server/src/agents/config.test.ts` — add model field tests
- `packages/server/src/providers/index.ts` — add `openai-subscription` mode + `configModel` param
- `packages/server/src/providers/index.test.ts` — add subscription mode tests
- `packages/server/src/agents/factory.ts` — tool result prefix + `authManager` opts + `modelForRole` call
- `packages/server/src/agents/transform-context.ts` — replace `summarize()` with `collapseToolPairs()`
- `packages/server/src/agents/transform-context.test.ts` — update + extend
- `packages/server/src/broker/router.ts` — `authManager?` constructor param, pass to `makeAgent`
- `packages/server/src/index.ts` — `AuthManager` lifecycle

---

### Task 1: AgentConfig model field

**Files:**
- Modify: `packages/server/src/agents/config.ts`
- Modify: `packages/server/src/agents/config.test.ts`

- [ ] **Step 1: Add failing test for model field**

In `packages/server/src/agents/config.test.ts`, add inside `describe("loadAgentConfig")`:

```typescript
it("parses model field from config.md", () => {
  mkdirSync(join(dir, "agents", "director"), { recursive: true });
  writeFileSync(join(dir, "agents", "director", "config.md"),
    "---\nmodel: gpt-5.1\nlanguage: hu\n---\n");
  const config = loadAgentConfig(dir, "director");
  expect(config?.model).toBe("gpt-5.1");
});
```

Add inside `describe("buildBehaviorBlock")`:

```typescript
it("does NOT include model in behavior block", () => {
  const block = buildBehaviorBlock({ model: "gpt-5.1", language: "hu" });
  expect(block).not.toContain("gpt-5.1");
  expect(block).toContain("Language: hu");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/agents/config.test.ts
```

Expected: FAIL — `model` field not in `AgentConfig`.

- [ ] **Step 3: Add model field to AgentConfig**

In `packages/server/src/agents/config.ts`, add `model?: string` to the interface:

```typescript
export interface AgentConfig {
  style?: "terse" | "verbose" | "balanced";
  tone?: "authoritative" | "friendly" | "neutral";
  response_length?: "concise" | "detailed";
  language?: string;
  model?: string;
  system_prompt_override?: string;
}
```

`buildBehaviorBlock` needs no change — it already ignores unknown fields because it only reads `style`, `tone`, `response_length`, `language`, `system_prompt_override`.

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/agents/config.test.ts
```

Expected: PASS — all 6 existing tests + 2 new = 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/agents/config.ts packages/server/src/agents/config.test.ts
git commit -m "feat(agents): add model field to AgentConfig"
```

---

### Task 2: Provider mode extension — openai-subscription

**Files:**
- Modify: `packages/server/src/providers/index.ts`
- Modify: `packages/server/src/providers/index.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/server/src/providers/index.test.ts`, add inside `describe("providers")`:

```typescript
it("returns openai-codex model for director in openai-subscription mode (no override)", () => {
  process.env.MARQUEE_PROVIDER_MODE = "openai-subscription";
  const m = modelForRole("director");
  expect(m.provider).toBe("openai-codex");
  expect(m.id).toBe("gpt-5.1");
});

it("returns openai-codex fallback for eval-judge in openai-subscription mode", () => {
  process.env.MARQUEE_PROVIDER_MODE = "openai-subscription";
  const m = modelForRole("eval-judge");
  expect(m.provider).toBe("openai-codex");
  expect(m.id).toBe("gpt-5.1-codex-mini");
});

it("uses configModel override in openai-subscription mode", () => {
  process.env.MARQUEE_PROVIDER_MODE = "openai-subscription";
  const m = modelForRole("director", "claude-sonnet-4-6");
  expect(m.provider).toBe("openai-codex");
  expect(m.id).toBe("claude-sonnet-4-6");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/providers/index.test.ts
```

Expected: FAIL — `"openai-subscription"` not a valid mode.

- [ ] **Step 3: Update providers/index.ts**

Replace the entire contents of `packages/server/src/providers/index.ts`:

```typescript
import { getModel, getEnvApiKey } from "@mariozechner/pi-ai";

export type ProviderMode = "flat" | "api" | "openai-subscription";
export const providerMode = (): ProviderMode =>
	(process.env.MARQUEE_PROVIDER_MODE as ProviderMode) ?? "flat";

const FLAT_MAP: Record<string, string> = {
	director: "kimi-k2.6",
	"content-lead": "kimi-k2.6",
	copywriter: "kimi-k2.6",
	"eval-judge": "minimax-m2.7",
};

const API_MAP: Record<string, string> = {
	director: "anthropic/claude-sonnet-4.6",
	"content-lead": "anthropic/claude-haiku-4.5",
	copywriter: "anthropic/claude-sonnet-4.6",
	"eval-judge": "anthropic/claude-haiku-4.5",
};

const SUBSCRIPTION_FALLBACK_MAP: Record<string, string> = {
	director:            "gpt-5.1",
	copywriter:          "gpt-5.1",
	"content-lead":      "gpt-5.1-codex-mini",
	"distribution-lead": "gpt-5.1-codex-mini",
	"insights-lead":     "gpt-5.1-codex-mini",
	"social-manager":    "gpt-5.1-codex-mini",
	"seo-analyst":       "gpt-5.1-codex-mini",
	"eval-judge":        "gpt-5.1-codex-mini",
};

export function modelForRole(role: string, configModel?: string) {
	const mode = providerMode();
	if (mode === "flat") {
		const id = FLAT_MAP[role] ?? "kimi-k2.6";
		return getModel("opencode-go", id as never)!;
	}
	if (mode === "api") {
		const id = API_MAP[role] ?? "anthropic/claude-haiku-4.5";
		return getModel("openrouter", id as never)!;
	}
	// openai-subscription
	const id = configModel ?? SUBSCRIPTION_FALLBACK_MAP[role] ?? "gpt-5.1-codex-mini";
	return getModel("openai-codex", id as never)!;
}

export { getEnvApiKey };
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/providers/index.test.ts
```

Expected: PASS — all 3 existing + 3 new = 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/providers/index.ts packages/server/src/providers/index.test.ts
git commit -m "feat(providers): add openai-subscription mode with fallback model map"
```

---

### Task 3: AuthManager service

**Files:**
- Create: `packages/server/src/providers/auth.ts`
- Create: `packages/server/src/providers/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/providers/auth.test.ts`:

```typescript
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetApiKey = vi.fn();
const mockRefreshToken = vi.fn();

vi.mock("@mariozechner/pi-ai", () => ({
  refreshOpenAICodexToken: mockRefreshToken,
  openaiCodexOAuthProvider: { getApiKey: mockGetApiKey },
}));

import { AuthManager } from "./auth.js";

function writeAuthFile(dir: string, creds: Record<string, unknown>): string {
  const path = join(dir, "auth.json");
  writeFileSync(path, JSON.stringify({ "openai-codex": creds }), "utf8");
  return path;
}

describe("AuthManager", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "auth-test-"));
    mockGetApiKey.mockReturnValue("Bearer cached-token");
    mockRefreshToken.mockResolvedValue({
      refresh: "new-refresh",
      access: "new-access",
      expires: Date.now() + 3600000,
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("throws when auth file does not exist", async () => {
    const manager = new AuthManager(join(dir, "missing.json"));
    await expect(manager.start()).rejects.toThrow("Run login first");
  });

  it("caches api key when token is valid", async () => {
    const path = writeAuthFile(dir, {
      refresh: "r1", access: "a1", expires: Date.now() + 3600000,
    });
    const manager = new AuthManager(path);
    await manager.start();
    manager.stop();
    expect(manager.getApiKey("openai-codex")).toBe("Bearer cached-token");
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it("refreshes token when expired at startup", async () => {
    const path = writeAuthFile(dir, {
      refresh: "old-refresh", access: "old-access", expires: Date.now() - 1000,
    });
    const manager = new AuthManager(path);
    await manager.start();
    manager.stop();
    expect(mockRefreshToken).toHaveBeenCalledWith("old-refresh");
    expect(manager.getApiKey("openai-codex")).toBe("Bearer cached-token");
  });

  it("returns undefined for other providers", async () => {
    const path = writeAuthFile(dir, {
      refresh: "r1", access: "a1", expires: Date.now() + 3600000,
    });
    const manager = new AuthManager(path);
    await manager.start();
    manager.stop();
    expect(manager.getApiKey("openrouter")).toBeUndefined();
    expect(manager.getApiKey("opencode-go")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/providers/auth.test.ts
```

Expected: FAIL — `Cannot find module ./auth.js`.

- [ ] **Step 3: Create auth.ts**

Create `packages/server/src/providers/auth.ts`:

```typescript
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { openaiCodexOAuthProvider, refreshOpenAICodexToken } from "@mariozechner/pi-ai";
import type { OAuthCredentials } from "@mariozechner/pi-ai";

type AuthFile = Record<string, OAuthCredentials>;

export class AuthManager {
  private cachedApiKey: string | null = null;
  private credentials: OAuthCredentials | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private authFilePath: string) {}

  async start(): Promise<void> {
    if (!existsSync(this.authFilePath)) {
      throw new Error(
        `openai-subscription mode requires auth credentials. ` +
        `Run login first and ensure auth file exists at ${this.authFilePath}`,
      );
    }
    const file = JSON.parse(readFileSync(this.authFilePath, "utf8")) as AuthFile;
    let credentials = file["openai-codex"];
    if (!credentials) {
      throw new Error(`No openai-codex credentials found in ${this.authFilePath}`);
    }
    if (credentials.expires < Date.now()) {
      credentials = await refreshOpenAICodexToken(credentials.refresh);
      file["openai-codex"] = credentials;
      writeFileSync(this.authFilePath, JSON.stringify(file, null, 2), "utf8");
    }
    this.credentials = credentials;
    this.cachedApiKey = openaiCodexOAuthProvider.getApiKey(credentials);
    this.refreshTimer = setInterval(() => { void this.checkAndRefresh(); }, 30 * 60 * 1000);
  }

  private async checkAndRefresh(): Promise<void> {
    if (!this.credentials) return;
    if (this.credentials.expires - Date.now() < 5 * 60 * 1000) {
      try {
        const newCreds = await refreshOpenAICodexToken(this.credentials.refresh);
        const file = JSON.parse(readFileSync(this.authFilePath, "utf8")) as AuthFile;
        file["openai-codex"] = newCreds;
        writeFileSync(this.authFilePath, JSON.stringify(file, null, 2), "utf8");
        this.credentials = newCreds;
        this.cachedApiKey = openaiCodexOAuthProvider.getApiKey(newCreds);
      } catch (e) {
        console.error("[AuthManager] token refresh failed:", e);
      }
    }
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getApiKey(provider: string): string | undefined {
    if (provider === "openai-codex") return this.cachedApiKey ?? undefined;
    return undefined;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/providers/auth.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/providers/auth.ts packages/server/src/providers/auth.test.ts
git commit -m "feat(providers): add AuthManager for openai-codex OAuth token lifecycle"
```

---

### Task 4: Tool result prefix in factory + authManager opts

**Files:**
- Modify: `packages/server/src/agents/factory.ts`

- [ ] **Step 1: Update MakeAgentOpts and tool execution in factory.ts**

Open `packages/server/src/agents/factory.ts`.

**4a.** Add import at the top:

```typescript
import type { AuthManager } from "../providers/auth.js";
```

**4b.** Add `authManager?: AuthManager` to `MakeAgentOpts`:

```typescript
export interface MakeAgentOpts {
	role: string;
	dataDir: string;
	db: AgencyDb;
	sessionId: string;
	delegationId?: string;
	threadId?: string;
	authManager?: AuthManager;
	emit: (eventType: string, payload: Record<string, unknown>) => void;
}
```

**4c.** Pass `config?.model` to `modelForRole`. Find the existing line:

```typescript
const model = modelForRole(opts.role);
```

Replace with:

```typescript
const config = loadAgentConfig(opts.dataDir, opts.role);
const model = modelForRole(opts.role, config?.model ?? undefined);
```

Note: `loadAgentConfig` is already imported and already called in `buildSystemPrompt`. This call in `makeAgent` is a second call — it reads the same file. This is acceptable (small file, cold path). Do NOT remove the call in `buildSystemPrompt`.

**4d.** In the tool execution wrapper, add the `[tool:name]` prefix. Find:

```typescript
const text = typeof value === "string" ? value : JSON.stringify(value);
return {
  content: [{ type: "text", text }],
  details: value,
};
```

Replace with:

```typescript
const text = typeof value === "string" ? value : JSON.stringify(value);
const prefixed = `[tool:${t.name}]\n${text}`;
return {
  content: [{ type: "text", text: prefixed }],
  details: value,
};
```

**4e.** Update `getApiKey` callback to use `authManager` when available:

```typescript
getApiKey: (provider: string) =>
  opts.authManager?.getApiKey(provider) ?? getEnvApiKey(provider) ?? undefined,
```

- [ ] **Step 2: Run all server tests**

```bash
cd packages/server && npm test
```

Expected: PASS — all 126+ tests green. (The prefix is added to all tool results but no existing test checks exact tool result content.)

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/agents/factory.ts
git commit -m "feat(agents): add [tool:name] prefix to tool results, authManager in makeAgent opts"
```

---

### Task 5: collapseToolPairs in transform-context

**Files:**
- Modify: `packages/server/src/agents/transform-context.ts`
- Modify: `packages/server/src/agents/transform-context.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/server/src/agents/transform-context.test.ts`, REPLACE the existing "prunes when message count exceeds keepRecent" test and ADD new tests:

```typescript
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTransformContext } from "./transform-context.js";
import type { StandardMessage } from "./messages.js";

describe("transformContext", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-tc-"));
    mkdirSync(join(dir, "memory"));
    writeFileSync(
      join(dir, "memory/client_profile.md"),
      "---\nclient_name: Stackly\nbrand_voice: tight\n---\n\nbody\n",
    );
    writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: data-driven\n---\nx");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("prepends memory block as first user message", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 50 });
    const out = await tc([{ role: "user", content: "hi" }]);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].role).toBe("user");
    expect(out[0].content).toContain("Stackly");
    expect(out[0].content).toContain("data-driven");
  });

  it("preserves all old messages outside keepRecent window (no messages omitted)", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 5 });
    const many = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
    const out = await tc(many);
    // 1 memory + 15 old (preserved) + 5 recent = 21
    expect(out.length).toBe(21);
    expect(out.some((m) => "content" in m && m.content === "m0")).toBe(true);
    expect(out.some((m) => "content" in m && m.content.includes("[earlier turns summarized"))).toBe(false);
  });

  it("compresses prefixed web_fetch result outside window to 1-line summary", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 3 });
    const messages: StandardMessage[] = [
      { role: "assistant", content: "fetching..." },
      { role: "tool", toolCallId: "c1", content: "[tool:web_fetch]\n" + "long html content ".repeat(200) },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
      { role: "user", content: "r3" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe("[tool:web_fetch → content fetched]");
  });

  it("compresses delegate_to_lead result outside window", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "director", keepRecent: 2 });
    const messages: StandardMessage[] = [
      { role: "tool", toolCallId: "c1", content: '[tool:delegate_to_lead]\n{"delegationId":"abc-123"}' },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("abc-123");
    expect(toolMsg?.content).toBe("[tool:delegate_to_lead → delegated (id: abc-123)]");
  });

  it("leaves prefixed tool result inside recent window unchanged", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 5 });
    const fullContent = "[tool:web_fetch]\n" + "x".repeat(3000);
    const messages: StandardMessage[] = [
      { role: "user", content: "old1" },
      { role: "tool", toolCallId: "c1", content: fullContent },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
      { role: "user", content: "r3" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe(fullContent);
  });

  it("leaves read_memory tool result unchanged even outside window", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 2 });
    const memContent = "[tool:read_memory]\n{\"body\": \"important context\"}";
    const messages: StandardMessage[] = [
      { role: "tool", toolCallId: "c1", content: memContent },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe(memContent);
  });

  it("leaves tool result with no prefix unchanged", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 2 });
    const legacyContent = '{"ok":true}';
    const messages: StandardMessage[] = [
      { role: "tool", toolCallId: "c1", content: legacyContent },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe(legacyContent);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npx vitest run src/agents/transform-context.test.ts
```

Expected: FAIL on multiple tests — `collapseToolPairs` not implemented, old "summarized" test now expects different behavior.

- [ ] **Step 3: Implement collapseToolPairs in transform-context.ts**

Replace the entire contents of `packages/server/src/agents/transform-context.ts`:

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readMemoryFile } from "../memory/read.js";
import type { AgencyMessage, StandardMessage } from "./messages.js";
import { convertToLlm } from "./convert-to-llm.js";

export interface TransformContextOptions {
  dataDir: string;
  role: string;
  keepRecent?: number;
}

const RELEVANT_MEMORY_FOR_ROLE: Record<string, string[]> = {
  director: ["client_profile", "brand_guidelines", "ongoing_campaigns",
             "daily_notes/YESTERDAY", "daily_notes/2_DAYS_AGO", "daily_notes/3_DAYS_AGO"],
  "content-lead": ["client_profile", "brand_guidelines", "content_history"],
  copywriter: ["client_profile", "brand_guidelines", "content_history"],
  "eval-judge": ["client_profile", "brand_guidelines"],
};

function resolveName(name: string, today: Date): string {
  if (name.startsWith("daily_notes/")) {
    const label = name.slice("daily_notes/".length);
    const d = new Date(today);
    if (label === "YESTERDAY") d.setDate(d.getDate() - 1);
    else if (label === "2_DAYS_AGO") d.setDate(d.getDate() - 2);
    else if (label === "3_DAYS_AGO") d.setDate(d.getDate() - 3);
    return `daily_notes/${d.toISOString().slice(0, 10)}`;
  }
  return name;
}

const memoryBlock = (dataDir: string, role: string): StandardMessage => {
  const memDir = join(dataDir, "memory");
  if (!existsSync(memDir)) return { role: "user", content: "<memory/>" };
  const want = RELEVANT_MEMORY_FOR_ROLE[role] ?? ["client_profile", "brand_guidelines"];
  const today = new Date();
  const blocks = want
    .map((n) => resolveName(n, today))
    .filter((resolved) => existsSync(join(memDir, `${resolved}.md`)))
    .map((resolved) => {
      const filePath = join(memDir, `${resolved}.md`);
      if (resolved.startsWith("daily_notes/")) {
        const content = readFileSync(filePath, "utf8");
        return `<memory file="${resolved}.md">\n<body>${content.trim()}</body>\n</memory>`;
      }
      const m = readMemoryFile(dataDir, resolved);
      const fm = JSON.stringify(m.frontmatter, null, 2);
      return `<memory file="${resolved}.md">\n<frontmatter>${fm}</frontmatter>\n<body>${m.body.trim()}</body>\n</memory>`;
    });
  return { role: "user", content: `<memory_block>\n${blocks.join("\n")}\n</memory_block>` };
};

function summarizeToolResult(toolName: string, body: string): string {
  switch (toolName) {
    case "web_fetch":
      return "[tool:web_fetch → content fetched]";
    case "read_deliverable": {
      try {
        const obj = JSON.parse(body) as { title?: string; contentMd?: string };
        const words = obj.contentMd ? obj.contentMd.split(/\s+/).length : 0;
        return `[tool:read_deliverable → read "${obj.title ?? "unknown"}" (~${words} words)]`;
      } catch { return "[tool:read_deliverable → content read]"; }
    }
    case "delegate_to_lead":
    case "delegate_to_specialist": {
      try {
        const obj = JSON.parse(body) as { delegationId?: string };
        return `[tool:${toolName} → delegated (id: ${obj.delegationId ?? "?"})]`;
      } catch { return `[tool:${toolName} → delegated]`; }
    }
    case "submit_deliverable": {
      try {
        const obj = JSON.parse(body) as { id?: string; title?: string };
        return `[tool:submit_deliverable → submitted "${obj.title ?? "?"}" (id: ${obj.id ?? "?"})]`;
      } catch { return "[tool:submit_deliverable → submitted]"; }
    }
    default:
      return `[tool:${toolName}]\n${body}`;
  }
}

export function collapseToolPairs(messages: StandardMessage[]): StandardMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    const match = msg.content.match(/^\[tool:([^\]]+)\]\n?([\s\S]*)/);
    if (!match) return msg;
    const [, toolName, body] = match;
    return { ...msg, content: summarizeToolResult(toolName, body) };
  });
}

export function makeTransformContext(opts: TransformContextOptions) {
  const keepRecent = opts.keepRecent ?? 50;
  return async (messages: AgencyMessage[]): Promise<StandardMessage[]> => {
    const llmMessages = convertToLlm(messages);
    const head = memoryBlock(opts.dataDir, opts.role);
    if (llmMessages.length <= keepRecent) return [head, ...llmMessages];
    const old = llmMessages.slice(0, llmMessages.length - keepRecent);
    const recent = llmMessages.slice(llmMessages.length - keepRecent);
    return [head, ...collapseToolPairs(old), ...recent];
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/agents/transform-context.test.ts
```

Expected: PASS — all 7 tests green.

- [ ] **Step 5: Run full test suite**

```bash
cd packages/server && npm test
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/agents/transform-context.ts packages/server/src/agents/transform-context.test.ts
git commit -m "feat(agents): replace summarize() with collapseToolPairs() for context compression"
```

---

### Task 6: Wire up AuthManager in AgentRouter + src/index.ts

**Files:**
- Modify: `packages/server/src/broker/router.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Add authManager to AgentRouter constructor**

In `packages/server/src/broker/router.ts`, add import at the top:

```typescript
import type { AuthManager } from "../providers/auth.js";
```

Change the `constructor` signature:

```typescript
constructor(
  private db: AgencyDb,
  private broker: Broker,
  private dataDir: string,
  private authManager?: AuthManager,
) {}
```

**In `boot()`**, pass `authManager` to `makeAgent` for warm roles:

```typescript
const agent = makeAgent({
  role, dataDir: this.dataDir, db: this.db, sessionId,
  authManager: this.authManager,
  emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
} satisfies MakeAgentOpts);
```

**In `spawnAndPrompt()`**, pass `authManager`:

```typescript
const agent = makeAgent({
  role, dataDir: this.dataDir, db: this.db, sessionId, delegationId,
  authManager: this.authManager,
  emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
} satisfies MakeAgentOpts);
```

**In `handleChatMessage()`** (the chat agent creation), pass `authManager`:

```typescript
agent = makeAgent({
  role: "director", dataDir: this.dataDir, db: this.db, sessionId, threadId,
  authManager: this.authManager,
  emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: "director", sessionId }),
} satisfies MakeAgentOpts);
```

**In `restartWarmAgent()`**, pass `authManager`:

```typescript
const agent = makeAgent({
  role, dataDir: this.dataDir, db: this.db, sessionId,
  authManager: this.authManager,
  emit: (type, payload) => this.broker.emit(type, payload, { agentSlug: role, sessionId }),
} satisfies MakeAgentOpts);
```

- [ ] **Step 2: Update src/index.ts for AuthManager lifecycle**

In `packages/server/src/index.ts`, add imports:

```typescript
import { providerMode } from "./providers/index.js";
import { AuthManager } from "./providers/auth.js";
```

Inside `main()`, add the AuthManager startup BEFORE creating `AgentRouter`:

```typescript
async function main() {
  const { db, close } = openDb(join(dataDir, "state.db"));
  const webhookUrl = process.env.N8N_WEBHOOK_URL ?? undefined;
  const broker = new Broker(db, webhookUrl);

  let authManager: AuthManager | undefined;
  if (providerMode() === "openai-subscription") {
    const authFile = process.env.PI_AUTH_FILE
      ?? join(homedir(), ".pi", "agent", "auth.json");
    authManager = new AuthManager(authFile);
    await authManager.start();
    console.log("[marquee] openai-subscription mode: auth loaded");
  }

  const router = new AgentRouter(db, broker, dataDir, authManager);
  // ... rest unchanged
```

Update the SIGTERM handler to stop `authManager`:

```typescript
process.on("SIGTERM", async () => {
  authManager?.stop();
  cronTask.stop();
  await app.close();
  close();
});
```

- [ ] **Step 3: Run all server tests**

```bash
cd packages/server && npm test
```

Expected: all passing. (The router tests don't boot with subscription mode so AuthManager is never required.)

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/broker/router.ts packages/server/src/index.ts
git commit -m "feat(broker): wire AuthManager through AgentRouter to makeAgent; startup lifecycle in index.ts"
```

---

### Task 7: Frontend model field in Agents UI

**Files:**
- Modify: `packages/web/src/views/agents.tsx`

- [ ] **Step 1: Add model field to AgentConfig interface and ConfigPanel in agents.tsx**

In `packages/web/src/views/agents.tsx`:

**7a.** Add `model?: string` to the local `AgentConfig` interface:

```typescript
interface AgentConfig {
  style?: string;
  tone?: string;
  response_length?: string;
  language?: string;
  model?: string;
  system_prompt_override?: string;
}
```

**7b.** In `ConfigPanel`, add a Model input field after the Language field. Find the Language `<div>` block and add this immediately after it:

```tsx
<div>
  <label className="caption" style={{ display: "block", marginBottom: 4 }}>
    Model{" "}
    <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 11 }}>
      (openai-subscription only)
    </span>
  </label>
  <input
    type="text"
    value={config.model ?? ""}
    onChange={(e) => setConfig({ ...config, model: e.target.value || undefined })}
    placeholder="e.g. gpt-5.1, claude-sonnet-4-6"
    style={{
      width: "100%", padding: "6px 8px",
      border: "1px solid var(--rule)", borderRadius: 4,
      background: "var(--parchment)", fontSize: 13,
      boxSizing: "border-box",
    }}
  />
</div>
```

- [ ] **Step 2: TypeScript check**

```bash
cd packages/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all server tests to confirm nothing broken**

```bash
cd packages/server && npm test
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/views/agents.tsx
git commit -m "feat(web): add model field to Agent config panel for subscription mode"
```
