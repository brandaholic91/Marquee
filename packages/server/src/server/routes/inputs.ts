import { randomUUID } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { agentSessions, delegations, messages } from "../../db/schema.js";

export function registerInputRoutes(app: FastifyInstance, opts: ServerOpts) {
	// List pending input requests (questions not yet answered)
	app.get("/api/inputs/pending", async () => {
		const questionMsgs = opts.db.select().from(messages)
			.where(eq(messages.type, "chat")).all()
			.filter((m) => {
				const c = m.contentJson as { isQuestion?: boolean };
				return c?.isQuestion === true;
			});

		const pending = [];
		for (const msg of questionMsgs) {
			const c = msg.contentJson as { text?: string; isQuestion?: boolean; threadId?: string };
			const threadId = c.threadId;
			if (!threadId) continue;

			// Check if already answered
			const reply = opts.db.select().from(messages)
				.where(eq(messages.type, "chat")).all()
				.find((m) => {
					const mc = m.contentJson as { isReply?: boolean; threadId?: string };
					return mc?.isReply === true && mc?.threadId === threadId;
				});
			if (reply) continue;

			// Get the delegation context from the session
			const session = msg.agentSessionId
				? opts.db.select().from(agentSessions)
					.where(eq(agentSessions.id, msg.agentSessionId)).get()
				: null;

			// Only show questions from pipeline agents (have parentDelegationId)
			// Chat director questions belong in the chat UI, not the dashboard widget
			if (!session?.parentDelegationId) continue;

			pending.push({
				id: msg.id,
				threadId,
				question: c.text ?? "",
				agentSlug: msg.sender,
				sessionId: msg.agentSessionId,
				delegationId: session?.parentDelegationId ?? null,
				createdAt: msg.createdAt,
			});
		}
		return pending;
	});

	// Submit a reply — re-triggers the waiting agent
	app.post<{ Body: { threadId: string; answer: string; delegationId?: string } }>(
		"/api/inputs/reply",
		async (req, reply) => {
			const { threadId, answer, delegationId } = req.body;
			if (!threadId || !answer?.trim()) return reply.code(400).send({ error: "threadId and answer required" });

			// Store the reply
			opts.db.insert(messages).values({
				id: randomUUID(), threadId: null, sender: "human", type: "chat",
				contentJson: { text: answer, isReply: true, threadId } as never,
			}).run();

			// Re-trigger the delegation with the answer in context
			if (delegationId) {
				const del = opts.db.select().from(delegations).where(eq(delegations.id, delegationId)).get();
				if (del) {
					const payload = del.payloadJson as { task?: string };
					const fullMessage = [
						`## Válasz a kérdésedre`,
						`Az emberi válasz: ${answer}`,
						``,
						`Eredeti feladat:`,
						payload.task ?? "",
					].join("\n");
					opts.broker.emit("delegation_created", {
						delegationId, from: del.fromAgent, to: del.toAgent,
						_resumeWithAnswer: answer,
					});
					// Directly prompt via router if available
					opts.router.promptWarmAgent(del.toAgent, fullMessage);
				}
			}

			opts.broker.emit("input_replied", { threadId, answer });
			return { ok: true };
		},
	);
}
