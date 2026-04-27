import type { AgencyDb } from "../db/index.js";

export interface ToolContext {
	db: AgencyDb;
	agentSlug: string;
	agentSessionId: string;
	delegationId?: string;
	threadId?: string;
	emit: (eventType: string, payload: Record<string, unknown>) => void;
}

export interface AgentToolDef<TInput, TOutput> {
	name: string;
	description: string;
	/** Plain JSON Schema object describing the tool's input — passed directly to the LLM. */
	schema: Record<string, unknown>;
	input: { parse: (raw: unknown) => TInput };
	execute(input: TInput, ctx: ToolContext): Promise<TOutput>;
}
