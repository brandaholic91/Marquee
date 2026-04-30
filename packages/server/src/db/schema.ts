// FK policy: no cascades. Lifecycle is via status fields (deliverables.status='archived',
// briefs.status='done', etc.). Hard-deletes are not part of the v1 design.
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable("clients", {
	slug: text("slug").primaryKey(),
	name: text("name").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const campaigns = sqliteTable(
	"campaigns",
	{
		id: text("id").primaryKey(),
		clientSlug: text("client_slug")
			.notNull()
			.references(() => clients.slug),
		title: text("title").notNull(),
		status: text("status", { enum: ["active", "completed", "archived"] })
			.notNull()
			.default("active"),
		createdAt: integer("created_at").notNull(),
	},
	(t) => ({
		byClient: index("idx_campaigns_client").on(t.clientSlug, t.status),
		uniqueTitle: uniqueIndex("uq_campaigns_client_title").on(t.clientSlug, t.title),
	}),
);

export const campaignPlans = sqliteTable(
	"campaign_plans",
	{
		id: text("id").primaryKey(),
		campaignId: text("campaign_id")
			.notNull()
			.references(() => campaigns.id),
		clientSlug: text("client_slug")
			.notNull()
			.references(() => clients.slug),
		goal: text("goal").notNull().default(""),
		goalType: text("goal_type", {
			enum: ["lead-gen", "awareness", "nurture", "activation", "retention", "other"],
		})
			.notNull()
			.default("other"),
		audience: text("audience").notNull().default(""),
		keyMessages: text("key_messages", { mode: "json" })
			.$type<Array<{ id: string; text: string }>>()
			.notNull()
			.default([]),
		channelMix: text("channel_mix", { mode: "json" })
			.$type<Array<{ channel: string; weight: number; note?: string }>>()
			.notNull()
			.default([]),
		timelineStart: integer("timeline_start"),
		timelineEnd: integer("timeline_end"),
		kpi: text("kpi").notNull().default(""),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => ({
		uniqueCampaign: uniqueIndex("uq_campaign_plans_campaign").on(t.campaignId),
	}),
);

export const campaignCalendarItems = sqliteTable(
	"campaign_calendar_items",
	{
		id: text("id").primaryKey(),
		planId: text("plan_id")
			.notNull()
			.references(() => campaignPlans.id),
		campaignId: text("campaign_id")
			.notNull()
			.references(() => campaigns.id),
		clientSlug: text("client_slug")
			.notNull()
			.references(() => clients.slug),
		channel: text("channel", {
			enum: ["linkedin", "email", "blog", "landing", "ad", "other"],
		}).notNull(),
		deliverableType: text("deliverable_type", {
			enum: ["social_post", "email", "blog_post", "ad_copy", "content_brief_seo", "seo_report"],
		}),
		targetDate: integer("target_date").notNull(),
		intent: text("intent").notNull().default(""),
		keyMessageRef: text("key_message_ref"),
		status: text("status", {
			enum: ["planned", "brief_created", "delivered", "cancelled"],
		})
			.notNull()
			.default("planned"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => ({
		byPlanStatus: index("idx_calendar_plan_status").on(t.planId, t.status, t.targetDate),
		byCampaign: index("idx_calendar_campaign").on(t.campaignId, t.targetDate),
	}),
);

export const chatThreads = sqliteTable("chat_threads", {
	id: text("id").primaryKey(),
	clientSlug: text("client_slug")
		.notNull()
		.references(() => clients.slug),
	campaignId: text("campaign_id").references(() => campaigns.id),
	title: text("title"),
	archivedAt: integer("archived_at"),
});

export const messages = sqliteTable(
	"messages",
	{
		id: text("id").primaryKey(),
		threadId: text("thread_id").references(() => chatThreads.id),
		// No FK: chat threads outlive specialist sessions; human-side messages have no session row.
		agentSessionId: text("agent_session_id"),
		sender: text("sender").notNull(),
		type: text("type", {
			enum: [
				"chat",
				"brief_proposal",
				"memory_proposal",
				"plan_proposal",
				"plan_update_proposal",
				"calendar_item_proposal",
				"tool_call",
				"tool_result",
				"system",
			],
		}).notNull(),
		contentJson: text("content_json").notNull(),
		ts: integer("ts").notNull(),
	},
	(t) => ({
		byThread: index("idx_messages_thread").on(t.threadId, t.ts),
	}),
);

export const briefs = sqliteTable("briefs", {
	id: text("id").primaryKey(),
	clientSlug: text("client_slug")
		.notNull()
		.references(() => clients.slug),
	sourceThreadId: text("source_thread_id").references(() => chatThreads.id),
	campaignId: text("campaign_id").references(() => campaigns.id),
	calendarItemId: text("calendar_item_id").references(() => campaignCalendarItems.id),
	contentMd: text("content_md").notNull(),
	status: text("status", { enum: ["draft", "dispatched", "done"] }).notNull(),
	createdAt: integer("created_at").notNull(),
	dispatchedAt: integer("dispatched_at"),
	parentDeliverableId: text("parent_deliverable_id"),
});

export const delegations = sqliteTable(
	"delegations",
	{
		id: text("id").primaryKey(),
		briefId: text("brief_id")
			.notNull()
			.references(() => briefs.id),
		clientSlug: text("client_slug")
			.notNull()
			.references(() => clients.slug),
		campaignId: text("campaign_id").references(() => campaigns.id),
		fromAgent: text("from_agent").notNull(),
		toAgent: text("to_agent", {
			enum: ["copywriter", "social-manager", "paid-specialist", "email-marketer", "seo-specialist"],
		}).notNull(),
		payloadJson: text("payload_json").notNull(),
		status: text("status", { enum: ["requested", "in_progress", "complete", "failed"] }).notNull(),
		requestedAt: integer("requested_at").notNull(),
		completedAt: integer("completed_at"),
	},
	(t) => ({
		byBrief: index("idx_delegations_brief").on(t.briefId, t.status),
		byTarget: index("idx_delegations_target").on(t.toAgent, t.status),
	}),
);

export const deliverables = sqliteTable(
	"deliverables",
	{
		id: text("id").primaryKey(),
		delegationId: text("delegation_id")
			.notNull()
			.references(() => delegations.id),
		clientSlug: text("client_slug")
			.notNull()
			.references(() => clients.slug),
		campaignId: text("campaign_id").references(() => campaigns.id),
		type: text("type", {
			enum: ["social_post", "email", "blog_post", "ad_copy", "content_brief_seo", "seo_report"],
		}).notNull(),
		title: text("title"),
		status: text("status", { enum: ["drafting", "awaiting_approval", "shipped", "archived"] }).notNull(),
		currentRevisionId: text("current_revision_id"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => ({
		byClientStatus: index("idx_deliverables_client_status").on(t.clientSlug, t.status, t.updatedAt),
	}),
);

export const deliverableRevisions = sqliteTable(
	"deliverable_revisions",
	{
		id: text("id").primaryKey(),
		deliverableId: text("deliverable_id")
			.notNull()
			.references(() => deliverables.id),
		revisionNo: integer("revision_no").notNull(),
		artifactPath: text("artifact_path").notNull(),
		createdByAgent: text("created_by_agent").notNull(),
		feedbackNote: text("feedback_note"),
		ts: integer("ts").notNull(),
	},
	(t) => ({
		unique: uniqueIndex("uq_deliverable_revision").on(t.deliverableId, t.revisionNo),
	}),
);

export const approvals = sqliteTable("approvals", {
	id: text("id").primaryKey(),
	deliverableId: text("deliverable_id")
		.notNull()
		.references(() => deliverables.id),
	revisionId: text("revision_id")
		.notNull()
		.references(() => deliverableRevisions.id),
	decision: text("decision", { enum: ["approved", "requested_changes", "discarded"] }).notNull(),
	note: text("note"),
	decidedAt: integer("decided_at").notNull(),
});

export const agentSessions = sqliteTable(
	"agent_sessions",
	{
		id: text("id").primaryKey(),
		clientSlug: text("client_slug")
			.notNull()
			.references(() => clients.slug),
		agentSlug: text("agent_slug").notNull(),
		lifecycle: text("lifecycle", { enum: ["warm", "transient"] }).notNull(),
		parentDelegationId: text("parent_delegation_id").references(() => delegations.id),
		startedAt: integer("started_at").notNull(),
		endedAt: integer("ended_at"),
	},
	(t) => ({
		alive: index("idx_sessions_alive").on(t.endedAt),
	}),
);

export const turns = sqliteTable("turns", {
	id: text("id").primaryKey(),
	sessionId: text("session_id")
		.notNull()
		.references(() => agentSessions.id),
	model: text("model").notNull(),
	promptTokens: integer("prompt_tokens"),
	completionTokens: integer("completion_tokens"),
	latencyMs: integer("latency_ms"),
	startedAt: integer("started_at").notNull(),
	endedAt: integer("ended_at"),
});

export const events = sqliteTable(
	"events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		ts: integer("ts").notNull(),
		clientSlug: text("client_slug").references(() => clients.slug),
		agentSlug: text("agent_slug"),
		sessionId: text("session_id").references(() => agentSessions.id),
		turnId: text("turn_id").references(() => turns.id),
		type: text("type").notNull(),
		payloadJson: text("payload_json").notNull(),
	},
	(t) => ({
		byTs: index("idx_events_ts").on(t.ts),
		byClientTs: index("idx_events_client_ts").on(t.clientSlug, t.ts),
	}),
);

export const memoryProposals = sqliteTable(
	"memory_proposals",
	{
		id: text("id").primaryKey(),
		clientSlug: text("client_slug")
			.notNull()
			.references(() => clients.slug),
		file: text("file").notNull(),
		prevContentHash: text("prev_content_hash"),
		newContent: text("new_content").notNull(),
		agentSessionId: text("agent_session_id").references(() => agentSessions.id),
		reason: text("reason"),
		status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
		createdAt: integer("created_at").notNull(),
		decidedAt: integer("decided_at"),
	},
	(t) => ({
		byStatus: index("idx_proposals_status").on(t.clientSlug, t.status, t.createdAt),
	}),
);

export const memoryAudit = sqliteTable(
	"memory_audit",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		clientSlug: text("client_slug")
			.notNull()
			.references(() => clients.slug),
		file: text("file").notNull(),
		source: text("source").notNull(),
		prevContentHash: text("prev_content_hash"),
		newContentHash: text("new_content_hash").notNull(),
		ts: integer("ts").notNull(),
	},
	(t) => ({
		byFile: index("idx_audit_file_ts").on(t.clientSlug, t.file, t.ts),
	}),
);

export const deliverableReviews = sqliteTable(
	"deliverable_reviews",
	{
		id: text("id").primaryKey(),
		deliverableId: text("deliverable_id")
			.notNull()
			.references(() => deliverables.id),
		reviewerRole: text("reviewer_role").notNull(),
		score: integer("score").notNull(),
		comments: text("comments").notNull(),
		suggestions: text("suggestions").notNull(),
		summary: text("summary").notNull(),
		createdAt: integer("created_at").notNull(),
	},
	(t) => ({
		byDeliverable: index("idx_reviews_deliverable").on(t.deliverableId),
	}),
);
