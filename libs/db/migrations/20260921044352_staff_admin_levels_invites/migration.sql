CREATE TABLE `invite` (
	`accepted_at` integer,
	`audience` text NOT NULL,
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`inviter_id` text NOT NULL,
	`permission` text NOT NULL,
	`token_hash` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `audit_event` ADD `actor_kind` text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `account_state` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `permission` text;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_keep_last_admin_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_keep_last_admin_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_role_revoke_sessions`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `session_insert_current_version`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `session_update_current_version`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_delete_pending_auth`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_role_revoke_oauth_grants`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`account_state` text DEFAULT 'active' NOT NULL,
	`company_photo_key` text,
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`face_photo_key` text,
	`id` text PRIMARY KEY NOT NULL,
	`image` text,
	`name` text NOT NULL,
	`permission` text,
	`profile` text DEFAULT '' NOT NULL,
	`social_links` text DEFAULT '[]' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`searchable` integer DEFAULT false NOT NULL,
	`security_version` integer DEFAULT 0 NOT NULL,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	`visibility` text DEFAULT 'all_members' NOT NULL,
	CONSTRAINT "user_role" CHECK("role" IN ('member', 'admin', 'staff')),
	CONSTRAINT "user_account_state" CHECK("account_state" IN ('active', 'suspended')),
	CONSTRAINT "user_permission" CHECK(("role" = 'member' AND "permission" IS NULL) OR ("role" = 'admin' AND "permission" IN ('viewer', 'operator', 'owner')) OR ("role" = 'staff' AND "permission" IN ('viewer', 'editor')))
);
--> statement-breakpoint
INSERT INTO `__new_user`(`account_state`, `company_photo_key`, `created_at`, `email`, `email_verified`, `face_photo_key`, `id`, `image`, `name`, `permission`, `profile`, `social_links`, `role`, `searchable`, `security_version`, `two_factor_enabled`, `updated_at`, `visibility`) SELECT 'active', `company_photo_key`, `created_at`, `email`, `email_verified`, `face_photo_key`, `id`, `image`, `name`, CASE WHEN `role` = 'admin' THEN 'owner' WHEN `role` = 'staff' THEN 'editor' ELSE NULL END, `profile`, `social_links`, `role`, `searchable`, `security_version`, `two_factor_enabled`, `updated_at`, `visibility` FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `invite_token_hash_unique` ON `invite` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invite_email_idx` ON `invite` (`audience`,`email`);
--> statement-breakpoint
CREATE TRIGGER user_keep_last_admin_delete
BEFORE DELETE ON user
WHEN OLD.role = 'admin' AND OLD.permission = 'owner' AND OLD.account_state = 'active'
  AND (SELECT count(*) FROM user WHERE role = 'admin' AND permission = 'owner' AND account_state = 'active') <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_ADMIN_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER user_keep_last_admin_update
BEFORE UPDATE OF role, permission, account_state ON user
WHEN OLD.role = 'admin' AND OLD.permission = 'owner' AND OLD.account_state = 'active'
  AND NOT (NEW.role = 'admin' AND NEW.permission = 'owner' AND NEW.account_state = 'active')
  AND (SELECT count(*) FROM user WHERE role = 'admin' AND permission = 'owner' AND account_state = 'active') <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_ADMIN_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER user_keep_last_editor_delete
BEFORE DELETE ON user
WHEN OLD.role = 'staff' AND OLD.permission = 'editor' AND OLD.account_state = 'active'
  AND (SELECT count(*) FROM user WHERE role = 'staff' AND permission = 'editor' AND account_state = 'active') <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_EDITOR_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER user_keep_last_editor_update
BEFORE UPDATE OF role, permission, account_state ON user
WHEN OLD.role = 'staff' AND OLD.permission = 'editor' AND OLD.account_state = 'active'
  AND NOT (NEW.role = 'staff' AND NEW.permission = 'editor' AND NEW.account_state = 'active')
  AND (SELECT count(*) FROM user WHERE role = 'staff' AND permission = 'editor' AND account_state = 'active') <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_EDITOR_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER user_role_revoke_sessions
AFTER UPDATE OF role ON user
WHEN OLD.role <> NEW.role
BEGIN
  UPDATE user SET security_version = OLD.security_version + 1 WHERE id = NEW.id;
  DELETE FROM session WHERE user_id = NEW.id;
  DELETE FROM verification WHERE value = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER user_state_revoke_sessions
AFTER UPDATE OF account_state ON user
WHEN OLD.account_state <> NEW.account_state
BEGIN
  UPDATE user SET security_version = OLD.security_version + 1 WHERE id = NEW.id;
  DELETE FROM session WHERE user_id = NEW.id;
  DELETE FROM verification WHERE value = NEW.id;
  DELETE FROM oauth_access_token WHERE user_id = NEW.id;
  DELETE FROM oauth_refresh_token WHERE user_id = NEW.id;
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
END;--> statement-breakpoint
CREATE TRIGGER invite_accept_once
BEFORE UPDATE OF accepted_at ON invite
WHEN OLD.accepted_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'INVITE_CONSUMED');
END;
