import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { briefs, campaigns, deliverables, tasks } from "../../db/schema.js";

export function registerCampaignRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/campaigns", async () => {
		const allCampaigns = opts.db.select().from(campaigns).all();
		const allDeliverables = opts.db.select().from(deliverables).all();
		const allTasks = opts.db.select().from(tasks).all();
		return allCampaigns.map((c) => ({
			...c,
			deliverableCount: allDeliverables.filter((d) => d.campaignId === c.id).length,
			taskCount: allTasks.filter((t) => t.campaignId === c.id).length,
			pendingApprovals: allDeliverables.filter((d) => d.campaignId === c.id && d.status === "awaiting_approval").length,
		}));
	});

	app.get<{ Params: { id: string } }>("/api/campaigns/:id", async (req, reply) => {
		const c = opts.db.select().from(campaigns).where(eq(campaigns.id, req.params.id)).get();
		if (!c) return reply.code(404).send({ error: "not found" });
		const campaignBriefs = opts.db.select().from(briefs)
			.where(eq(briefs.campaignId, req.params.id)).all();
		const campaignDeliverables = opts.db.select().from(deliverables)
			.where(eq(deliverables.campaignId, req.params.id)).all();
		const campaignTasks = opts.db.select().from(tasks)
			.where(eq(tasks.campaignId, req.params.id)).all();
		return { ...c, briefs: campaignBriefs, deliverables: campaignDeliverables, tasks: campaignTasks };
	});

	app.patch<{ Params: { id: string }; Body: { title?: string; description?: string; status?: string } }>(
		"/api/campaigns/:id",
		async (req, reply) => {
			const c = opts.db.select().from(campaigns).where(eq(campaigns.id, req.params.id)).get();
			if (!c) return reply.code(404).send({ error: "not found" });
			const { title, description, status } = req.body;
			const patch: Partial<{ title: string; description: string | null; status: "active" | "completed" | "archived" }> = {};
			if (title !== undefined) patch.title = title;
			if (description !== undefined) patch.description = description;
			if (status !== undefined) patch.status = status as "active" | "completed" | "archived";
			opts.db.update(campaigns).set(patch).where(eq(campaigns.id, req.params.id)).run();
			return { ok: true };
		},
	);
}
