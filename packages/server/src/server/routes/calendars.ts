import type { FastifyPluginAsync } from "fastify";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { campaignCalendarItems, campaignPlans } from "../../db/schema.js";

type Db = ReturnType<typeof drizzle>;

export interface CalendarsRoutesOpts {
	db: Db;
}

export const calendarsRoutes: FastifyPluginAsync<CalendarsRoutesOpts> = async (app, opts) => {
	const { db } = opts;

	// GET /api/campaigns/:campaignId/calendar_items
	app.get<{ Params: { campaignId: string } }>(
		"/api/campaigns/:campaignId/calendar_items",
		async (request, reply) => {
			const { campaignId } = request.params;

			const items = await db
				.select()
				.from(campaignCalendarItems)
				.where(eq(campaignCalendarItems.campaignId, campaignId))
				.all();

			const plan = await db
				.select()
				.from(campaignPlans)
				.where(eq(campaignPlans.campaignId, campaignId))
				.limit(1)
				.all();

			return {
				plan: plan.length > 0 ? plan[0] : null,
				items: items.map((item) => ({
					...item,
					startTime: item.startTime || "09:00",
				})),
			};
		},
	);

	// PUT /api/campaigns/:campaignId/calendar_items/:itemId
	app.put<{
		Params: { campaignId: string; itemId: string };
		Body: { startDate?: number; startTime?: string; intent?: string; channel?: string; status?: string };
	}>(
		"/api/campaigns/:campaignId/calendar_items/:itemId",
		async (request, reply) => {
			const { campaignId, itemId } = request.params;
			const { startDate, startTime, intent, channel, status } = request.body;

			const updateData: Record<string, any> = {
				updatedAt: Math.floor(Date.now() / 1000),
			};

			if (startDate !== undefined) updateData.targetDate = startDate;
			if (startTime !== undefined) updateData.startTime = startTime;
			if (intent !== undefined) updateData.intent = intent;
			if (channel !== undefined) updateData.channel = channel;
			if (status !== undefined) updateData.status = status;

			const updated = await db
				.update(campaignCalendarItems)
				.set(updateData)
				.where(
					and(
						eq(campaignCalendarItems.id, itemId),
						eq(campaignCalendarItems.campaignId, campaignId),
					),
				)
				.returning()
				.all();

			if (updated.length === 0) {
				return reply.status(404).send({ error: "Item not found" });
			}

			return { ok: true, item: updated[0] };
		},
	);

	// DELETE /api/campaigns/:campaignId/calendar_items/:itemId
	app.delete<{ Params: { campaignId: string; itemId: string } }>(
		"/api/campaigns/:campaignId/calendar_items/:itemId",
		async (request, reply) => {
			const { campaignId, itemId } = request.params;

			await db
				.delete(campaignCalendarItems)
				.where(
					and(
						eq(campaignCalendarItems.id, itemId),
						eq(campaignCalendarItems.campaignId, campaignId),
					),
				)
				.run();

			return { ok: true };
		},
	);
};
