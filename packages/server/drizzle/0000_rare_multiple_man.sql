CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`client_slug` text NOT NULL,
	`agent_slug` text NOT NULL,
	`lifecycle` text NOT NULL,
	`parent_delegation_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_delegation_id`) REFERENCES `delegations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_alive` ON `agent_sessions` (`ended_at`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`deliverable_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`decision` text NOT NULL,
	`note` text,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `deliverable_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_slug` text NOT NULL,
	`source_thread_id` text,
	`content_md` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`dispatched_at` integer,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`client_slug` text NOT NULL,
	`title` text,
	`archived_at` integer,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delegations` (
	`id` text PRIMARY KEY NOT NULL,
	`brief_id` text NOT NULL,
	`client_slug` text NOT NULL,
	`from_agent` text NOT NULL,
	`to_agent` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text NOT NULL,
	`requested_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_delegations_brief` ON `delegations` (`brief_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_delegations_target` ON `delegations` (`to_agent`,`status`);--> statement-breakpoint
CREATE TABLE `deliverable_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`deliverable_id` text NOT NULL,
	`revision_no` integer NOT NULL,
	`artifact_path` text NOT NULL,
	`created_by_agent` text NOT NULL,
	`feedback_note` text,
	`ts` integer NOT NULL,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_deliverable_revision` ON `deliverable_revisions` (`deliverable_id`,`revision_no`);--> statement-breakpoint
CREATE TABLE `deliverables` (
	`id` text PRIMARY KEY NOT NULL,
	`delegation_id` text NOT NULL,
	`client_slug` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`current_revision_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`delegation_id`) REFERENCES `delegations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_deliverables_client_status` ON `deliverables` (`client_slug`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`client_slug` text,
	`agent_slug` text,
	`session_id` text,
	`turn_id` text,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_ts` ON `events` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_events_client_ts` ON `events` (`client_slug`,`ts`);--> statement-breakpoint
CREATE TABLE `memory_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_slug` text NOT NULL,
	`file` text NOT NULL,
	`source` text NOT NULL,
	`prev_content_hash` text,
	`new_content_hash` text NOT NULL,
	`ts` integer NOT NULL,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_file_ts` ON `memory_audit` (`client_slug`,`file`,`ts`);--> statement-breakpoint
CREATE TABLE `memory_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`client_slug` text NOT NULL,
	`file` text NOT NULL,
	`prev_content_hash` text,
	`new_content` text NOT NULL,
	`agent_session_id` text,
	`reason` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_proposals_status` ON `memory_proposals` (`client_slug`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text,
	`agent_session_id` text,
	`sender` text NOT NULL,
	`type` text NOT NULL,
	`content_json` text NOT NULL,
	`ts` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_thread` ON `messages` (`thread_id`,`ts`);--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`model` text NOT NULL,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`latency_ms` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
