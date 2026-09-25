PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_plan_subscription` (
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`current_period_end` integer NOT NULL,
	`member_id` text PRIMARY KEY,
	`status` text NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_plan_subscription_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "plan_subscription_status" CHECK("status" IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'paused', 'trialing', 'unpaid'))
);
--> statement-breakpoint
INSERT INTO `__new_plan_subscription`(`cancel_at_period_end`, `current_period_end`, `member_id`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `updated_at`) SELECT `cancel_at_period_end`, `current_period_end`, `member_id`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `updated_at` FROM `plan_subscription`;--> statement-breakpoint
DROP TABLE `plan_subscription`;--> statement-breakpoint
ALTER TABLE `__new_plan_subscription` RENAME TO `plan_subscription`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `plan_subscription_stripe_customer_id_unique` ON `plan_subscription` (`stripe_customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_subscription_stripe_subscription_id_unique` ON `plan_subscription` (`stripe_subscription_id`);