CREATE TABLE `follow` (
	`created_at` integer NOT NULL,
	`followee_id` text NOT NULL,
	`follower_id` text NOT NULL,
	CONSTRAINT `follow_pk` PRIMARY KEY(`follower_id`, `followee_id`),
	CONSTRAINT `fk_follow_followee_id_user_id_fk` FOREIGN KEY (`followee_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_follow_follower_id_user_id_fk` FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `member_onboarding` (
	`step` text DEFAULT 'agreement' NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text PRIMARY KEY NOT NULL,
	CONSTRAINT `fk_member_onboarding_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "member_onboarding_step" CHECK("step" IN ('agreement', 'choose', 'profile', 'interview', 'done'))
);
--> statement-breakpoint
CREATE INDEX `follow_followee_id_idx` ON `follow` (`followee_id`);
--> statement-breakpoint
INSERT INTO `member_onboarding` (`user_id`, `step`, `updated_at`)
SELECT `id`, 'done', `updated_at` FROM `user` WHERE `role` = 'member';
