CREATE TABLE `queue_runner` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_started_at` text,
	`last_completed_at` text,
	`last_result` text
);
