import type { FastifyPluginAsync } from "fastify";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { campaignCalendarItems, campaignPlans, campaigns, messages } from "../../db/schema.js";
import { createCalendarItem, createPlan, getPlanByCampaignId, listCalendarItems, updatePlan } from "../../db/queries.js";

type Db = ReturnType<typeof drizzle>;
interface Broker {
	emit: (event: Record<string, unknown>) => void;
}

export interface PlansRoutesOpts {
	db: Db;
	broker: Broker;
}

function setProposalStatus(contentJson: string, status: "accepted" | "discarded"): string {
	const payload = JSON.parse(contentJson) as Record<string, unknown>;
	payload.status = status;
	return JSON.stringify(payload);
}

export const plansRoutes: FastifyPluginAsync<PlansRoutesOpts> = async (app, opts) => {
	const { db, broker } = opts;

	app.get<{ Params: { id: string } }>("/api/campaigns/:id/plan", async (req, reply) => {
		const plan = getPlanByCampaignId(db, req.params.id);
		if (!plan) return { plan: null, calendar_items: [] };
		return { plan, calendar_items: listCalendarItems(db, plan.id) };
	});

	app.put<{ Params: { id: string }; Body: Record<string, unknown> }>("/api/campaigns/:id/plan", async (req) => {
		const existing = getPlanByCampaignId(db, req.params.id);
		if (!existing) {
			const planId = createPlan(db, {
				campaignId: req.params.id,
				clientSlug: "default",
				goal: String(req.body.goal ?? ""),
				goalType: (req.body.goal_type as any) ?? "other",
				audience: String(req.body.audience ?? ""),
				keyMessages: (req.body.key_messages as any[]) ?? [],
				channelMix: (req.body.channel_mix as any[]) ?? [],
				timelineStart: (req.body.timeline_start as number | undefined) ?? null,
				timelineEnd: (req.body.timeline_end as number | undefined) ?? null,
				kpi: String(req.body.kpi ?? ""),
			});
			broker.emit({ type: "plan.updated", plan_id: planId, campaign_id: req.params.id, updated_fields: ["all"] });
			return { ok: true, plan_id: planId };
		}
		updatePlan(db, existing.id, {
			goal: req.body.goal as string | undefined,
			goalType: req.body.goal_type as any,
			audience: req.body.audience as string | undefined,
			keyMessages: req.body.key_messages as any,
			channelMix: req.body.channel_mix as any,
			timelineStart: req.body.timeline_start as number | undefined,
			timelineEnd: req.body.timeline_end as number | undefined,
			kpi: req.body.kpi as string | undefined,
		});
		broker.emit({ type: "plan.updated", plan_id: existing.id, campaign_id: req.params.id, updated_fields: Object.keys(req.body) });
		return { ok: true, plan_id: existing.id };
	});

	app.get<{ Params: { id: string } }>("/api/campaigns/:id/plan/calendar-items", async (req) => {
		const plan = getPlanByCampaignId(db, req.params.id);
		if (!plan) return [];
		return listCalendarItems(db, plan.id);
	});

	app.post<{ Params: { id: string }; Body: Record<string, unknown> }>("/api/campaigns/:id/plan/calendar-items", async (req, reply) => {
		const plan = getPlanByCampaignId(db, req.params.id);
		if (!plan) return reply.code(400).send({ error: "plan_not_found" });
		const id = createCalendarItem(db, {
			planId: plan.id,
			campaignId: req.params.id,
			clientSlug: "default",
			channel: req.body.channel as any,
			deliverableType: (req.body.deliverable_type as any) ?? null,
			targetDate: Number(req.body.target_date),
			intent: String(req.body.intent ?? ""),
			keyMessageRef: (req.body.key_message_ref as string | undefined) ?? null,
		});
		broker.emit({ type: "calendar_item.added", item_id: id, plan_id: plan.id });
		return reply.code(201).send({ item_id: id });
	});

	app.patch<{ Params: { id: string; itemId: string }; Body: Record<string, unknown> }>(
		"/api/campaigns/:id/plan/calendar-items/:itemId",
		async (req, reply) => {
			const row = await db
				.select()
				.from(campaignCalendarItems)
				.where(and(eq(campaignCalendarItems.id, req.params.itemId), eq(campaignCalendarItems.campaignId, req.params.id)))
				.limit(1)
				.all();
			if (row.length === 0) return reply.code(404).send({ error: "not_found" });
			if (req.body.status && req.body.status !== "cancelled") {
				return reply.code(400).send({ error: "use state machine" });
			}
			await db
				.update(campaignCalendarItems)
				.set({
					channel: (req.body.channel as any) ?? row[0].channel,
					deliverableType: (req.body.deliverable_type as any) ?? row[0].deliverableType,
					targetDate: (req.body.target_date as number) ?? row[0].targetDate,
					intent: (req.body.intent as string) ?? row[0].intent,
					keyMessageRef: (req.body.key_message_ref as string | null | undefined) ?? row[0].keyMessageRef,
					updatedAt: Date.now(),
				})
				.where(eq(campaignCalendarItems.id, req.params.itemId))
				.run();
			broker.emit({ type: "calendar_item.updated", item_id: req.params.itemId, plan_id: row[0].planId });
			return { ok: true };
		},
	);

	app.delete<{ Params: { id: string; itemId: string } }>("/api/campaigns/:id/plan/calendar-items/:itemId", async (req, reply) => {
		const row = await db
			.select()
			.from(campaignCalendarItems)
			.where(and(eq(campaignCalendarItems.id, req.params.itemId), eq(campaignCalendarItems.campaignId, req.params.id)))
			.limit(1)
			.all();
		if (row.length === 0) return reply.code(404).send({ error: "not_found" });
		broker.emit({ type: "calendar_item.cancel_requested", item_id: req.params.itemId });
		return { ok: true };
	});

	app.post<{ Params: { msgId: string } }>("/api/proposals/:msgId/accept", async (req, reply) => {
		const row = await db.select().from(messages).where(eq(messages.id, req.params.msgId)).limit(1).all();
		if (row.length === 0) return reply.code(404).send({ error: "not_found" });
		const msg = row[0];
		const payload = JSON.parse(msg.contentJson) as Record<string, any>;

		// Idempotency guard — double-click or retry returns ok without re-applying
		if (payload.status === "accepted") return { ok: true };

		if (msg.type === "plan_proposal") {
			const p = payload.proposal;
			// epoch seconds → milliseconds normalisation (LLM sends seconds, codebase uses ms)
			const toMs = (ts: number) => ts < 1e10 ? ts * 1000 : ts;
			const existing = getPlanByCampaignId(db, p.campaign_id);
			let planId: string;
			if (existing) {
				// Update existing plan with proposal data instead of silently ignoring
				updatePlan(db, existing.id, {
					goal: p.goal,
					goalType: p.goal_type,
					audience: p.audience,
					keyMessages: p.key_messages ?? [],
					channelMix: p.channel_mix ?? [],
					timelineStart: p.timeline_start != null ? toMs(p.timeline_start) : null,
					timelineEnd: p.timeline_end != null ? toMs(p.timeline_end) : null,
					kpi: p.kpi ?? "",
				});
				planId = existing.id;
			} else {
				planId = createPlan(db, {
					campaignId: p.campaign_id,
					clientSlug: "default",
					goal: p.goal,
					goalType: p.goal_type,
					audience: p.audience,
					keyMessages: p.key_messages ?? [],
					channelMix: p.channel_mix ?? [],
					timelineStart: p.timeline_start != null ? toMs(p.timeline_start) : null,
					timelineEnd: p.timeline_end != null ? toMs(p.timeline_end) : null,
					kpi: p.kpi ?? "",
				});
			}
			for (const item of p.calendar_items ?? []) {
				createCalendarItem(db, {
					planId,
					campaignId: p.campaign_id,
					clientSlug: "default",
					channel: item.channel,
					deliverableType: item.deliverable_type ?? null,
					targetDate: toMs(item.target_date),
					intent: item.intent,
					keyMessageRef: item.key_message_ref ?? null,
				});
			}
			await db.update(messages).set({ contentJson: setProposalStatus(msg.contentJson, "accepted") }).where(eq(messages.id, msg.id)).run();
			broker.emit({ type: "proposal.accepted", message_id: msg.id, proposal_type: msg.type });
			broker.emit({ type: "plan.accepted", campaign_id: p.campaign_id, plan_id: planId });
			return { ok: true };
		}

		if (msg.type === "plan_update_proposal") {
			const p = payload.proposal;
			updatePlan(db, p.plan_id, {
				goal: p.patch?.goal,
				goalType: p.patch?.goal_type,
				audience: p.patch?.audience,
				keyMessages: p.patch?.key_messages,
				channelMix: p.patch?.channel_mix,
				timelineStart: p.patch?.timeline_start,
				timelineEnd: p.patch?.timeline_end,
				kpi: p.patch?.kpi,
			});
			await db.update(messages).set({ contentJson: setProposalStatus(msg.contentJson, "accepted") }).where(eq(messages.id, msg.id)).run();
			broker.emit({ type: "proposal.accepted", message_id: msg.id, proposal_type: msg.type });
			broker.emit({ type: "plan.updated", plan_id: p.plan_id, updated_fields: Object.keys(p.patch ?? {}) });
			return { ok: true };
		}

		if (msg.type === "calendar_item_proposal") {
			const p = payload.proposal;
			const plan = await db.select().from(campaignPlans).where(eq(campaignPlans.id, p.plan_id)).limit(1).all();
			if (plan.length === 0) return reply.code(400).send({ error: "plan_not_found" });
			const itemId = createCalendarItem(db, {
				planId: p.plan_id,
				campaignId: plan[0].campaignId,
				clientSlug: "default",
				channel: p.channel,
				deliverableType: p.deliverable_type ?? null,
				targetDate: p.target_date,
				intent: p.intent,
				keyMessageRef: p.key_message_ref ?? null,
			});
			await db.update(messages).set({ contentJson: setProposalStatus(msg.contentJson, "accepted") }).where(eq(messages.id, msg.id)).run();
			broker.emit({ type: "proposal.accepted", message_id: msg.id, proposal_type: msg.type });
			broker.emit({ type: "calendar_item.added", item_id: itemId, plan_id: p.plan_id });
			return { ok: true };
		}

		return reply.code(400).send({ error: "unsupported_proposal_type" });
	});

	app.post<{ Params: { msgId: string } }>("/api/proposals/:msgId/discard", async (req, reply) => {
		const row = await db.select().from(messages).where(eq(messages.id, req.params.msgId)).limit(1).all();
		if (row.length === 0) return reply.code(404).send({ error: "not_found" });
		await db.update(messages).set({ contentJson: setProposalStatus(row[0].contentJson, "discarded") }).where(eq(messages.id, req.params.msgId)).run();
		broker.emit({ type: "proposal.discarded", message_id: req.params.msgId, proposal_type: row[0].type });
		if (row[0].type === "plan_proposal" || row[0].type === "plan_update_proposal") {
			broker.emit({ type: "plan.discarded", message_id: req.params.msgId });
		}
		return { ok: true };
	});
};
