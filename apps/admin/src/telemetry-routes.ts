export const routes = {
  "/": "users",
  "/api/auth/*": "auth",
  "/api/session": "session",
  "/api/telemetry": "telemetry",
  "/api/users": "users-api",
  "/api/verify-email": "verify-email-api",
  "/login": "login",
  "/security": "security",
  "/verify-email": "verify-email",
} as const;
