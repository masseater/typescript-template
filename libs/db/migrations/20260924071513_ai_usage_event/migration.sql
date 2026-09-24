CREATE TABLE `ai_usage_event` (
	`identifier` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`quantity` integer NOT NULL,
	`reported_at` integer,
	CONSTRAINT `fk_ai_usage_event_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `ai_usage_event_member_occurred_idx` ON `ai_usage_event` (`member_id`,`occurred_at`);