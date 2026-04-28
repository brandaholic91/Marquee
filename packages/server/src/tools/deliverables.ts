import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { deliverables, deliverableRevisions, messages } from "../db/schema.js";
import type { AgentToolDef } from "./types.js";

const submitDeliverableInput = z.object({
	type: z.string(),
	title: z.string(),
	contentMd: z.string().min(50),
	source_deliverable_id: z.string().optional(),
});

export function makeSubmitDeliverable(dataDir: string): AgentToolDef<
	z.infer<typeof submitDeliverableInput>,
	{ deliverableId: string; revisionId: string }
> {
	return {
		name: "submit_deliverable",
		description: "Submit a completed deliverable. Triggers the eval pipeline. Specialist-only.",
		schema: {
			type: "object",
			properties: {
				type: { type: "string" },
				title: { type: "string" },
				contentMd: { type: "string", minLength: 50 },
				source_deliverable_id: { type: "string" },
			},
			required: ["type", "title", "contentMd"],
		},
		input: submitDeliverableInput,
		async execute(input, ctx) {
			if (!ctx.delegationId) throw new Error("submit_deliverable requires an active delegation context");
			const deliverableId = randomUUID();
			const revisionId = randomUUID();
			const artifactDir = join(dataDir, "artifacts", deliverableId);
			mkdirSync(artifactDir, { recursive: true });
			const artifactPath = join(artifactDir, "rev_001.md");
			writeFileSync(artifactPath, input.contentMd);

			ctx.db.insert(deliverables).values({
				id: deliverableId, delegationId: ctx.delegationId,
				type: input.type, title: input.title, status: "awaiting_eval",
				currentRevisionId: revisionId,
				sourceDeliverableId: input.source_deliverable_id ?? null,
			}).run();
			ctx.db.insert(deliverableRevisions).values({
				id: revisionId, deliverableId, artifactPath, createdByAgent: ctx.agentSlug,
			}).run();
			ctx.emit("deliverable_submitted", { deliverableId, revisionId });
			return { deliverableId, revisionId };
		},
	};
}

const readDeliverableInput = z.object({ deliverableId: z.string() });
export const readDeliverable: AgentToolDef<
	z.infer<typeof readDeliverableInput>,
	{ revisionId: string; contentMd: string; title: string }
> = {
	name: "read_deliverable",
	description: "Read the current revision of a deliverable.",
	schema: {
		type: "object",
		properties: {
			deliverableId: { type: "string" },
		},
		required: ["deliverableId"],
	},
	input: readDeliverableInput,
	async execute(input, ctx) {
		const d = ctx.db.select().from(deliverables).where(eq(deliverables.id, input.deliverableId)).get();
		if (!d || !d.currentRevisionId) throw new Error("deliverable not found");
		const r = ctx.db.select().from(deliverableRevisions)
			.where(eq(deliverableRevisions.id, d.currentRevisionId)).get();
		if (!r) throw new Error("current revision row missing");
		const contentMd = readFileSync(r.artifactPath, "utf8");
		return { revisionId: r.id, contentMd, title: d.title };
	},
};

const respondToLeadInput = z.object({ note: z.string().min(1) });
export const respondToLead: AgentToolDef<z.infer<typeof respondToLeadInput>, { ok: true }> = {
	name: "respond_to_lead",
	description: "Send a free-form note up to your Lead without closing the delegation.",
	schema: {
		type: "object",
		properties: {
			note: { type: "string", minLength: 1 },
		},
		required: ["note"],
	},
	input: respondToLeadInput,
	async execute(input, ctx) {
		if (!ctx.delegationId) throw new Error("respond_to_lead requires an active delegation context");
		ctx.db.insert(messages).values({
			id: randomUUID(), agentSessionId: ctx.agentSessionId, sender: ctx.agentSlug,
			type: "delegation_resp", contentJson: { note: input.note, delegationId: ctx.delegationId } as never,
		}).run();
		ctx.emit("specialist_note", { delegationId: ctx.delegationId, note: input.note });
		return { ok: true };
	},
};
