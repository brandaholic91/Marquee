import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@mariozechner/pi-ai";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createId } from "@paralleldrive/cuid2";
import { agentSessions } from "../db/schema.js";
import { INGEST_CONFIG } from "./config.js";
import { modelForRoleWithOverride, getEnvApiKey } from "../providers/index.js";
import { makeReadWikiTool } from "../tools/read-wiki.js";
import { makeProposeWikiUpdateTool } from "../tools/propose-wiki-update.js";
import { makeReadMemoryTool } from "../tools/read-memory.js";
import { loadAgentConfig, loadAgentIdentity } from "../agents/loader.js";
import { renderMemoryContext } from "../agents/transform-context.js";
import { AuthManager } from "../providers/auth.js";

type Db = ReturnType<typeof drizzle>;
interface Broker {
	emit: (e: Record<string, unknown>) => void;
}

export interface SpawnIngestAgentInput {
	db: Db;
	broker: Broker;
	dataDir: string;
	clientSlug: string;
	deliverableId: string;
	evalScore: number;
	evalSummary: string;
	deliverableType: "email" | "blog_post" | "social_post" | "ad_copy";
	briefTitle?: string;
	authManager?: AuthManager;
}

export interface SpawnedIngestAgent {
	agent: Agent;
	session: { id: string; lifecycle: "transient" };
}

/** Raw tool shape returned by our make*Tool factories. */
interface RawTool {
	name: string;
	description: string;
	inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
	execute: (input: unknown) => Promise<unknown>;
}

/** Wrap a raw tool into the AgentTool shape required by pi-agent-core. */
function wrapTool(tool: RawTool): AgentTool<TSchema> {
	return {
		name: tool.name,
		label: tool.name,
		description: tool.description,
		parameters: tool.inputSchema as unknown as TSchema,
		execute: async (_toolCallId: string, params: unknown): Promise<AgentToolResult<unknown>> => {
			try {
				const value = await tool.execute(params as never);
				const text = typeof value === "string" ? value : JSON.stringify(value);
				return {
					content: [{ type: "text", text: `[tool:${tool.name}]\n${text}` }],
					details: value,
				};
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${message}` }],
					details: { error: message },
					terminate: false,
				};
			}
		},
	};
}

export async function spawnIngestAgent(input: SpawnIngestAgentInput): Promise<SpawnedIngestAgent> {
	const sessionId = createId();
	const now = Date.now();

	// Record session in DB
	await input.db.insert(agentSessions).values({
		id: sessionId,
		clientSlug: input.clientSlug,
		agentSlug: "ingest",
		lifecycle: INGEST_CONFIG.lifecycle,
		parentDelegationId: null,
		startedAt: now,
		endedAt: null,
	});

	// Load agent config & identity
	const agentCfg = loadAgentConfig(input.dataDir, "ingest");
	const agentIdentity = loadAgentIdentity(input.dataDir, "ingest");

	// Build tools
	const readWikiTool = makeReadWikiTool({ dataDir: input.dataDir, clientSlug: input.clientSlug });
	const proposeWikiTool = makeProposeWikiUpdateTool({
		db: input.db,
		broker: input.broker,
		clientSlug: input.clientSlug,
		agentSessionId: sessionId,
	});
	const readMemoryTool = makeReadMemoryTool({ dataDir: input.dataDir, clientSlug: input.clientSlug });

	const rawTools: RawTool[] = [readWikiTool as RawTool, proposeWikiTool as RawTool, readMemoryTool as RawTool];

	// Add load_skill tool (like in factory.ts)
	rawTools.push({
		name: "load_skill",
		description:
			"Load the full instructions for a skill by name. Call this when a task matches a skill's description and you need detailed guidance.",
		inputSchema: {
			type: "object" as const,
			properties: { name: { type: "string", description: "Skill name from the <skills> catalog" } },
			required: ["name"],
		},
		execute: async () => {
			// Skills not yet implemented for ingest; return placeholder
			return "Skills catalog not yet available for ingest agent.";
		},
	});

	const tools: AgentTool<TSchema>[] = rawTools.map(wrapTool);

	// Get model
	const model = modelForRoleWithOverride("ingest", agentCfg.model);

	// Build system prompt with deliverable context
	const memoryContext = await renderMemoryContext(input.dataDir, input.clientSlug, "copywriter");
	const systemPrompt = [
		agentIdentity || `You are the Wiki Learning Agent. Your job is to learn from recently completed deliverables and update the wiki.`,
		`
**Deliverable Info:**
- Type: ${input.deliverableType}
- Title: ${input.briefTitle || "Unknown"}
- Eval Score: ${input.evalScore}/5
- Summary: ${input.evalSummary}

**Your Tasks:**
1. Read the current wiki pages (brand-voice-patterns.md, seo-learnings.md, content-performance.md) using read_wiki
2. If eval score == 5: extract the pattern/insight and propose adding to brand-voice-patterns.md
3. If deliverable type is blog_post: extract keyword insights and propose updating seo-learnings.md
4. Always reference the artifact link when proposing updates via propose_wiki_update
5. Use read_memory to understand brand guidelines

**Output:**
Use tools to read wiki, extract insights, and propose_wiki_update. Keep proposals concise.
`,
		memoryContext,
	]
		.filter(Boolean)
		.join("\n\n");

	// Create agent
	const agent = new Agent({
		initialState: {
			systemPrompt,
			model,
			tools,
			thinkingLevel: (agentCfg.thinking_level ?? "off") as "off" | "minimal" | "low" | "medium" | "high",
		},
		getApiKey: (provider: string) => input.authManager?.getApiKey(provider) ?? getEnvApiKey(provider) ?? undefined,
	});

	if (typeof agent.subscribe === "function") {
		agent.subscribe((event: Record<string, unknown>) => {
			if (event.type === "tool_execution_start") {
				console.log("[tool:start]", "ingest", event.toolName, JSON.stringify(event.args).slice(0, 200));
			} else if (event.type === "tool_execution_end") {
				const status = event.isError ? "FAIL" : "OK";
				const preview = typeof event.result === "string" ? event.result : JSON.stringify(event.result);
				console.log("[tool:end]", "ingest", event.toolName, status, preview.slice(0, 300));
			}
		});
	}

	return { agent, session: { id: sessionId, lifecycle: "transient" } };
}
