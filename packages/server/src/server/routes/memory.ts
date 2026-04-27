import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { memoryProposals } from "../../db/schema.js";

export function registerMemoryRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/memory-proposals", async () =>
		opts.db.select().from(memoryProposals).all(),
	);

	app.post<{ Params: { id: string }; Body: { decision: "approved" | "rejected" } }>(
		"/api/memory-proposals/:id/approve",
		async (req) => {
			const { id } = req.params;
			const decision = req.body?.decision ?? "approved";
			opts.db.update(memoryProposals)
				.set({ status: decision === "approved" ? "approved" : "rejected" })
				.where(eq(memoryProposals.id, id))
				.run();
			opts.broker.emit("memory_proposal_decided", { proposalId: id, decision });
			return { ok: true };
		},
	);
}
