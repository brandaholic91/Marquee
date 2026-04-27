import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { deliverableRevisions, deliverables } from "../../db/schema.js";

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
}
