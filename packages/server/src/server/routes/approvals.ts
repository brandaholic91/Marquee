import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { approvals, delegations, deliverables } from "../../db/schema.js";

export function registerApprovalRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.post<{
		Params: { id: string };
		Body: { decision: "approved" | "rejected" | "requested_changes"; note?: string };
	}>("/api/approvals/:id", async (req) => {
		const { id } = req.params;
		const { decision, note } = req.body;
		opts.db.insert(approvals).values({
			id: randomUUID(), deliverableId: id, decision, note,
		}).run();
		if (decision === "approved") {
			opts.db.update(deliverables).set({ status: "shipped", updatedAt: new Date() })
				.where(eq(deliverables.id, id)).run();
		} else if (decision === "rejected") {
			opts.db.update(deliverables).set({ status: "archived", updatedAt: new Date() })
				.where(eq(deliverables.id, id)).run();
		} else if (decision === "requested_changes") {
			opts.db.update(deliverables).set({ status: "drafting", updatedAt: new Date() })
				.where(eq(deliverables.id, id)).run();

			// Re-trigger the lead that managed this deliverable so it can re-brief the specialist
			const d = opts.db.select().from(deliverables).where(eq(deliverables.id, id)).get();
			if (d?.delegationId) {
				const specialistDel = opts.db.select().from(delegations)
					.where(eq(delegations.id, d.delegationId)).get();
				const leadDelId = specialistDel?.parentDelegationId;
				const leadDel = leadDelId
					? opts.db.select().from(delegations).where(eq(delegations.id, leadDelId)).get()
					: null;
				const targetAgent = leadDel?.toAgent ?? specialistDel?.fromAgent ?? "content-lead";
				const originalTask = (specialistDel?.payloadJson as { task?: string })?.task ?? "";
				const feedbackTask = [
					`## Változtatás kérése — visszaküldve felülvizsgálatra`,
					note ? `\n**Visszajelzés:** ${note}` : "",
					`\n**Eredeti feladat:**\n${originalTask}`,
					`\nKérd meg a specialistát, hogy javítsa ki a deliverable-t a visszajelzés alapján.`,
				].filter(Boolean).join("\n");

				const newDelId = randomUUID();
				opts.db.insert(delegations).values({
					id: newDelId, fromAgent: "review", toAgent: targetAgent,
					status: "requested", payloadJson: { task: feedbackTask } as never,
					parentDelegationId: leadDelId ?? d.delegationId,
					campaignId: d.campaignId,
				}).run();
				opts.broker.emit("delegation_created", { delegationId: newDelId, from: "review", to: targetAgent });
			}
		}
		opts.broker.emit("approval_decision", { deliverableId: id, decision, note });
		return { ok: true };
	});
}
