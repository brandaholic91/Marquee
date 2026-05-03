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
CREATE INDEX `idx_wiki_proposals_client_slug` ON `wiki_proposals` (`client_slug`);
--> statement-breakpoint
CREATE INDEX `idx_wiki_proposals_created_at` ON `wiki_proposals` (`created_at`);