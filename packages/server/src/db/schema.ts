import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const ts = (col: string) =>
	integer(col, { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date());

export const chatThreads = sqliteTable("chat_threads", {
	id: text("id").primaryKey(),
	type: text("type", { enum: ["intake", "dispatched", "consultative"] }).notNull(),
	title: text("title").notNull(),
	createdAt: ts("created_at"),
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
});

export const chatParticipants = sqliteTable("chat_participants", {
	threadId: text("thread_id")
		.notNull()
		.references(() => chatThreads.id),
	agentSlug: text("agent_slug").notNull(), // 'human' is one
});

export const messages = sqliteTable(
	"messages",
	{
		id: text("id").primaryKey(),
		threadId: text("thread_id").references(() => chatThreads.id),
		agentSessionId: text("agent_session_id"),
		sender: text("sender").notNull(), // agent slug or 'human'
		type: text("type", {
			enum: [
				"chat",
				"delegation_req",
				"delegation_resp",
				"brief_proposal",
				"memory_proposal",
				"eval_report",
				"tool_call",
				"tool_result",
				"approval_decision",
				"human_brief",
			],
		}).notNull(),
		contentJson: text("content_json", { mode: "json" }).notNull(),
		createdAt: ts("created_at"),
	},
	(t) => ({
		threadIdx: index("messages_thread_idx").on(t.threadId, t.createdAt),
		sessionIdx: index("messages_session_idx").on(t.agentSessionId, t.createdAt),
	}),
);

export const briefs = sqliteTable("briefs", {
	id: text("id").primaryKey(),
	sourceThreadId: text("source_thread_id").references(() => chatThreads.id),
	status: text("status", { enum: ["draft", "dispatched", "done"] }).notNull(),
	contentMd: text("content_md").notNull(),
	createdAt: ts("created_at"),
	dispatchedAt: integer("dispatched_at", { mode: "timestamp_ms" }),
});

export const delegations = sqliteTable(
	"delegations",
	{
		id: text("id").primaryKey(),
		briefId: text("brief_id").references(() => briefs.id),
		parentDelegationId: text("parent_delegation_id"),
		fromAgent: text("from_agent").notNull(),
		toAgent: text("to_agent").notNull(),
		status: text("status", { enum: ["requested", "in_progress", "complete", "blocked"] }).notNull(),
		payloadJson: text("payload_json", { mode: "json" }).notNull(),
		requestedAt: ts("requested_at"),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
	},
	(t) => ({
		parentIdx: index("delegations_parent_idx").on(t.parentDelegationId, t.status),
		statusIdx: index("delegations_status_idx").on(t.status),
	}),
);

export const deliverables = sqliteTable(
	"deliverables",
	{
		id: text("id").primaryKey(),
		delegationId: text("delegation_id")
			.notNull()
			.references(() => delegations.id),
		type: text("type").notNull(), // 'blog_post' for v0.1
		title: text("title").notNull(),
		status: text("status", {
			enum: ["drafting", "awaiting_eval", "awaiting_approval", "shipped", "archived"],
		}).notNull(),
		currentRevisionId: text("current_revision_id"),
		sourceDeliverableId: text("source_deliverable_id").references(() => deliverables.id),
		createdAt: ts("created_at"),
		updatedAt: ts("updated_at"),
	},
	(t) => ({
		statusIdx: index("deliverables_status_idx").on(t.status),
	}),
);

export const deliverableRevisions = sqliteTable("deliverable_revisions", {
	id: text("id").primaryKey(),
	deliverableId: text("deliverable_id")
		.notNull()
		.references(() => deliverables.id),
	artifactPath: text("artifact_path").notNull(), // ~/.marquee/artifacts/<id>/rev_NNN.md
	createdByAgent: text("created_by_agent").notNull(),
	createdAt: ts("created_at"),
});

export const evals = sqliteTable("evals", {
	id: text("id").primaryKey(),
	revisionId: text("revision_id")
		.notNull()
		.references(() => deliverableRevisions.id),
	scoresJson: text("scores_json", { mode: "json" }).notNull(), // { brand_voice, factual_accuracy, usp_usage }
	summaryMd: text("summary_md").notNull(),
	createdAt: ts("created_at"),
});

export const approvals = sqliteTable("approvals", {
	id: text("id").primaryKey(),
	deliverableId: text("deliverable_id")
		.notNull()
		.references(() => deliverables.id),
	decision: text("decision", { enum: ["approved", "rejected", "requested_changes"] }).notNull(),
	note: text("note"),
	decidedAt: ts("decided_at"),
});

export const agentSessions = sqliteTable(
	"agent_sessions",
	{
		id: text("id").primaryKey(),
		agentSlug: text("agent_slug").notNull(),
		lifecycle: text("lifecycle", { enum: ["warm", "transient"] }).notNull(),
		parentDelegationId: text("parent_delegation_id").references(() => delegations.id),
		startedAt: ts("started_at"),
		endedAt: integer("ended_at", { mode: "timestamp_ms" }),
	},
	(t) => ({
		activeIdx: index("sessions_active_idx").on(t.endedAt),
	}),
);

export const turns = sqliteTable(
	"turns",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => agentSessions.id),
		model: text("model").notNull(),
		promptTokens: integer("prompt_tokens").notNull(),
		completionTokens: integer("completion_tokens").notNull(),
		costUsd: integer("cost_usd_cents").notNull(), // store in cents to avoid float
		latencyMs: integer("latency_ms").notNull(),
		startedAt: ts("started_at"),
		endedAt: integer("ended_at", { mode: "timestamp_ms" }),
	},
	(t) => ({
		sessionIdx: index("turns_session_idx").on(t.sessionId, t.startedAt),
	}),
);

export const events = sqliteTable(
	"events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		ts: ts("ts"),
		agentSlug: text("agent_slug"),
		sessionId: text("session_id"),
		turnId: text("turn_id"),
		type: text("type").notNull(),
		payloadJson: text("payload_json", { mode: "json" }).notNull(),
	},
	(t) => ({
		tsIdx: index("events_ts_idx").on(t.ts),
	}),
);

export const memoryProposals = sqliteTable("memory_proposals", {
	id: text("id").primaryKey(),
	agentSessionId: text("agent_session_id"),
	file: text("file").notNull(),
	patch: text("patch").notNull(),
	status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
	createdAt: ts("created_at"),
});

export const tasks = sqliteTable(
	"tasks",
	{
		id: text("id").primaryKey(),
		delegationId: text("delegation_id").notNull().references(() => delegations.id),
		title: text("title").notNull(),
		descriptionMd: text("description_md").notNull().default(""),
		status: text("status", { enum: ["open", "in_progress", "done", "blocked"] }).notNull(),
		assignedTo: text("assigned_to").notNull(),
		version: integer("version").notNull().default(1),
		createdAt: ts("created_at"),
		updatedAt: ts("updated_at"),
	},
	(t) => ({
		assignedStatusIdx: index("tasks_assigned_status_idx").on(t.assignedTo, t.status),
	}),
);

export const taskPendingUpdates = sqliteTable("task_pending_updates", {
	id: text("id").primaryKey(),
	taskId: text("task_id").notNull().references(() => tasks.id),
	message: text("message").notNull(),
	deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
	createdAt: ts("created_at"),
});
