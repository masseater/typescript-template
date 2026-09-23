CREATE TABLE `wiki_draft` (
	`base_revision` text,
	`markdown` text NOT NULL,
	`path` text PRIMARY KEY,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT `fk_wiki_draft_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
