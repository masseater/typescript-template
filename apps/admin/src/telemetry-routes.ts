export const routes = {
  "/": "users",
  "/api/auth/*": "auth",
  "/api/client-config": "client-config",
  "/api/session": "session",
  "/api/telemetry": "telemetry",
  "/api/users": "users-api",
  "/login": "login",
  "/security": "security",
} as const;
