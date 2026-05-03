CREATE TABLE `campaign_calendar_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`client_slug` text NOT NULL,
	`channel` text NOT NULL,
	`deliverable_type` text,
	`target_date` integer NOT NULL,
	`intent` text DEFAULT '' NOT NULL,
	`key_message_ref` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`start_time` text DEFAULT '09:00' NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `campaign_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_plan_status` ON `campaign_calendar_items` (`plan_id`,`status`,`target_date`);--> statement-breakpoint
CREATE INDEX `idx_calendar_campaign` ON `campaign_calendar_items` (`campaign_id`,`target_date`);--> statement-breakpoint
CREATE TABLE `campaign_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`client_slug` text NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`goal_type` text DEFAULT 'other' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`key_messages` text DEFAULT '[]' NOT NULL,
	`channel_mix` text DEFAULT '[]' NOT NULL,
	`timeline_start` integer,
	`timeline_end` integer,
	`kpi` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_campaign_plans_campaign` ON `campaign_plans` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`client_slug` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_campaigns_client` ON `campaigns` (`client_slug`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_campaigns_client_title` ON `campaigns` (`client_slug`,`title`);--> statement-breakpoint
CREATE TABLE `deliverable_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`deliverable_id` text NOT NULL,
	`reviewer_role` text NOT NULL,
	`score` integer NOT NULL,
	`comments` text NOT NULL,
	`suggestions` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_deliverable` ON `deliverable_reviews` (`deliverable_id`);--> statement-breakpoint
CREATE TABLE `wiki_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`client_slug` text NOT NULL,
	`wiki_page` text NOT NULL,
	`new_content` text NOT NULL,
	`reason` text NOT NULL,
	`agent_session_id` text,
	`created_at` integer NOT NULL,
	`approved_at` integer,
	`rejected_at` integer,
	`approved_by` text,
	`rejection_reason` text,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_wiki_proposals_client_slug` ON `wiki_proposals` (`client_slug`);--> statement-breakpoint
CREATE INDEX `idx_wiki_proposals_created_at` ON `wiki_proposals` (`created_at`);--> statement-breakpoint
ALTER TABLE `briefs` ADD `campaign_id` text REFERENCES campaigns(id);--> statement-breakpoint
ALTER TABLE `briefs` ADD `calendar_item_id` text REFERENCES campaign_calendar_items(id);--> statement-breakpoint
ALTER TABLE `briefs` ADD `parent_deliverable_id` text;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `campaign_id` text REFERENCES campaigns(id);--> statement-breakpoint
ALTER TABLE `delegations` ADD `campaign_id` text REFERENCES campaigns(id);--> statement-breakpoint
ALTER TABLE `deliverables` ADD `campaign_id` text REFERENCES campaigns(id);--> statement-breakpoint
ALTER TABLE `deliverables` ADD `title` text;