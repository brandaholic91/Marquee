export type RoleSlug =
	| "director"
	| "copywriter"
	| "social-manager"
	| "paid-specialist"
	| "email-marketer"
	| "seo-specialist"
	| "brand-voice-guardian";

export type Lifecycle = "warm" | "transient";

export interface RoleConfig {
	slug: RoleSlug;
	lifecycle: Lifecycle;
	tools: string[];
	produces: string[];
}

export const ROLE_CONFIGS: Record<RoleSlug, RoleConfig> = {
	director: {
		slug: "director",
		lifecycle: "warm",
		tools: ["propose_brief", "propose_memory_update", "read_memory", "get_campaign_status"],
		produces: [],
	},
	copywriter: {
		slug: "copywriter",
		lifecycle: "transient",
		tools: ["read_memory", "submit_deliverable"],
		produces: ["email", "blog_post"],
	},
	"social-manager": {
		slug: "social-manager",
		lifecycle: "transient",
		tools: ["read_memory", "submit_deliverable"],
		produces: ["social_post"],
	},
	"paid-specialist": {
		slug: "paid-specialist",
		lifecycle: "transient",
		tools: ["read_memory", "submit_deliverable"],
		produces: ["ad_copy"],
	},
	"email-marketer": {
		slug: "email-marketer",
		lifecycle: "transient",
		tools: ["read_memory", "submit_deliverable"],
		produces: ["email"],
	},
	"seo-specialist": {
		slug: "seo-specialist",
		lifecycle: "transient",
		tools: ["read_memory", "submit_deliverable"],
		produces: ["blog_post", "content_brief_seo", "seo_report"],
	},
	"brand-voice-guardian": {
		slug: "brand-voice-guardian",
		lifecycle: "transient",
		tools: ["read_memory", "submit_review"],
		produces: [],
	},
};

export function getRoleConfig(slug: RoleSlug): RoleConfig {
	const c = ROLE_CONFIGS[slug];
	if (!c) throw new Error(`unknown role: ${slug}`);
	return c;
}
