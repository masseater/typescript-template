CREATE TABLE `conversation` (
	`direct_key` text,
	`kind` text NOT NULL,
	`last_message_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation_participant` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`last_read_at` integer,
	`member_id` text,
	`member_name` text NOT NULL,
	CONSTRAINT `fk_conversation_participant_conversation_id_conversation_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_conversation_participant_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `direct_message` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`conversation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`sender_id` text,
	`sender_name` text NOT NULL,
	CONSTRAINT `fk_direct_message_conversation_id_conversation_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_direct_message_sender_id_user_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `group_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`group_id` text NOT NULL,
	`token` text NOT NULL,
	CONSTRAINT `fk_group_invite_group_id_member_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `member_group`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `group_membership` (
	`group_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`member_id` text NOT NULL,
	`role` text NOT NULL,
	CONSTRAINT `group_membership_pk` PRIMARY KEY(`group_id`, `member_id`),
	CONSTRAINT `fk_group_membership_group_id_member_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `member_group`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_group_membership_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `member_group` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`join_policy` text NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	CONSTRAINT `fk_member_group_conversation_id_conversation_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_member_group_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_direct_key_unique` ON `conversation` (`direct_key`);--> statement-breakpoint
CREATE INDEX `conversation_last_message_at_idx` ON `conversation` (`last_message_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_participant_unique` ON `conversation_participant` (`conversation_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `conversation_participant_member_idx` ON `conversation_participant` (`member_id`,`conversation_id`);--> statement-breakpoint
CREATE INDEX `direct_message_conversation_idx` ON `direct_message` (`conversation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_invite_token_unique` ON `group_invite` (`token`);--> statement-breakpoint
CREATE INDEX `group_membership_member_idx` ON `group_membership` (`member_id`,`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_group_conversation_id_unique` ON `member_group` (`conversation_id`);