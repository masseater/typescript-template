CREATE TABLE `conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`direct_key` text,
	`kind` text NOT NULL,
	`last_message_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation_participant` (
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
CREATE UNIQUE INDEX `conversation_direct_key_unique` ON `conversation` (`direct_key`);--> statement-breakpoint
CREATE INDEX `conversation_last_message_at_idx` ON `conversation` (`last_message_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_participant_unique` ON `conversation_participant` (`conversation_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `conversation_participant_member_idx` ON `conversation_participant` (`member_id`,`conversation_id`);--> statement-breakpoint
CREATE INDEX `direct_message_conversation_idx` ON `direct_message` (`conversation_id`,`created_at`,`id`);