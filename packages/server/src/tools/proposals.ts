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
