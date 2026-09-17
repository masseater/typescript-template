CREATE TRIGGER user_role_revoke_oauth_grants
AFTER UPDATE OF role ON user
WHEN OLD.role <> NEW.role
BEGIN
  DELETE FROM oauth_access_token WHERE user_id = NEW.id;
  DELETE FROM oauth_refresh_token WHERE user_id = NEW.id;
  DELETE FROM oauth_consent WHERE user_id = NEW.id;
END;
