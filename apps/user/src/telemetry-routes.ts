export const routes = {
  "/": "profile",
  "/login": "login",
  "/signup": "signup",
  "/security": "security",
  "/verify-email": "verify-email",
  "/api/auth/*": "auth",
  "/api/session": "session",
  "/api/profile": "profile-api",
  "/api/verify-email": "verify-email-api",
  "/api/health": "health",
  "/api/telemetry": "telemetry",
} as const;
