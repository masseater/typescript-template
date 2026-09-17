export const routes = {
  "/": "users",
  "/login": "login",
  "/security": "security",
  "/api/auth/*": "auth",
  "/api/session": "session",
  "/api/users": "users-api",
  "/api/telemetry": "telemetry",
} as const;
