CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL DEFAULT 'active',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `briefs` ADD `campaign_id` text REFERENCES campaigns(id);
--> statement-breakpoint
ALTER TABLE `delegations` ADD `campaign_id` text REFERENCES campaigns(id);
--> statement-breakpoint
ALTER TABLE `deliverables` ADD `campaign_id` text REFERENCES campaigns(id);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `campaign_id` text REFERENCES campaigns(id);
--> statement-breakpoint
ALTER TABLE `memory_proposals` ADD `campaign_id` text REFERENCES campaigns(id);
