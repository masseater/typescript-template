CREATE TABLE `invite` (
	`accepted_at` integer,
	`audience` text NOT NULL,
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`inviter_id` text NOT NULL,
	`permission` text NOT NULL,
	`token_hash` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `audit_event` ADD `actor_kind` text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `account_state` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `permission` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`account_state` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`id` text PRIMARY KEY,
	`image` text,
	`name` text NOT NULL,
	`permission` text,
	`profile` text DEFAULT '' NOT NULL,
	`social_links` text DEFAULT '[]' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`security_version` integer DEFAULT 0 NOT NULL,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "user_role" CHECK("role" IN ('member', 'admin', 'staff')),
	CONSTRAINT "user_account_state" CHECK("account_state" IN ('active', 'suspended')),
	CONSTRAINT "user_permission" CHECK(("role" = 'member' AND "permission" IS NULL) OR ("role" = 'admin' AND "permission" IN ('viewer', 'operator', 'owner')) OR ("role" = 'staff' AND "permission" IN ('viewer', 'editor')))
);
--> statement-breakpoint
INSERT INTO `__new_user`(`created_at`, `email`, `email_verified`, `id`, `image`, `name`, `profile`, `social_links`, `role`, `security_version`, `two_factor_enabled`, `updated_at`) SELECT `created_at`, `email`, `email_verified`, `id`, `image`, `name`, `profile`, `social_links`, `role`, `security_version`, `two_factor_enabled`, `updated_at` FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `invite_token_hash_unique` ON `invite` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invite_email_idx` ON `invite` (`audience`,`email`);