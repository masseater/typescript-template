CREATE TABLE `agreement_acceptance` (
	`accepted_at` integer NOT NULL,
	`user_id` text NOT NULL,
	`version_id` text NOT NULL,
	CONSTRAINT `agreement_acceptance_pk` PRIMARY KEY(`user_id`, `version_id`),
	CONSTRAINT `fk_agreement_acceptance_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_agreement_acceptance_version_id_agreement_version_id_fk` FOREIGN KEY (`version_id`) REFERENCES `agreement_version`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `agreement_version` (
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
	CONSTRAINT "agreement_version_kind" CHECK("kind" IN ('terms', 'privacy'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agreement_version_version_unique` ON `agreement_version` (`version`);--> statement-breakpoint
CREATE INDEX `agreement_version_kind_published_at_idx` ON `agreement_version` (`kind`,`published_at`);
--> statement-breakpoint
INSERT INTO `agreement_version` (`id`, `kind`, `version`, `body`, `summary`, `created_at`, `published_at`)
VALUES
	('agreement-terms-1', 'terms', 'terms-1', '# 利用規約

本サービスの利用にあたっては、この利用規約に同意いただく必要があります。

1. 会員は、法令と本規約に従って本サービスを利用します。
2. 会員は、自分のアカウントを第三者に利用させません。
3. 運営者は、本規約を改定できます。改定後は、改定された規約への同意を求めます。', NULL, 1789862400000, 1789862400000),
	('agreement-privacy-1', 'privacy', 'privacy-1', '# プライバシーポリシー

運営者は、本サービスの提供に必要な範囲で会員の情報を取り扱います。

1. 取得する情報: メールアドレス、ユーザー名、プロフィール、利用状況。
2. 利用目的: 本サービスの提供、本人確認、不正利用の防止、お問い合わせへの対応。
3. 第三者提供: 法令に基づく場合を除き、会員の同意なく第三者に提供しません。', NULL, 1789862400000, 1789862400000);
