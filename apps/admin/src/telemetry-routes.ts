export const routes = {
  "/": "users",
  "/login": "login",
  "/security": "security",
  "/verify-email": "verify-email",
  "/api/auth/*": "auth",
  "/api/session": "session",
  "/api/users": "users-api",
  "/api/verify-email": "verify-email-api",
  "/api/health": "health",
  "/api/telemetry": "telemetry",
} as const;
