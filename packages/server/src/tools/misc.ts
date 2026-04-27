import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { deliverables, deliverableRevisions, evals, messages } from "../db/schema.js";
import type { AgentToolDef } from "./types.js";

const requestInputInput = z.object({
	threadId: z.string(),
	question: z.string(),
});

export const requestInput: AgentToolDef<z.infer<typeof requestInputInput>, { pending: true }> = {
	name: "request_input",
	description: "Ask the human a question and pause for their reply.",
	schema: {
		type: "object",
		properties: {
			threadId: { type: "string" },
			question: { type: "string" },
		},
		required: ["threadId", "question"],
	},
	input: requestInputInput,
	async execute(input, ctx) {
		// threadId is a soft reference stored in contentJson; the FK column is left null
		// to avoid FK constraint failures when the thread hasn't been persisted yet.
		ctx.db.insert(messages).values({
			id: randomUUID(), threadId: null, agentSessionId: ctx.agentSessionId,
			sender: ctx.agentSlug, type: "chat",
			contentJson: { text: input.question, isQuestion: true, threadId: input.threadId } as never,
		}).run();
		ctx.emit("input_requested", { threadId: input.threadId, question: input.question });
		return { pending: true };
	},
};

const submitEvalReportInput = z.object({
	deliverableRevisionId: z.string(),
	scores: z.object({
		brand_voice: z.number().min(1).max(5),
		factual_accuracy: z.number().min(1).max(5),
		usp_usage: z.number().min(1).max(5),
	}),
	summary: z.string().min(10),
});

export const submitEvalReport: AgentToolDef<z.infer<typeof submitEvalReportInput>, { evalId: string }> = {
	name: "submit_eval_report",
	description: "Submit a 3-dim evaluation. Eval Judge only. Advisory — does not block approval.",
	schema: {
		type: "object",
		properties: {
			deliverableRevisionId: { type: "string" },
			scores: {
				type: "object",
				properties: {
					brand_voice: { type: "number", minimum: 1, maximum: 5 },
					factual_accuracy: { type: "number", minimum: 1, maximum: 5 },
					usp_usage: { type: "number", minimum: 1, maximum: 5 },
				},
				required: ["brand_voice", "factual_accuracy", "usp_usage"],
			},
			summary: { type: "string", minLength: 10 },
		},
		required: ["deliverableRevisionId", "scores", "summary"],
	},
	input: submitEvalReportInput,
	async execute(input, ctx) {
		const id = randomUUID();
		ctx.db.insert(evals).values({
			id, revisionId: input.deliverableRevisionId,
			scoresJson: input.scores as never, summaryMd: input.summary,
		}).run();
		const rev = ctx.db.select().from(deliverableRevisions)
			.where(eq(deliverableRevisions.id, input.deliverableRevisionId)).get();
		if (rev) {
			ctx.db.update(deliverables)
				.set({ status: "awaiting_approval", updatedAt: new Date() })
				.where(eq(deliverables.id, rev.deliverableId))
				.run();
		}
		ctx.emit("eval_submitted", { evalId: id, revisionId: input.deliverableRevisionId });
		return { evalId: id };
	},
};
