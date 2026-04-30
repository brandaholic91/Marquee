import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { briefs, delegations, deliverables, deliverableRevisions } from "../db/schema.js";
import { spawnAgent } from "../agents/factory.js";
import { AuthManager } from "../providers/auth.js";
import { readFile } from "node:fs/promises";

type Db = ReturnType<typeof drizzle>;
interface Broker {
	emit: (e: Record<string, unknown>) => void;
}

export interface DispatchInput {
	db: Db;
	broker: Broker;
	dataDir: string;
	briefId: string;
	authManager: AuthManager;
}

interface BriefPayload {
	title: string;
	body: string;
	deliverable_type: "social_post" | "email" | "blog_post" | "ad_copy" | "content_brief_seo" | "seo_report";
	target_specialist: "copywriter" | "social-manager" | "paid-specialist" | "email-marketer" | "seo-specialist";
	platform?: string | null;
	skill?: string | null;
}

export async function dispatchBrief(input: DispatchInput): Promise<void> {
	const rows = await input.db.select().from(briefs).where(eq(briefs.id, input.briefId)).all();
	if (rows.length === 0) throw new Error(`brief not found: ${input.briefId}`);
	const brief = rows[0];
	if (brief.status !== "draft") throw new Error(`brief already dispatched or done: ${input.briefId}`);

	const payload = JSON.parse(brief.contentMd) as BriefPayload;

	// Hard validáció: seo_article_writer csak parent_deliverable_id-vel futhat
	if (payload.skill === "seo_article_writer" && !brief.parentDeliverableId) {
		throw new Error(
			"seo_article_writer skill requires a parent SEO content brief (parent_deliverable_id). " +
				"Run SEO Specialist with content_brief_seo skill first.",
		);
	}

	// Parent deliverable tartalmának kiolvasása (ha van)
	let parentContent: string | undefined;
	if (brief.parentDeliverableId) {
		const parentDel = (
			await input.db.select().from(deliverables).where(eq(deliverables.id, brief.parentDeliverableId)).limit(1).all()
		)[0];
		if (parentDel?.currentRevisionId) {
			const rev = (
				await input.db
					.select()
					.from(deliverableRevisions)
					.where(eq(deliverableRevisions.id, parentDel.currentRevisionId))
					.limit(1)
					.all()
			)[0];
			if (rev?.artifactPath) {
				parentContent = await readFile(rev.artifactPath, "utf-8").catch(() => undefined);
			}
		}
	}

	const now = Date.now();

	await input.db.update(briefs).set({ status: "dispatched", dispatchedAt: now }).where(eq(briefs.id, input.briefId));

	const delegationId = createId();
	await input.db.insert(delegations).values({
		id: delegationId,
		briefId: input.briefId,
		clientSlug: brief.clientSlug,
		campaignId: brief.campaignId ?? null,
		fromAgent: "director",
		toAgent: payload.target_specialist,
		payloadJson: brief.contentMd,
		status: "in_progress",
		requestedAt: now,
		completedAt: null,
	});

	input.broker.emit({ type: "brief_dispatched", brief_id: input.briefId, delegation_id: delegationId });

	const { agent, session } = await spawnAgent({
		db: input.db,
		broker: input.broker,
		dataDir: input.dataDir,
		clientSlug: brief.clientSlug,
		role: payload.target_specialist,
		delegationId,
		deliverableType: payload.deliverable_type,
		authManager: input.authManager,
	});

	input.broker.emit({
		type: "delegation_started",
		delegation_id: delegationId,
		agent_slug: payload.target_specialist,
		session_id: session.id,
	});

	// Fire-and-forget: agent.prompt resolves when submit_deliverable returns
	const prompt = composePrompt(payload, parentContent);
	agent.prompt(prompt).catch((err) => {
		input.broker.emit({ type: "error", source: "specialist", delegation_id: delegationId, message: String(err) });
	});
}

export function composePrompt(p: BriefPayload, parentContent?: string): string {
	const parts: string[] = [];
	if (parentContent) {
		parts.push(`=== FORRÁS DELIVERABLE ===\n${parentContent.trim()}\n=== / FORRÁS DELIVERABLE VÉGE ===`);
	}
	parts.push(
		`=== AKTUÁLIS BRIEF ===`,
		`# Brief: ${p.title}`,
		...(p.platform ? [`Platform: ${p.platform}`] : []),
		`Deliverable típus: ${p.deliverable_type}`,
		"",
		p.body,
		`=== / AKTUÁLIS BRIEF VÉGE ===`,
	);
	return parts.join("\n");
}
