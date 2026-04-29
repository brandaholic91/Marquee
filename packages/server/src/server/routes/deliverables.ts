import { asc, eq, inArray } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { deliverableRevisions, deliverables, evals, delegations, approvals } from "../../db/schema.js";

export function registerDeliverableRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get<{ Querystring: { campaignId?: string } }>("/api/deliverables", async (req) => {
		let result = opts.db.select().from(deliverables).all();
		if (req.query.campaignId) result = result.filter((d) => d.campaignId === req.query.campaignId);
		return result;
	});

	app.get<{ Params: { revisionId: string } }>(
		"/api/deliverables/revisions/:revisionId/content",
		async (req, reply) => {
			const rev = opts.db
				.select()
				.from(deliverableRevisions)
				.where(eq(deliverableRevisions.id, req.params.revisionId))
				.get();
			if (!rev) return reply.code(404).send({ error: "not found" });
			const content = readFileSync(rev.artifactPath, "utf8");
			return { content };
		},
	);

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

	app.post<{ Params: { id: string }; Body: { contentMd: string } }>(
		"/api/deliverables/:id/revisions",
		async (req, reply) => {
			const d = opts.db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).get();
			if (!d) return reply.code(404).send({ error: "not found" });
			const { contentMd } = req.body;
			if (!contentMd?.trim()) return reply.code(400).send({ error: "contentMd required" });

			// Count existing revisions to name the new one
			const existing = opts.db.select().from(deliverableRevisions)
				.where(eq(deliverableRevisions.deliverableId, req.params.id)).all();
			const revNum = String(existing.length + 1).padStart(3, "0");

			const { mkdirSync, writeFileSync } = await import("node:fs");
			const { join } = await import("node:path");
			const artifactDir = join(opts.dataDir, "artifacts", req.params.id);
			mkdirSync(artifactDir, { recursive: true });
			const artifactPath = join(artifactDir, `rev_${revNum}.md`);
			writeFileSync(artifactPath, contentMd, "utf8");

			const revisionId = randomUUID();
			opts.db.insert(deliverableRevisions).values({
				id: revisionId, deliverableId: req.params.id,
				artifactPath, createdByAgent: "human",
			}).run();
			opts.db.update(deliverables).set({
				currentRevisionId: revisionId, status: "awaiting_approval",
			}).where(eq(deliverables.id, req.params.id)).run();

			return { id: revisionId, ok: true };
		},
	);

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

	app.get<{ Params: { id: string } }>("/api/deliverables/:id/thread", async (req, reply) => {
		const d = opts.db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).get();
		if (!d) return reply.code(404).send({ error: "not found" });

		type ThreadStep = { id: string; kind: "delegation" | "approval"; fromAgent: string; toAgent?: string; task?: string; note?: string; decision?: string; status?: string; requestedAt: Date | null };
		const delegationMap = new Map<string, ThreadStep>();

		// Step 1: collect ALL delegations touching this deliverable's chain
		// Walk upward from deliverable's delegation
		let currentId: string | null | undefined = d.delegationId;
		while (currentId && !delegationMap.has(currentId)) {
			const del = opts.db.select().from(delegations).where(eq(delegations.id, currentId)).get();
			if (!del) break;
			const payload = del.payloadJson as { task?: string };
			delegationMap.set(del.id, { id: del.id, kind: "delegation", fromAgent: del.fromAgent, toAgent: del.toAgent, task: payload.task ?? "", status: del.status, requestedAt: del.requestedAt });
			currentId = del.parentDelegationId;
		}

		// Step 2: iteratively expand — find delegations whose parent is already in our set
		// (captures review cycles that branch off the original chain)
		let prevSize = 0;
		while (delegationMap.size !== prevSize) {
			prevSize = delegationMap.size;
			if (prevSize === 0) break;
			const children = opts.db.select().from(delegations)
				.where(inArray(delegations.parentDelegationId, [...delegationMap.keys()])).all();
			for (const del of children) {
				if (!delegationMap.has(del.id)) {
					const payload = del.payloadJson as { task?: string };
					delegationMap.set(del.id, { id: del.id, kind: "delegation", fromAgent: del.fromAgent, toAgent: del.toAgent, task: payload.task ?? "", status: del.status, requestedAt: del.requestedAt });
				}
			}
		}

		const allSteps: ThreadStep[] = [...delegationMap.values()];

		// Step 3: add approval events
		const deliverableApprovals = opts.db.select().from(approvals)
			.where(eq(approvals.deliverableId, req.params.id)).all();
		for (const a of deliverableApprovals) {
			allSteps.push({ id: a.id, kind: "approval", fromAgent: "human", decision: a.decision, note: a.note ?? undefined, requestedAt: a.createdAt ?? null });
		}

		// Sort chronologically
		allSteps.sort((a, b) => {
			const ta = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
			const tb = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
			return ta - tb;
		});

		return { steps: allSteps };
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

	app.post<{ Params: { id: string }; Body: { channels: string[] } }>(
		"/api/deliverables/:id/repurpose",
		async (req, reply) => {
			const d = opts.db.select().from(deliverables).where(eq(deliverables.id, req.params.id)).get();
			if (!d) return reply.code(404).send({ error: "not found" });
			if (d.status !== "shipped") {
				return reply.code(400).send({ error: "only shipped deliverables can be repurposed" });
			}
			const campaignId = d.campaignId ?? null;
			const { channels } = req.body;
			if (!channels || channels.length === 0) {
				return reply.code(400).send({ error: "channels must not be empty" });
			}
			if (channels.length > 5) {
				return reply.code(400).send({ error: "max 5 channels per repurpose request" });
			}

			let sourceContent = "";
			if (d.currentRevisionId) {
				const rev = opts.db
					.select()
					.from(deliverableRevisions)
					.where(eq(deliverableRevisions.id, d.currentRevisionId))
					.get();
				if (rev) {
					try { sourceContent = readFileSync(rev.artifactPath, "utf8"); } catch { /* ignore */ }
				}
			}

			const delegationId = randomUUID();
			opts.db.insert(delegations).values({
				id: delegationId,
				fromAgent: "human",
				toAgent: "content-lead",
				status: "requested",
				campaignId,
				payloadJson: {
					task: `Repurpose the following content for these channels: ${channels.join(", ")}. For each channel, delegate to a repurposer specialist using delegate_to_specialist. Include the source deliverable ID "${req.params.id}" and the source content in each delegation context so the repurposer can set source_deliverable_id when submitting.`,
					context: `Source deliverable ID: ${req.params.id}\n\nSource content:\n${sourceContent}`,
				} as never,
			}).run();
			opts.broker.emit("delegation_created", { delegationId, from: "human", to: "content-lead" });
			return { delegationId };
		},
	);
}
