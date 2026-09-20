ALTER TABLE `user` ADD `searchable` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `visibility` text DEFAULT 'all_members' NOT NULL;