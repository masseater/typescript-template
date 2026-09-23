CREATE TABLE `leave_request` (
	`member_id` text PRIMARY KEY NOT NULL,
	`purge_at` integer NOT NULL,
	`recovery_declined_at` integer,
	`requested_at` integer NOT NULL,
	`restored_at` integer,
	CONSTRAINT `fk_leave_request_member_id_withdrawn_member_member_id_fk` FOREIGN KEY (`member_id`) REFERENCES `withdrawn_member`(`member_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `withdrawn_member` (
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`member_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`profile` text NOT NULL,
	`security_version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`social_links` text NOT NULL,
	`two_factor_enabled` integer NOT NULL,
	`withdrawn_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_board_post` (
	`author_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	CONSTRAINT `fk_board_post_thread_id_board_thread_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `board_thread`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_board_post`(`author_id`, `body`, `created_at`, `id`, `thread_id`) SELECT `author_id`, `body`, `created_at`, `id`, `thread_id` FROM `board_post`;--> statement-breakpoint
DROP TABLE `board_post`;--> statement-breakpoint
ALTER TABLE `__new_board_post` RENAME TO `board_post`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_board_thread` (
	`author_id` text,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_posted_at` integer NOT NULL,
	`post_count` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_board_thread`(`author_id`, `created_at`, `id`, `last_posted_at`, `post_count`, `title`) SELECT `author_id`, `created_at`, `id`, `last_posted_at`, `post_count`, `title` FROM `board_thread`;--> statement-breakpoint
DROP TABLE `board_thread`;--> statement-breakpoint
ALTER TABLE `__new_board_thread` RENAME TO `board_thread`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `board_post_thread_id_idx` ON `board_post` (`thread_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `board_thread_last_posted_at_idx` ON `board_thread` (`last_posted_at`,`id`);--> statement-breakpoint
CREATE INDEX `leave_request_purge_at_idx` ON `leave_request` (`purge_at`);