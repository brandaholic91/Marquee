CREATE TABLE `campaign_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `client_slug` text NOT NULL,
  `goal` text NOT NULL DEFAULT '',
  `goal_type` text NOT NULL DEFAULT 'other',
  `audience` text NOT NULL DEFAULT '',
  `key_messages` text NOT NULL DEFAULT '[]',
  `channel_mix` text NOT NULL DEFAULT '[]',
  `timeline_start` integer,
  `timeline_end` integer,
  `kpi` text NOT NULL DEFAULT '',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`),
  FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_campaign_plans_campaign` ON `campaign_plans` (`campaign_id`);
--> statement-breakpoint

CREATE TABLE `campaign_calendar_items` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL,
  `campaign_id` text NOT NULL,
  `client_slug` text NOT NULL,
  `channel` text NOT NULL,
  `deliverable_type` text,
  `target_date` integer NOT NULL,
  `intent` text NOT NULL DEFAULT '',
  `key_message_ref` text,
  `status` text NOT NULL DEFAULT 'planned',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`plan_id`) REFERENCES `campaign_plans`(`id`),
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`),
  FOREIGN KEY (`client_slug`) REFERENCES `clients`(`slug`)
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_plan_status` ON `campaign_calendar_items` (`plan_id`, `status`, `target_date`);
--> statement-breakpoint
CREATE INDEX `idx_calendar_campaign` ON `campaign_calendar_items` (`campaign_id`, `target_date`);
--> statement-breakpoint

ALTER TABLE `briefs` ADD COLUMN `calendar_item_id` text REFERENCES `campaign_calendar_items`(`id`);
--> statement-breakpoint
ALTER TABLE `chat_threads` ADD COLUMN `campaign_id` text REFERENCES `campaigns`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_threads_campaign` ON `chat_threads` (`campaign_id`);
