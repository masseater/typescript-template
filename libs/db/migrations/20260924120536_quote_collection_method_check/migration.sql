PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_customer_quote` (
	`amount_total` integer NOT NULL,
	`collection_method` text NOT NULL,
	`currency` text NOT NULL,
	`days_until_due` integer,
	`expires_at` integer NOT NULL,
	`member_id` text NOT NULL,
	`status` text NOT NULL,
	`stripe_quote_id` text PRIMARY KEY NOT NULL,
	`stripe_subscription_id` text,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_customer_quote_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "customer_quote_collection_method" CHECK("collection_method" IN ('charge_automatically', 'send_invoice'))
);
--> statement-breakpoint
INSERT INTO `__new_customer_quote`(`amount_total`, `collection_method`, `currency`, `days_until_due`, `expires_at`, `member_id`, `status`, `stripe_quote_id`, `stripe_subscription_id`, `updated_at`) SELECT `amount_total`, `collection_method`, `currency`, `days_until_due`, `expires_at`, `member_id`, `status`, `stripe_quote_id`, `stripe_subscription_id`, `updated_at` FROM `customer_quote`;--> statement-breakpoint
DROP TABLE `customer_quote`;--> statement-breakpoint
ALTER TABLE `__new_customer_quote` RENAME TO `customer_quote`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `customer_quote_member_id_idx` ON `customer_quote` (`member_id`);