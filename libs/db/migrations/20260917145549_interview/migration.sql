CREATE TABLE `interview` (
	`day` text NOT NULL,
	`saved_sheet` text,
	`state` text NOT NULL,
	`turns` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
