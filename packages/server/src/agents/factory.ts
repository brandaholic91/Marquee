// NOTE: @mariozechner/pi-ai v0.70.2 cannot be imported at runtime due to a broken
// typebox peer dependency (requires typebox/build/index.mjs which does not exist
// in typebox v1.x). The Agent class from @mariozechner/pi-agent-core transitively
// imports pi-ai, so it also cannot be constructed at runtime.
//
// This factory therefore returns a plain AgentConfig object rather than a live
// Agent instance. Once the typebox issue is resolved upstream (or the dependency
// is updated to a compatible version), replace the return value with:
//   new Agent({ initialState: { systemPrompt, model, tools }, convertToLlm, transformContext })
//
// The AgentConfig shape mirrors the AgentOptions accepted by the Agent constructor,
// minus the runtime-only callback fields that depend on pi-ai types.

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AgencyDb } from "../db/index.js";
import { readMemoryFile } from "../memory/read.js";
import { modelForRole, type ModelDescriptor } from "../providers/index.js";
import { loadSkillsForRole } from "../skills/loader.js";
import { toolsForRole } from "../tools/registry.js";
import type { AgentToolDef, ToolContext } from "../tools/types.js";
import { convertToLlm } from "./convert-to-llm.js";
import { makeTransformContext } from "./transform-context.js";
import type { AgencyMessage } from "./messages.js";

export interface MakeAgentOpts {
	role: string;
	dataDir: string;
	db: AgencyDb;
	sessionId: string;
	delegationId?: string;
	threadId?: string;
	emit: (eventType: string, payload: Record<string, unknown>) => void;
}

/** Wired tool ready for execution — mirrors the AgentTool shape without the TypeBox dependency. */
export interface WiredTool {
	name: string;
	description: string;
	execute(raw: unknown): Promise<unknown>;
}

/**
 * Plain configuration object returned by makeAgent.
 *
 * This is a serialisable snapshot that captures everything needed to construct a
 * live pi-agent-core Agent once the typebox runtime issue is resolved:
 *
 *   new Agent({
 *     initialState: { systemPrompt: cfg.systemPrompt, model: cfg.model },
 *     convertToLlm:      cfg.convertToLlm,
 *     transformContext:  cfg.transformContext,
 *   })
 *   agent.state.tools = cfg.tools;  // set after construction
 */
export interface AgentConfig {
	role: string;
	sessionId: string;
	systemPrompt: string;
	model: ModelDescriptor;
	tools: WiredTool[];
	convertToLlm: (messages: AgencyMessage[]) => ReturnType<typeof convertToLlm>;
	transformContext: (messages: AgencyMessage[]) => Promise<AgencyMessage[]>;
}

const buildSystemPrompt = (role: string, dataDir: string): string => {
	const skills = loadSkillsForRole(dataDir, role);
	const ctx: Record<string, unknown> = {};
	for (const file of ["client_profile", "brand_guidelines"]) {
		const path = join(dataDir, "memory", `${file}.md`);
		if (existsSync(path)) {
			ctx[file] = readMemoryFile(dataDir, file).frontmatter;
		}
	}
	const skillBlocks = skills
		.map((s) => `## Skill: ${s.frontmatter.name ?? "(unnamed)"}\n\n${s.render(ctx)}`)
		.join("\n\n");

	return [
		`You are the ${role} agent of the AI marketing agency.`,
		`Use only the tools provided. Do not attempt actions outside your toolset.`,
		`Read memory before making client-specific decisions.`,
		skillBlocks,
	]
		.filter(Boolean)
		.join("\n\n");
};

const wrapTool = (
	t: AgentToolDef<unknown, unknown>,
	toolCtx: ToolContext,
): WiredTool => ({
	name: t.name,
	description: t.description,
	execute: async (raw: unknown) => {
		const parsed = t.input.parse(raw);
		return t.execute(parsed, toolCtx);
	},
});

export function makeAgent(opts: MakeAgentOpts): AgentConfig {
	const toolCtx: ToolContext = {
		db: opts.db,
		agentSlug: opts.role,
		agentSessionId: opts.sessionId,
		delegationId: opts.delegationId,
		threadId: opts.threadId,
		emit: opts.emit,
	};

	const rawTools = toolsForRole(opts.role, opts.dataDir);
	const tools = rawTools.map((t) => wrapTool(t, toolCtx));
	const systemPrompt = buildSystemPrompt(opts.role, opts.dataDir);
	const model = modelForRole(opts.role);
	const transformContext = makeTransformContext({ dataDir: opts.dataDir, role: opts.role });

	return {
		role: opts.role,
		sessionId: opts.sessionId,
		systemPrompt,
		model,
		tools,
		convertToLlm,
		transformContext: transformContext as (messages: AgencyMessage[]) => Promise<AgencyMessage[]>,
	};
}
