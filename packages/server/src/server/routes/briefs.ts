import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { briefs } from "../../db/schema.js";

export function registerBriefRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/briefs", async () => opts.db.select().from(briefs).all());

	app.post<{ Params: { id: string } }>("/api/briefs/:id/dispatch", async (req) => {
		opts.db.update(briefs).set({ status: "dispatched", dispatchedAt: new Date() })
			.where(eq(briefs.id, req.params.id)).run();
		opts.broker.emit("brief_dispatched", { briefId: req.params.id });
		return { ok: true };
	});
}
