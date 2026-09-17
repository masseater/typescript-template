CREATE TRIGGER user_keep_last_admin_delete
BEFORE DELETE ON user
WHEN OLD.role = 'admin' AND (SELECT count(*) FROM user WHERE role = 'admin') <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_ADMIN_REQUIRED');
END;
--> statement-breakpoint
CREATE TRIGGER user_keep_last_admin_update
BEFORE UPDATE OF role ON user
WHEN OLD.role = 'admin' AND NEW.role <> 'admin'
  AND (SELECT count(*) FROM user WHERE role = 'admin') <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_ADMIN_REQUIRED');
END;
--> statement-breakpoint
CREATE TRIGGER user_role_revoke_sessions
AFTER UPDATE OF role ON user
WHEN OLD.role <> NEW.role
BEGIN
  UPDATE user SET security_version = OLD.security_version + 1 WHERE id = NEW.id;
  DELETE FROM session WHERE user_id = NEW.id;
  DELETE FROM verification WHERE value = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER session_insert_current_version
BEFORE INSERT ON session
WHEN NEW.security_version <> (SELECT security_version FROM user WHERE id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'SESSION_VERSION_STALE');
END;
--> statement-breakpoint
CREATE TRIGGER session_update_current_version
BEFORE UPDATE ON session
WHEN NEW.security_version <> (SELECT security_version FROM user WHERE id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'SESSION_VERSION_STALE');
END;
--> statement-breakpoint
CREATE TRIGGER user_delete_pending_auth
AFTER DELETE ON user
BEGIN
  DELETE FROM verification WHERE value = OLD.id;
END;
