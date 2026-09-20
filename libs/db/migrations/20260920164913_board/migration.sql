CREATE TABLE `board_post` (
	`author_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	CONSTRAINT `fk_board_post_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_board_post_thread_id_board_thread_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `board_thread`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `board_thread` (
	`author_id` text,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_posted_at` integer NOT NULL,
	`post_count` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	CONSTRAINT `fk_board_thread_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `board_post_thread_id_idx` ON `board_post` (`thread_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `board_thread_last_posted_at_idx` ON `board_thread` (`last_posted_at`,`id`);