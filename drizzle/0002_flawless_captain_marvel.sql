CREATE TABLE `risk_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `risk_runs_workspace_created` ON `risk_runs` (`workspace_id`,`created_at`);