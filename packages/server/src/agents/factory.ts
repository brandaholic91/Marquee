import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@mariozechner/pi-ai";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createId } from "@paralleldrive/cuid2";
import { agentSessions } from "../db/schema.js";
import { getRoleConfig, type RoleSlug } from "./config.js";
import { modelForRole, getEnvApiKey } from "../providers/index.js";
import { makeReadMemoryTool } from "../tools/read-memory.js";
import { makeProposeBriefTool } from "../tools/propose-brief.js";
import { makeProposeMemoryUpdateTool } from "../tools/propose-memory-update.js";
import { makeSubmitDeliverableTool } from "../tools/submit-deliverable.js";
import { makeSubmitReviewTool } from "../tools/submit-review.js";
import { makeTavilySearchTool } from "../tools/tavily-search.js";
import { makeWebFetchTool } from "../tools/web-fetch.js";
import { makeGetCampaignStatusTool } from "../tools/get-campaign-status.js";
import { loadSkillRecipes } from "../skills/loader.js";
import { renderMemoryContext, renderBrandVoiceBlock } from "./transform-context.js";
import { AuthManager } from "../providers/auth.js";

type Db = ReturnType<typeof drizzle>;
interface Broker {
	emit: (e: Record<string, unknown>) => void;
}

export interface SpawnInput {
	db: Db;
	broker: Broker;
	dataDir: string;
	clientSlug: string;
	role: RoleSlug;
	threadId?: string;
	delegationId?: string;
	deliverableId?: string; // NEW
	deliverableType?: "social_post" | "email" | "blog_post" | "ad_copy" | "content_brief_seo" | "seo_report";
	authManager?: AuthManager;
}

export interface SpawnedAgent {
	agent: Agent;
	session: { id: string; lifecycle: "warm" | "transient" };
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

	const rawTools = await buildToolsForRole(config.slug, input, sessionId);
	const tools: AgentTool<TSchema>[] = rawTools.map(wrapTool);

	const skills = await loadSkillRecipes(input.dataDir, config.slug);
	const memoryBlock = await renderMemoryContext(input.dataDir, input.clientSlug, config.slug);
	const brandVoiceBlock = await renderBrandVoiceBlock(input.dataDir, input.clientSlug, config.slug);
	const systemPrompt = [memoryBlock, brandVoiceBlock, skills].filter(Boolean).join("\n\n");

	const agent = new Agent({
		initialState: {
			systemPrompt,
			model: modelForRole(config.slug),
			tools,
			thinkingLevel: "off",
		},
		getApiKey: (provider: string) => input.authManager?.getApiKey(provider) ?? getEnvApiKey(provider) ?? undefined,
	});

	return { agent, session: { id: sessionId, lifecycle: config.lifecycle } };
}

async function buildToolsForRole(role: RoleSlug, input: SpawnInput, sessionId: string): Promise<RawTool[]> {
	const tools: RawTool[] = [];
	const cfg = getRoleConfig(role);

	for (const toolName of cfg.tools) {
		switch (toolName) {
			case "read_memory":
				tools.push(makeReadMemoryTool({ dataDir: input.dataDir, clientSlug: input.clientSlug }) as RawTool);
				break;
			case "propose_brief":
				if (!input.threadId) throw new Error("propose_brief needs threadId");
				tools.push(
					makeProposeBriefTool({
						db: input.db,
						broker: input.broker,
						clientSlug: input.clientSlug,
						threadId: input.threadId,
					}) as RawTool,
				);
				break;
			case "propose_memory_update":
				tools.push(
					makeProposeMemoryUpdateTool({
						db: input.db,
						broker: input.broker,
						clientSlug: input.clientSlug,
						agentSessionId: sessionId,
					}) as RawTool,
				);
				break;
			case "get_campaign_status":
				tools.push(makeGetCampaignStatusTool({ db: input.db, clientSlug: input.clientSlug }) as RawTool);
				break;
			case "submit_deliverable":
				if (!input.delegationId || !input.deliverableType)
					throw new Error("submit_deliverable needs delegationId and deliverableType");
				tools.push(
					makeSubmitDeliverableTool({
						db: input.db,
						broker: input.broker,
						dataDir: input.dataDir,
						clientSlug: input.clientSlug,
						delegationId: input.delegationId,
						agentSlug: role,
						deliverableType: input.deliverableType,
					}) as RawTool,
				);
				break;
			case "submit_review":
				if (!input.deliverableId) throw new Error("submit_review needs deliverableId");
				tools.push(
					makeSubmitReviewTool({
						db: input.db,
						broker: input.broker,
						deliverableId: input.deliverableId,
					}) as RawTool,
				);
				break;
			case "tavily_search":
				tools.push(makeTavilySearchTool() as RawTool);
				break;
			case "web_fetch":
				tools.push(makeWebFetchTool() as RawTool);
				break;
		}
	}
	return tools;
}
