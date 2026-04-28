import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@mariozechner/pi-ai";
import type { AgencyDb } from "../db/index.js";
import { modelForRole, getEnvApiKey } from "../providers/index.js";
import { listSkillsForRole } from "../skills/loader.js";
import { toolsForRole } from "../tools/registry.js";
import type { ToolContext } from "../tools/types.js";
import { convertToLlm } from "./convert-to-llm.js";
import { makeTransformContext } from "./transform-context.js";
import { loadAgentConfig, buildBehaviorBlock } from "./config.js";
import type { AuthManager } from "../providers/auth.js";

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

const buildSystemPrompt = (role: string, dataDir: string): string => {
	const skills = listSkillsForRole(dataDir, role);

	const skillList = skills.length === 0 ? "" : [
		"## Available Skills",
		"",
		"Call `use_skill` with a skill name to load its full instructions before starting work on a matching task.",
		"",
		...skills.map((s) => `- **${s.name}**: ${s.whenToUse}`),
	].join("\n");

	const config = loadAgentConfig(dataDir, role);
	const behaviorBlock = config ? buildBehaviorBlock(config) : "";

	return [
		`You are the ${role} agent of the AI marketing agency.`,
		`Use only the tools provided. Do not attempt actions outside your toolset.`,
		`Read memory before making client-specific decisions.`,
		skillList,
		behaviorBlock,
	]
		.filter(Boolean)
		.join("\n\n");
};

export function makeAgent(opts: MakeAgentOpts): Agent {
	const toolCtx: ToolContext = {
		db: opts.db,
		agentSlug: opts.role,
		agentSessionId: opts.sessionId,
		delegationId: opts.delegationId,
		threadId: opts.threadId,
		emit: opts.emit,
	};

	const rawTools = toolsForRole(opts.role, opts.dataDir);
	const config = loadAgentConfig(opts.dataDir, opts.role);
	const model = modelForRole(opts.role, config?.model ?? undefined);

	const agentTools: AgentTool<TSchema>[] = rawTools.map((t) => ({
		name: t.name,
		label: t.name,
		description: t.description,
		parameters: t.schema as unknown as TSchema,
		execute: async (
			_toolCallId: string,
			params: unknown,
		): Promise<AgentToolResult<unknown>> => {
			try {
				const parsed = t.input.parse(params);
				const value = await t.execute(parsed, toolCtx);
				const text = typeof value === "string" ? value : JSON.stringify(value);
				const prefixed = `[tool:${t.name}]\n${text}`;
				return {
					content: [{ type: "text", text: prefixed }],
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
	}));

	const transformContextFn = makeTransformContext({ dataDir: opts.dataDir, role: opts.role });

	return new Agent({
		initialState: {
			systemPrompt: buildSystemPrompt(opts.role, opts.dataDir),
			model,
			tools: agentTools,
			thinkingLevel: config?.thinking_level ?? "off",
		},
		convertToLlm: convertToLlm as never,
		transformContext: transformContextFn as never,
		getApiKey: (provider: string) =>
			opts.authManager?.getApiKey(provider) ?? getEnvApiKey(provider) ?? undefined,
	});
}
