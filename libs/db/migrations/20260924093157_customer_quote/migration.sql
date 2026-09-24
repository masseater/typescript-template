CREATE TABLE `customer_quote` (
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
	CONSTRAINT `fk_customer_quote_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `customer_quote_member_id_idx` ON `customer_quote` (`member_id`);