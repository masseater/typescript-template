UPDATE `session` SET `audience` = 'service-member' WHERE `audience` = 'user';--> statement-breakpoint
UPDATE `session` SET `audience` = 'service-admin' WHERE `audience` = 'admin';--> statement-breakpoint
UPDATE `session` SET `audience` = 'internal-dashboard' WHERE `audience` = 'wiki';--> statement-breakpoint
UPDATE `passkey` SET `audience` = 'service-member' WHERE `audience` = 'user';--> statement-breakpoint
UPDATE `passkey` SET `audience` = 'service-admin' WHERE `audience` = 'admin';--> statement-breakpoint
UPDATE `passkey` SET `audience` = 'internal-dashboard' WHERE `audience` = 'wiki';--> statement-breakpoint
UPDATE `verification` SET `audience` = 'service-member' WHERE `audience` = 'user';--> statement-breakpoint
UPDATE `verification` SET `audience` = 'service-admin' WHERE `audience` = 'admin';--> statement-breakpoint
UPDATE `verification` SET `audience` = 'internal-dashboard' WHERE `audience` = 'wiki';--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_keep_last_admin_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_keep_last_admin_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_role_revoke_sessions`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `session_insert_current_version`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `session_update_current_version`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_delete_pending_auth`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_role_revoke_oauth_grants`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`image` text,
	`name` text NOT NULL,
	`profile` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`security_version` integer DEFAULT 0 NOT NULL,
	`social_links` text DEFAULT '[]' NOT NULL,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "user_role" CHECK("role" IN ('member', 'admin'))
);
--> statement-breakpoint
INSERT INTO `__new_user`(`created_at`, `email`, `email_verified`, `id`, `image`, `name`, `profile`, `role`, `security_version`, `social_links`, `two_factor_enabled`, `updated_at`) SELECT `created_at`, `email`, `email_verified`, `id`, `image`, `name`, `profile`, CASE WHEN `role` = 'user' THEN 'member' ELSE `role` END, `security_version`, `social_links`, `two_factor_enabled`, `updated_at` FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TRIGGER user_keep_last_admin_delete
BEFORE DELETE ON user
WHEN OLD.role = 'admin' AND (SELECT count(*) FROM user WHERE role = 'admin') <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_ADMIN_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER user_keep_last_admin_update
BEFORE UPDATE OF role ON user
WHEN OLD.role = 'admin' AND NEW.role <> 'admin'
  AND (SELECT count(*) FROM user WHERE role = 'admin') <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_ADMIN_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER user_role_revoke_sessions
AFTER UPDATE OF role ON user
WHEN OLD.role <> NEW.role
BEGIN
  UPDATE user SET security_version = OLD.security_version + 1 WHERE id = NEW.id;
  DELETE FROM session WHERE user_id = NEW.id;
  DELETE FROM verification WHERE value = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER session_insert_current_version
BEFORE INSERT ON session
WHEN NEW.security_version <> (SELECT security_version FROM user WHERE id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'SESSION_VERSION_STALE');
END;--> statement-breakpoint
CREATE TRIGGER session_update_current_version
BEFORE UPDATE ON session
WHEN NEW.security_version <> (SELECT security_version FROM user WHERE id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'SESSION_VERSION_STALE');
END;--> statement-breakpoint
CREATE TRIGGER user_delete_pending_auth
AFTER DELETE ON user
BEGIN
  DELETE FROM verification WHERE value = OLD.id;
END;--> statement-breakpoint
CREATE TRIGGER user_role_revoke_oauth_grants
AFTER UPDATE OF role ON user
WHEN OLD.role <> NEW.role
BEGIN
  DELETE FROM oauth_access_token WHERE user_id = NEW.id;
  DELETE FROM oauth_refresh_token WHERE user_id = NEW.id;
  DELETE FROM oauth_consent WHERE user_id = NEW.id;
END;
