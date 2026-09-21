CREATE TABLE `member_block` (
	`blocked_id` text NOT NULL,
	`blocker_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `member_block_pk` PRIMARY KEY(`blocker_id`, `blocked_id`),
	CONSTRAINT `fk_member_block_blocked_id_user_id_fk` FOREIGN KEY (`blocked_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_member_block_blocker_id_user_id_fk` FOREIGN KEY (`blocker_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `member_report` (
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`reporter_id` text,
	`status` text NOT NULL,
	`subject_id` text NOT NULL,
	`subject_kind` text NOT NULL,
	`target_member_id` text,
	CONSTRAINT `fk_member_report_reporter_id_user_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_member_report_target_member_id_user_id_fk` FOREIGN KEY (`target_member_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `moderation_action` (
	`actor_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`report_id` text NOT NULL,
	`target_member_id` text,
	CONSTRAINT `fk_moderation_action_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_moderation_action_report_id_member_report_id_fk` FOREIGN KEY (`report_id`) REFERENCES `member_report`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_moderation_action_target_member_id_user_id_fk` FOREIGN KEY (`target_member_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
ALTER TABLE `user` ADD `suspended` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `member_block_blocked_idx` ON `member_block` (`blocked_id`);--> statement-breakpoint
CREATE INDEX `member_report_status_idx` ON `member_report` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_report_subject_unique` ON `member_report` (`reporter_id`,`subject_kind`,`subject_id`);--> statement-breakpoint
CREATE INDEX `moderation_action_report_idx` ON `moderation_action` (`report_id`,`created_at`);