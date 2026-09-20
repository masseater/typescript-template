CREATE TABLE `apikey` (
	`config_id` text DEFAULT 'default' NOT NULL,
	`created_at` integer NOT NULL,
	`enabled` integer DEFAULT true,
	`expires_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`last_refill_at` integer,
	`last_request` integer,
	`metadata` text,
	`name` text,
	`permissions` text,
	`prefix` text,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_max` integer DEFAULT 60,
	`rate_limit_time_window` integer DEFAULT 60000,
	`reference_id` text NOT NULL,
	`refill_amount` integer,
	`refill_interval` integer,
	`remaining` integer,
	`request_count` integer DEFAULT 0,
	`start` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `apikey_config_id_idx` ON `apikey` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
CREATE INDEX `apikey_reference_id_idx` ON `apikey` (`reference_id`);