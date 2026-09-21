PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agreement_version` (
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`published_at` integer,
	`published_by` text,
	`summary` text,
	`version` text NOT NULL,
	CONSTRAINT `fk_agreement_version_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_agreement_version_published_by_user_id_fk` FOREIGN KEY (`published_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "agreement_version_kind" CHECK("kind" IN ('terms', 'privacy', 'interview_history'))
);
--> statement-breakpoint
INSERT INTO `__new_agreement_version`(`body`, `created_at`, `created_by`, `id`, `kind`, `published_at`, `published_by`, `summary`, `version`) SELECT `body`, `created_at`, `created_by`, `id`, `kind`, `published_at`, `published_by`, `summary`, `version` FROM `agreement_version`;--> statement-breakpoint
DROP TABLE `agreement_version`;--> statement-breakpoint
ALTER TABLE `__new_agreement_version` RENAME TO `agreement_version`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `agreement_version_version_unique` ON `agreement_version` (`version`);--> statement-breakpoint
CREATE INDEX `agreement_version_kind_published_at_idx` ON `agreement_version` (`kind`,`published_at`);
--> statement-breakpoint
INSERT INTO `agreement_version` (`id`, `kind`, `version`, `body`, `summary`, `created_at`, `published_at`)
VALUES
	('agreement-interview-history-1', 'interview_history', 'interview-history-1', '# AI インタビューの履歴の利用

会話の履歴を残す場合、次からのレコメンドのために利用します。

1. 履歴は会員本人だけが閲覧できます。
2. 管理者と社内の利用者は、同意の有無にかかわらず会話の中身を見られません。
3. 同意は設定からいつでも取り消せます。取り消したときは履歴を消します。', NULL, 1789862400000, 1789862400000);
