export const routes = {
  "/": "profile",
  "/api/auth/*": "auth",
  "/api/client-config": "client-config",
  "/api/profile": "profile-api",
  "/api/session": "session",
  "/api/telemetry": "telemetry",
  "/login": "login",
  "/security": "security",
  "/signup": "signup",
} as const;
