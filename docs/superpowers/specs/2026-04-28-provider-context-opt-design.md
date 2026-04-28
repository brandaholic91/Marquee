# Marquee v0.4 — ChatGPT Subscription Provider + Context Window Optimizations

## Goal

Reduce LLM cost by (1) enabling ChatGPT Plus/Pro subscription billing via the `openai-codex` provider, and (2) shrinking the context window by compressing old tool result pairs to 1-line summaries.

## Architecture

Three independent improvements sharing one release:
- **AuthManager** (`src/providers/auth.ts`): stateful OAuth credential manager for `openai-codex`, synchronous `getApiKey()` backed by a cached token that auto-refreshes before expiry.
- **Tool result prefix + window compression**: `factory.ts` prepends `[tool:name]` to every tool result; `transform-context.ts` collapses tool pairs outside the recency window to 1-line summaries.
- **Model field in AgentConfig**: allows per-role model selection when using `openai-subscription` mode.

Lazy skill loading (2c) is explicitly out of scope.

## Tech Stack

Node.js 22, TypeScript, `@mariozechner/pi-ai` (already installed — exports `openaiCodexOAuthProvider`, `refreshOpenAICodexToken`, `getOAuthApiKey`, `OAuthCredentials`), existing Vitest suite.

---

## 1. AuthManager

### File

New: `packages/server/src/providers/auth.ts`

### Behaviour

```typescript
export class AuthManager {
  private cachedApiKey: string | null = null;
  private credentials: OAuthCredentials | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(private authFilePath: string) {}

  async start(): Promise<void>
  stop(): void
  getApiKey(provider: string): string | undefined  // synchronous
}
```

