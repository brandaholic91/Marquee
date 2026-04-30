import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { briefs, campaigns } from "../db/schema.js";

type Db = ReturnType<typeof drizzle>;
interface Broker {
	emit: (event: Record<string, unknown>) => void;
}

const SPECIALIST_FOR: Record<string, string[]> = {
	copywriter: ["email", "blog_post"],
	"social-manager": ["social_post"],
	"paid-specialist": ["ad_copy"],
	"email-marketer": ["email"],
	"seo-specialist": ["blog_post", "content_brief_seo", "seo_report"],
};

export interface ProposeBriefInput {
	title: string;
	content_md: string;
	deliverable_type: "social_post" | "email" | "blog_post" | "ad_copy" | "content_brief_seo" | "seo_report";
	target_specialist: "copywriter" | "social-manager" | "paid-specialist" | "email-marketer" | "seo-specialist";
	platform?: string;
	campaign_name?: string;
	skill?: string;
}

export interface ProposeBriefContext {
	db: Db;
	broker: Broker;
	clientSlug: string;
	threadId: string;
}

export function makeProposeBriefTool(ctx: ProposeBriefContext) {
	return {
		name: "propose_brief",
		description:
			"Javasolj egy briefet az operátornak. A brief draft státuszban kerül a chat-be approval kártyaként; az operátor approve-olja és a megfelelő specialist megkapja.",
		inputSchema: {
			type: "object",
			properties: {
				title: { type: "string" },
				content_md: { type: "string" },
				deliverable_type: {
					type: "string",
					enum: ["social_post", "email", "blog_post", "ad_copy", "content_brief_seo", "seo_report"],
				},
				target_specialist: {
					type: "string",
					enum: ["copywriter", "social-manager", "paid-specialist", "email-marketer", "seo-specialist"],
					description:
						"A target_specialist lehetséges értékei:\n- copywriter: long-form szöveg (cikk, landing page, blog poszt, white paper).\n- social-manager: közösségi média poszt (LinkedIn, Facebook, Instagram, Twitter/X).\n- paid-specialist: fizetett hirdetés creative (Meta ads, Google ads, targeting javaslat).\n- email-marketer: bármilyen email (hírlevél, drip sorozat, transactional email). Automatizált sorozatnál is ezt válaszd.\n- seo-specialist: SEO-feladatok: kulcsszó-kutatás (skill: keyword_research), on-page ajánlás (skill: on_page_seo_recommendation), technikai SEO audit (skill: technical_seo_audit), SEO-orientált content brief Copywriter-nek (skill: content_brief_seo).\nTILOS target_specialist-ként: brand_voice_guardian — ez review role, kizárólag az operátor triggereli.\n\nCopywriter skill-választás:\n- Ha általános cikket kell írni: deliverable_type: blog_post, skill elhagyható.\n- Ha SEO-orientált cikket kell írni ÉS már van SEO content brief deliverable: deliverable_type: blog_post, skill: seo_article_writer, parent_deliverable_id töltve. Ha még nincs SEO brief, ELŐSZÖR javasolj seo-specialist briefet content_brief_seo skill-lel.",
				},
				platform: { type: "string" },
				campaign_name: {
					type: "string",
					description:
						"Opcionális kampánynév. Ha meg van adva, a brief egy kampányhoz tartozik. Azonos névvel több brief is kerülhet egy kampányba.",
				},
				skill: { type: "string" },
			},
			required: ["title", "content_md", "deliverable_type", "target_specialist"],
		},
		execute: async (input: ProposeBriefInput) => {
			const allowed = SPECIALIST_FOR[input.target_specialist] ?? [];
			if (!allowed.includes(input.deliverable_type)) {
				throw new Error(`${input.target_specialist} cannot produce ${input.deliverable_type}`);
			}

			// Find or create campaign — INSERT OR IGNORE + SELECT handles concurrent parallel tool calls
			let campaignId: string | null = null;
			if (input.campaign_name) {
				const tentativeId = createId();
				await ctx.db
					.insert(campaigns)
					.values({
						id: tentativeId,
						clientSlug: ctx.clientSlug,
						title: input.campaign_name,
						status: "active",
						createdAt: Date.now(),
					})
					.onConflictDoNothing();
				// Regardless of whether we inserted or hit conflict, fetch the canonical row
				const rows = await ctx.db
					.select()
					.from(campaigns)
					.where(and(eq(campaigns.clientSlug, ctx.clientSlug), eq(campaigns.title, input.campaign_name)))
					.limit(1)
					.all();
				campaignId = rows[0]?.id ?? null;
			}

			const id = createId();
			await ctx.db.insert(briefs).values({
				id,
				clientSlug: ctx.clientSlug,
				sourceThreadId: ctx.threadId,
				campaignId,
				contentMd: JSON.stringify({
					title: input.title,
					body: input.content_md,
					deliverable_type: input.deliverable_type,
					target_specialist: input.target_specialist,
					platform: input.platform ?? null,
					skill: input.skill ?? null,
				}),
				status: "draft",
				createdAt: Date.now(),
				dispatchedAt: null,
			});
			ctx.broker.emit({
				type: "brief_proposed",
				brief_id: id,
				client_slug: ctx.clientSlug,
				thread_id: ctx.threadId,
				title: input.title,
				content_md: input.content_md,
				deliverable_type: input.deliverable_type,
				target_specialist: input.target_specialist,
				platform: input.platform ?? null,
				campaign_name: input.campaign_name ?? null,
				skill: input.skill ?? null,
			});
			return { brief_id: id };
		},
	};
}
