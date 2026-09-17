export const routes = {
  "/": "profile",
  "/api/auth/*": "auth",
  "/api/health": "health",
  "/api/profile": "profile-api",
  "/api/session": "session",
  "/api/telemetry": "telemetry",
  "/api/verify-email": "verify-email-api",
  "/login": "login",
  "/security": "security",
  "/signup": "signup",
  "/verify-email": "verify-email",
} as const;
