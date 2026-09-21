CREATE TABLE `notification` (
	`actor_id` text,
	`actor_name` text,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`member_id` text NOT NULL,
	`read_at` integer,
	`subject_id` text NOT NULL,
	`title` text,
	CONSTRAINT `fk_notification_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_notification_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `notification_preference` (
	`board_mail` integer DEFAULT false NOT NULL,
	`member_id` text PRIMARY KEY NOT NULL,
	`message_mail` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_notification_preference_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `notification_member_id_idx` ON `notification` (`member_id`,`created_at`,`id`);