**`start()` flow:**
1. Read `authFilePath` (throws with a human-readable message if file doesn't exist: `"openai-subscription mode requires auth credentials. Run login first and ensure auth file exists at <path>"`)
2. Parse JSON, extract `credentials["openai-codex"]`
3. If `credentials.expires < Date.now()`: call `refreshOpenAICodexToken(credentials.refresh)`, persist refreshed credentials back to `authFilePath`
4. `cachedApiKey = openaiCodexOAuthProvider.getApiKey(credentials)`
5. `setInterval(checkAndRefresh, 30 * 60 * 1000)` — every 30 minutes

**`checkAndRefresh()` (private):**
- If `credentials.expires - Date.now() < 5 * 60 * 1000`: refresh, recache, persist
- On refresh failure: `console.error`, keep old credentials (agent will receive a 401 on next LLM call rather than crashing the daemon)

**`getApiKey(provider)`:**
- Returns `cachedApiKey` if `provider === "openai-codex"`, else `undefined`

**`stop()`:** `clearInterval(refreshTimer)`

### Auth file location

`PI_AUTH_FILE` env var, default `~/.pi/agent/auth.json`.

Auth file format (written by `pi login`):
```json
{
  "openai-codex": {
    "refresh": "...",
    "access": "...",
    "expires": 1234567890000
  }
}
```

### Integration in `src/index.ts`

```typescript
let authManager: AuthManager | undefined;
if (providerMode() === "openai-subscription") {
  const authFile = process.env.PI_AUTH_FILE
    ?? join(homedir(), ".pi", "agent", "auth.json");
  authManager = new AuthManager(authFile);
  await authManager.start();
}
// ...
process.on("SIGTERM", async () => {
  authManager?.stop();
  cronTask.stop();
  await app.close();
  close();
});
```

---

## 2. Provider Mode Extension

### File

Modify: `packages/server/src/providers/index.ts`

### Changes

```typescript
export type ProviderMode = "flat" | "api" | "openai-subscription";

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
  if (mode === "flat") { ... }          // unchanged
  if (mode === "api") { ... }           // unchanged
  // openai-subscription:
  const id = configModel ?? SUBSCRIPTION_FALLBACK_MAP[role] ?? "gpt-5.1-codex-mini";
  return getModel("openai-codex", id as never)!;
}
```

The `configModel` parameter comes from `AgentConfig.model` (loaded in `factory.ts`).

---

## 3. AgentConfig Model Field

### File

Modify: `packages/server/src/agents/config.ts`

### Change

Add `model?: string` to `AgentConfig`:

```typescript
export interface AgentConfig {
  style?: "terse" | "verbose" | "balanced";
  tone?: "authoritative" | "friendly" | "neutral";
  response_length?: "concise" | "detailed";
  language?: string;
  model?: string;                  // e.g. "gpt-5.1", "claude-sonnet-4-6"
  system_prompt_override?: string;
}
```

`buildBehaviorBlock` does NOT include `model` in the system prompt text — it is purely a provider-side configuration, not an instruction to the LLM.

### Factory integration

`factory.ts` passes `config?.model` to `modelForRole`:

```typescript
const config = loadAgentConfig(opts.dataDir, opts.role);
const model = modelForRole(opts.role, config?.model ?? undefined);
```

### Frontend

`packages/web/src/views/agents.tsx` — add a "Model" text input in `ConfigPanel`, after the Language field:

```tsx
<div>
  <label className="caption" style={{ display: "block", marginBottom: 4 }}>
    Model <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(openai-subscription mode only)</span>
  </label>
  <input
    type="text"
    value={config.model ?? ""}
    onChange={(e) => setConfig({ ...config, model: e.target.value || undefined })}
    placeholder="e.g. gpt-5.1, claude-sonnet-4-6"
    style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)",
             borderRadius: 4, background: "var(--parchment)", fontSize: 13, boxSizing: "border-box" }}
  />
</div>
```

---

## 4. Tool Result Prefix

### File

Modify: `packages/server/src/agents/factory.ts`

### Change

In the tool execution wrapper, prepend `[tool:${t.name}]\n` to the result text:

```typescript
const text = typeof value === "string" ? value : JSON.stringify(value);
const prefixed = `[tool:${t.name}]\n${text}`;
return {
  content: [{ type: "text", text: prefixed }],
  details: value,
};
```

This change applies to ALL tool results regardless of provider mode. The prefix is always present, making context compression provider-agnostic.

---

## 5. Window-Based Tool Pair Compression

### File

Modify: `packages/server/src/agents/transform-context.ts`

### Logic

`collapseToolPairs(messages: StandardMessage[]): StandardMessage[]`

Scans the message array. For each `role: "tool"` message:
- If its content starts with `[tool:` (has a prefix): the **pair** (preceding assistant message + this tool result) is collapsed to a single `role: "user"` summary message. Both the assistant tool_call and the tool result are removed; the summary replaces them. This preserves LLM structural validity (no orphaned tool results).
- Find the preceding assistant message by scanning backwards from the tool result until an assistant message is found.

If no `[tool:` prefix (legacy messages from before this feature): keep unchanged.
If a tool result has no preceding assistant message (malformed history): keep unchanged.

Summary format by tool name:

| Tool | Summary |
|---|---|
| `web_fetch` | `[tool:web_fetch → content fetched]` |
| `read_deliverable` | `[tool:read_deliverable → read "<title>" (~N words)]` — parse JSON for title + word count |
| `delegate_to_lead` | `[tool:delegate_to_lead → delegated to <lead> (id: <delegationId>)]` |
| `delegate_to_specialist` | `[tool:delegate_to_specialist → delegated to <specialist> (id: <delegationId>)]` |
| `submit_deliverable` | `[tool:submit_deliverable → submitted "<title>" (id: <id>)]` |
| `read_memory` | keep unchanged |
| anything else | keep unchanged |

**Updated `makeTransformContext`:**

```typescript
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

The existing `summarize()` function (generic N-messages-omitted text) is replaced by `collapseToolPairs()` for old messages. The recency window size (50) is unchanged.

---

## 6. AuthManager in makeAgent

### File

Modify: `packages/server/src/agents/factory.ts` and `src/agents/factory.ts`'s `MakeAgentOpts`

### Change

```typescript
export interface MakeAgentOpts {
  role: string;
  dataDir: string;
  db: AgencyDb;
  sessionId: string;
  delegationId?: string;
  threadId?: string;
  authManager?: AuthManager;   // NEW — only set when openai-subscription
  emit: (eventType: string, payload: Record<string, unknown>) => void;
}

// In makeAgent:
getApiKey: (provider: string) =>
  opts.authManager?.getApiKey(provider) ?? getEnvApiKey(provider) ?? undefined,
```

`authManager` is passed from `AgentRouter` (which gets it from `src/index.ts` at construction time).

`AgentRouter` constructor signature expands:
```typescript
constructor(
  private db: AgencyDb,
  private broker: Broker,
  private dataDir: string,
  private authManager?: AuthManager,
) {}
```

---

## 7. Error Handling

| Scenario | Behaviour |
|---|---|
| `auth.json` missing in subscription mode | `AuthManager.start()` throws → daemon exits with a clear error message before server starts |
| Token refresh fails at startup | Throws — daemon does not start (better than silent failure) |
| Token refresh fails in background timer | `console.error`, keep old token; next LLM call gets 401 error response |
| Tool result JSON parse fails in `collapseToolPairs` | Keep original content (best-effort compression) |
| `model` in AgentConfig not in openai-codex's known models | pi-ai throws at `getModel()` call; daemon logs error, falls back to `SUBSCRIPTION_FALLBACK_MAP[role]` |

---

## 8. Testing

- `src/providers/auth.test.ts` (new):
  - `start()` throws when auth file missing
  - `start()` refreshes token when `expires < now`
  - `start()` keeps token when `expires > now + 5min`
  - `getApiKey("openai-codex")` returns cached string
  - `getApiKey("other-provider")` returns undefined

- `src/providers/index.test.ts` (extend existing):
  - `modelForRole("director")` in `openai-subscription` mode returns `openai-codex/gpt-5.1`
  - `modelForRole("copywriter", "claude-sonnet-4-6")` uses override model
  - `modelForRole("eval-judge")` falls back to `gpt-5.1-codex-mini`

- `src/agents/transform-context.test.ts` (extend existing):
  - `collapseToolPairs` replaces prefixed tool results with 1-line summaries
  - `collapseToolPairs` leaves non-prefixed (legacy) tool results unchanged
  - `collapseToolPairs` leaves `read_memory` results unchanged
  - `makeTransformContext` applies collapse only to old messages, not recent window

- `src/agents/config.test.ts` (extend existing):
  - `loadAgentConfig` parses `model` field
  - `buildBehaviorBlock` does NOT include `model` in output text

- All existing 126 server tests must continue to pass
