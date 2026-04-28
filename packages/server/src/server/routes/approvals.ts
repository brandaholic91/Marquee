import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { approvals, deliverables } from "../../db/schema.js";

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
		}
		opts.broker.emit("approval_decision", { deliverableId: id, decision });
		return { ok: true };
	});
}
