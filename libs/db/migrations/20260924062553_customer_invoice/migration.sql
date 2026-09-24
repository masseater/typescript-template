CREATE TABLE `customer_invoice` (
	`amount_credited` integer DEFAULT 0 NOT NULL,
	`amount_due` integer NOT NULL,
	`amount_paid` integer DEFAULT 0 NOT NULL,
	`amount_refunded` integer DEFAULT 0 NOT NULL,
	`currency` text NOT NULL,
	`hosted_invoice_url` text,
	`issued_at` integer NOT NULL,
	`member_id` text NOT NULL,
	`origin_key` text NOT NULL,
	`status` text NOT NULL,
	`stripe_invoice_id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_customer_invoice_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "customer_invoice_status" CHECK("status" IN ('draft', 'open', 'paid', 'uncollectible', 'void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_invoice_origin_key_unique` ON `customer_invoice` (`origin_key`);--> statement-breakpoint
CREATE INDEX `customer_invoice_member_id_idx` ON `customer_invoice` (`member_id`);