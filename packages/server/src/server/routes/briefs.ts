import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { briefs } from "../../db/schema.js";

export function registerBriefRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/briefs", async () => opts.db.select().from(briefs).all());

	app.post<{ Body: { title?: string; contentMd: string } }>("/api/briefs", async (req, reply) => {
		const { title, contentMd } = req.body;
		if (!contentMd?.trim()) {
			return reply.status(400).send({ error: "contentMd is required" });
		}
		const id = randomUUID();
		opts.db.insert(briefs).values({
			id, status: "draft",
			contentMd: contentMd.trim(),
		}).run();
		opts.router.queueBrief(id);
		return { id, ok: true };
	});

	app.post<{ Params: { id: string } }>("/api/briefs/:id/dispatch", async (req) => {
		opts.db.update(briefs).set({ status: "dispatched", dispatchedAt: new Date() })
			.where(eq(briefs.id, req.params.id)).run();
		opts.broker.emit("brief_dispatched", { briefId: req.params.id });
		return { ok: true };
	});
}
