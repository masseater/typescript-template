export const routes = {
  "/": "profile",
  "/login": "login",
  "/signup": "signup",
  "/security": "security",
  "/api/auth/*": "auth",
  "/api/session": "session",
  "/api/profile": "profile-api",
  "/api/telemetry": "telemetry",
} as const;
