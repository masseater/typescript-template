CREATE TABLE `group_invite` (
	`expires_at` integer NOT NULL,
	`group_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
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
	`conversation_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`join_policy` text NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	CONSTRAINT `fk_member_group_conversation_id_conversation_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_member_group_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_invite_token_unique` ON `group_invite` (`token`);--> statement-breakpoint
CREATE INDEX `group_membership_member_idx` ON `group_membership` (`member_id`,`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_group_conversation_id_unique` ON `member_group` (`conversation_id`);