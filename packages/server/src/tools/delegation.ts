import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { delegations } from "../db/schema.js";
import type { AgentToolDef, ToolContext } from "./types.js";

const KNOWN_LEADS = new Set(["content-lead"]);
const KNOWN_SPECIALISTS_BY_LEAD: Record<string, Set<string>> = {
	"content-lead": new Set(["copywriter"]),
};

const delegateToLeadInput = z.object({
	lead: z.string(),
	task: z.string().min(1),
	briefId: z.string().optional(),
	context: z.string().optional(),
});

export const delegateToLead: AgentToolDef<z.infer<typeof delegateToLeadInput>, { delegationId: string }> = {
	name: "delegate_to_lead",
	description: "Delegate a task to a Lead agent. Use this only as the Director.",
	input: delegateToLeadInput,
	async execute(input, ctx) {
		if (!KNOWN_LEADS.has(input.lead)) {
			throw new Error(`Unknown lead "${input.lead}". Valid: ${[...KNOWN_LEADS].join(", ")}`);
		}
		const id = randomUUID();
		ctx.db.insert(delegations).values({
			id, briefId: input.briefId, fromAgent: ctx.agentSlug, toAgent: input.lead,
			status: "requested", payloadJson: { task: input.task, context: input.context } as never,
		}).run();
		ctx.emit("delegation_created", { delegationId: id, from: ctx.agentSlug, to: input.lead });
		return { delegationId: id };
	},
};

const delegateToSpecialistInput = z.object({
	specialist: z.string(),
	task: z.string().min(1),
	context: z.string().optional(),
});

export const delegateToSpecialist: AgentToolDef<z.infer<typeof delegateToSpecialistInput>, { delegationId: string }> = {
	name: "delegate_to_specialist",
	description: "Delegate a task to a Specialist agent under your supervision. Lead-only.",
	input: delegateToSpecialistInput,
	async execute(input, ctx) {
		const allowed = KNOWN_SPECIALISTS_BY_LEAD[ctx.agentSlug];
		if (!allowed) throw new Error(`${ctx.agentSlug} is not a Lead and cannot delegate to specialists`);
		if (!allowed.has(input.specialist))
			throw new Error(`${ctx.agentSlug} cannot delegate to "${input.specialist}". Allowed: ${[...allowed].join(", ")}`);
		const id = randomUUID();
		ctx.db.insert(delegations).values({
			id, parentDelegationId: ctx.delegationId, fromAgent: ctx.agentSlug, toAgent: input.specialist,
			status: "requested", payloadJson: { task: input.task, context: input.context } as never,
		}).run();
		ctx.emit("delegation_created", { delegationId: id, from: ctx.agentSlug, to: input.specialist });
		return { delegationId: id };
	},
};

const submitToDirectorInput = z.object({
	summary: z.string().min(1),
	deliverableId: z.string().optional(),
});

export const submitToDirector: AgentToolDef<z.infer<typeof submitToDirectorInput>, { ok: true }> = {
	name: "submit_to_director",
	description: "Forward your synthesized output up to the Director. Lead-only.",
	input: submitToDirectorInput,
	async execute(input, ctx) {
		if (!ctx.delegationId) throw new Error("submit_to_director requires an active delegation context");
		ctx.db.update(delegations)
			.set({ status: "complete", completedAt: new Date(),
				payloadJson: { summary: input.summary, deliverableId: input.deliverableId } as never })
			.where(eq(delegations.id, ctx.delegationId))
			.run();
		ctx.emit("delegation_complete", { delegationId: ctx.delegationId });
		return { ok: true };
	},
};
