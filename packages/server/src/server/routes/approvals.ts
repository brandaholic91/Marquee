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
				// Re-trigger parent lead agent to synthesize result and continue pipeline
				if (del?.parentDelegationId) {
					const parentDel = opts.db.select().from(delegations)
						.where(eq(delegations.id, del.parentDelegationId)).get();
					if (parentDel) {
						let contentMd = "";
						if (d.currentRevisionId) {
							const rev = opts.db.select().from(deliverableRevisions)
								.where(eq(deliverableRevisions.id, d.currentRevisionId)).get();
							if (rev?.artifactPath) {
								try { contentMd = readFileSync(rev.artifactPath, "utf8"); } catch { /* ignore */ }
							}
						}
						// Use retrigger event with explicit synthesis instruction
						// This spawns a NEW transient agent, not re-prompting the warm one
						const synthesisTask = [
							`## Szintetizálás — ${d.type} elkészült`,
							``,
							`A specialist elvégezte a feladatot. NE delegálj újra. A te feladatod most KIZÁRÓLAG:`,
							`1. Olvasd el az alábbi eredményt`,
							`2. Szintetizáld 2-3 mondatban a legfontosabb megállapításokat`,
							`3. Hívd meg a \`submit_to_director\` eszközt az összefoglalóval`,
							``,
							`### Eredmény (${d.type}):`,
							contentMd || "(tartalom nem olvasható)",
						].join("\n");

						// Create a new one-shot delegation for synthesis
						const synthDelId = randomUUID();
						opts.db.insert(delegations).values({
							id: synthDelId,
							fromAgent: "system",
							toAgent: parentDel.toAgent,
							status: "requested",
							payloadJson: { task: synthesisTask } as never,
							parentDelegationId: del.parentDelegationId,
							campaignId: d.campaignId,
						}).run();
						opts.broker.emit("delegation_created", {
							delegationId: synthDelId,
							from: "system",
							to: parentDel.toAgent,
						});
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
		opts.orchestrator?.onApprovalDecision(id, decision, note);
		opts.broker.emit("approval_decision", { deliverableId: id, decision, note });
		return { ok: true };
	});
}
