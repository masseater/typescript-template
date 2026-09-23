CREATE TABLE `plan_subscription` (
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`current_period_end` integer,
	`member_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_plan_subscription_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "plan_subscription_status" CHECK("status" IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'paused', 'trialing', 'unpaid'))
);
--> statement-breakpoint
CREATE TABLE `stripe_event` (
	`id` text PRIMARY KEY NOT NULL,
	`received_at` integer NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_subscription_stripe_customer_id_unique` ON `plan_subscription` (`stripe_customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_subscription_stripe_subscription_id_unique` ON `plan_subscription` (`stripe_subscription_id`);