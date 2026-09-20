ALTER TABLE `user` ADD `company_photo_key` text;--> statement-breakpoint
ALTER TABLE `user` ADD `face_photo_key` text;--> statement-breakpoint
ALTER TABLE `user` ADD `searchable` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `visibility` text DEFAULT 'members' NOT NULL;