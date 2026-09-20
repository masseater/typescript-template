CREATE TABLE `inquiry` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`member_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`subject` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_inquiry_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "inquiry_status" CHECK("status" IN ('open', 'answered', 'closed'))
);
--> statement-breakpoint
CREATE TABLE `inquiry_message` (
	`author_id` text NOT NULL,
	`author_kind` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`inquiry_id` text NOT NULL,
	CONSTRAINT `fk_inquiry_message_inquiry_id_inquiry_id_fk` FOREIGN KEY (`inquiry_id`) REFERENCES `inquiry`(`id`) ON DELETE CASCADE,
	CONSTRAINT "inquiry_message_author_kind" CHECK("author_kind" IN ('member', 'admin'))
);
--> statement-breakpoint
CREATE INDEX `inquiry_member_id_idx` ON `inquiry` (`member_id`);--> statement-breakpoint
CREATE INDEX `inquiry_status_idx` ON `inquiry` (`status`);--> statement-breakpoint
CREATE INDEX `inquiry_updated_at_idx` ON `inquiry` (`updated_at`);--> statement-breakpoint
CREATE INDEX `inquiry_message_inquiry_id_idx` ON `inquiry_message` (`inquiry_id`);