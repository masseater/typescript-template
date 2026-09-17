export const routes = {
  "/": "users",
  "/login": "login",
  "/security": "security",
  "/api/auth/*": "auth",
  "/api/session": "session",
  "/api/users": "users-api",
  "/api/telemetry": "telemetry",
  "/api/client-config": "client-config",
} as const;
