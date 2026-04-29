import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { approvals, briefs, delegations, deliverables, deliverableRevisions } from "../../db/schema.js";

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
			const d = opts.db.select().from(deliverables).where(eq(deliverables.id, id)).get();
			if (d?.delegationId) {
				const del = opts.db.select().from(delegations).where(eq(delegations.id, d.delegationId)).get();
				// Mark brief as done so recovery doesn't re-queue it
				if (del?.briefId) {
					opts.db.update(briefs).set({ status: "done" }).where(eq(briefs.id, del.briefId)).run();
				}
				// Re-trigger parent lead agent so it can synthesize and continue pipeline
				if (del?.parentDelegationId) {
					const parentDel = opts.db.select().from(delegations)
						.where(eq(delegations.id, del.parentDelegationId)).get();
					if (parentDel) {
						// Read deliverable content to include in prompt
						let contentMd = "";
						if (d.currentRevisionId) {
							const rev = opts.db.select().from(deliverableRevisions)
								.where(eq(deliverableRevisions.id, d.currentRevisionId)).get();
							if (rev?.artifactPath) {
								try { contentMd = readFileSync(rev.artifactPath, "utf8"); } catch { /* ignore */ }
							}
						}
						const resumeMessage = [
							`## Deliverable elkészült: ${d.type}`,
							`A specialist (${del.toAgent}) leszállította és jóváhagyták.`,
							contentMd ? `\n### Tartalom:\n${contentMd}` : "",
							`\nEredetei feladatod: ${(parentDel.payloadJson as { task?: string }).task ?? ""}`,
							`\nFolytasd a feladatot: szintetizáld az eredményt és küld vissza a directornak a \`submit_to_director\` eszközzel.`,
						].filter(Boolean).join("\n");
						opts.router.promptWarmAgent(parentDel.toAgent, resumeMessage);
					}
				}
			}
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
					status: "requested", payloadJson: { task: feedbackTask, existingDeliverableId: id } as never,
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
