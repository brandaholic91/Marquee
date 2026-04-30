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
CREATE INDEX `idx_reviews_deliverable` ON `deliverable_reviews` (`deliverable_id`);
