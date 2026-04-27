import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { deliverableRevisions, deliverables, evals } from "../../db/schema.js";

export function registerDeliverableRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/deliverables", async () => opts.db.select().from(deliverables).all());

	app.get<{ Params: { id: string } }>("/api/deliverables/:id", async (req) => {
		const d = opts.db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).get();
		if (!d) return { statusCode: 404, error: "not found" };
		return d;
	});

	app.get<{ Params: { id: string; revId: string } }>(
		"/api/deliverables/:id/revisions/:revId",
		async (req) => {
			const r = opts.db.select().from(deliverableRevisions)
				.where(eq(deliverableRevisions.id, req.params.revId)).get();
			if (!r) return { statusCode: 404, error: "not found" };
			const contentMd = readFileSync(r.artifactPath, "utf8");
			return { ...r, contentMd };
		},
	);

	app.get<{ Params: { id: string } }>("/api/deliverables/:id/revisions", async (req) => {
		return opts.db
			.select()
			.from(deliverableRevisions)
			.where(eq(deliverableRevisions.deliverableId, req.params.id))
			.orderBy(deliverableRevisions.createdAt)
			.all();
	});

	app.get<{ Params: { id: string } }>("/api/deliverables/:id/eval", async (req) => {
		const d = opts.db
			.select()
			.from(deliverables)
			.where(eq(deliverables.id, req.params.id))
			.get();
		if (!d || !d.currentRevisionId) return null;
		return opts.db
			.select()
			.from(evals)
			.where(eq(evals.revisionId, d.currentRevisionId))
			.get() ?? null;
	});
}
