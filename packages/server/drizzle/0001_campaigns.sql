CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`client_slug` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL DEFAULT 'active',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_campaigns_client` ON `campaigns` (`client_slug`,`status`);
--> statement-breakpoint
ALTER TABLE `briefs` ADD COLUMN `campaign_id` text REFERENCES `campaigns`(`id`);
--> statement-breakpoint
ALTER TABLE `delegations` ADD COLUMN `campaign_id` text REFERENCES `campaigns`(`id`);
--> statement-breakpoint
ALTER TABLE `deliverables` ADD COLUMN `campaign_id` text REFERENCES `campaigns`(`id`);
