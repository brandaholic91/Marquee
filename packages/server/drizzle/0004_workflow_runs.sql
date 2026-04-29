CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`brief_id` text NOT NULL,
	`campaign_id` text,
	`workflow_id` text NOT NULL,
	`current_step_id` text NOT NULL,
	`state_json` text NOT NULL DEFAULT '{}',
	`status` text NOT NULL DEFAULT 'running',
	`active_delegation_id` text,
	`retry_count` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
