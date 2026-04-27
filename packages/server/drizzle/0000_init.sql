CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_slug` text NOT NULL,
	`lifecycle` text NOT NULL,
	`parent_delegation_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`parent_delegation_id`) REFERENCES `delegations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_active_idx` ON `agent_sessions` (`ended_at`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`deliverable_id` text NOT NULL,
	`decision` text NOT NULL,
	`note` text,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_thread_id` text,
	`status` text NOT NULL,
	`content_md` text NOT NULL,
	`created_at` integer NOT NULL,
	`dispatched_at` integer,
	FOREIGN KEY (`source_thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_participants` (
	`thread_id` text NOT NULL,
	`agent_slug` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `delegations` (
	`id` text PRIMARY KEY NOT NULL,
	`brief_id` text,
	`parent_delegation_id` text,
	`from_agent` text NOT NULL,
	`to_agent` text NOT NULL,
	`status` text NOT NULL,
	`payload_json` text NOT NULL,
	`requested_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `delegations_parent_idx` ON `delegations` (`parent_delegation_id`,`status`);--> statement-breakpoint
CREATE INDEX `delegations_status_idx` ON `delegations` (`status`);--> statement-breakpoint
CREATE TABLE `deliverable_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`deliverable_id` text NOT NULL,
	`artifact_path` text NOT NULL,
	`created_by_agent` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deliverables` (
	`id` text PRIMARY KEY NOT NULL,
	`delegation_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`current_revision_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`delegation_id`) REFERENCES `delegations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deliverables_status_idx` ON `deliverables` (`status`);--> statement-breakpoint
CREATE TABLE `evals` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`scores_json` text NOT NULL,
	`summary_md` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `deliverable_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`agent_slug` text,
	`session_id` text,
	`turn_id` text,
	`type` text NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_ts_idx` ON `events` (`ts`);--> statement-breakpoint
CREATE TABLE `memory_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_session_id` text,
	`file` text NOT NULL,
	`patch` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text,
	`agent_session_id` text,
	`sender` text NOT NULL,
	`type` text NOT NULL,
	`content_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_thread_idx` ON `messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_session_idx` ON `messages` (`agent_session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`model` text NOT NULL,
	`prompt_tokens` integer NOT NULL,
	`completion_tokens` integer NOT NULL,
	`cost_usd_cents` integer NOT NULL,
	`latency_ms` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `turns_session_idx` ON `turns` (`session_id`,`started_at`);