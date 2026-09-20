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
CREATE TABLE `leave_request` (
	`member_id` text PRIMARY KEY NOT NULL,
	`purge_at` integer NOT NULL,
	`requested_at` integer NOT NULL,
	`restored_at` integer,
	CONSTRAINT `fk_leave_request_member_id_withdrawn_member_member_id_fk` FOREIGN KEY (`member_id`) REFERENCES `withdrawn_member`(`member_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `leave_request_purge_at_idx` ON `leave_request` (`purge_at`);
