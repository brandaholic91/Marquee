import { asc, eq } from "drizzle-orm";
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
			.orderBy(asc(deliverableRevisions.createdAt))
			.all();
	});

	app.get<{ Params: { id: string } }>("/api/deliverables/:id/eval", async (req, reply) => {
		const d = opts.db
			.select()
			.from(deliverables)
			.where(eq(deliverables.id, req.params.id))
			.get();
		if (!d) return reply.code(404).send({ error: "not found" });
		if (!d.currentRevisionId) return null;
		return opts.db
			.select()
			.from(evals)
			.where(eq(evals.revisionId, d.currentRevisionId))
			.get() ?? null;
	});

	const VALID_TRANSITIONS: Record<string, string[]> = {
		drafting: ["awaiting_eval"],
		awaiting_eval: ["awaiting_approval", "drafting"],
		awaiting_approval: ["shipped", "drafting"],
		shipped: ["archived"],
		archived: [],
	};

	app.patch<{ Params: { id: string }; Body: { status: string } }>(
		"/api/deliverables/:id/status",
		async (req, reply) => {
			const d = opts.db
				.select()
				.from(deliverables)
				.where(eq(deliverables.id, req.params.id))
				.get();
			if (!d) return reply.code(404).send({ error: "not found" });
			const allowed = VALID_TRANSITIONS[d.status] ?? [];
			if (!allowed.includes(req.body.status)) {
				return reply.code(400).send({
					error: `cannot transition ${d.status} → ${req.body.status}`,
				});
			}
			opts.db
				.update(deliverables)
				.set({ status: req.body.status as typeof d.status, updatedAt: new Date() })
				.where(eq(deliverables.id, req.params.id))
				.run();
			opts.broker.emit("deliverable_status_changed", {
				deliverableId: req.params.id,
				from: d.status,
				to: req.body.status,
			});
			return { ok: true };
		},
	);
}
