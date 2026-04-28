import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { briefs, campaigns } from "../../db/schema.js";

export function registerBriefRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/briefs", async () => opts.db.select().from(briefs).all());

	app.post<{ Body: { contentMd: string; campaignId?: string } }>("/api/briefs", async (req, reply) => {
		const { contentMd, campaignId: existingCampaignId } = req.body;
		if (!contentMd?.trim()) {
			return reply.status(400).send({ error: "contentMd is required" });
		}

		let campaignId: string;
		if (existingCampaignId) {
			const existing = opts.db.select().from(campaigns).where(eq(campaigns.id, existingCampaignId)).get();
			if (!existing) return reply.status(400).send({ error: `Campaign ${existingCampaignId} not found` });
			campaignId = existingCampaignId;
		} else {
			const firstLine = contentMd.trim().split("\n")[0];
			const headerMatch = firstLine.match(/^#+\s+(.+)$/);
			const campaignTitle = headerMatch
				? headerMatch[1].trim().slice(0, 80)
				: `Brief ${new Date().toISOString().slice(0, 10)}`;
			campaignId = randomUUID();
			opts.db.insert(campaigns).values({ id: campaignId, title: campaignTitle, status: "active" }).run();
		}

		const id = randomUUID();
		opts.db.insert(briefs).values({
			id, status: "draft",
			contentMd: contentMd.trim(),
			campaignId,
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
