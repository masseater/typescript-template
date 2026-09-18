export const routes = {
  "/": "home",
  "/*": "page",
  "/.well-known/*": "oauth-discovery",
  "/api/auth/*": "auth",
  "/api/health": "health",
  "/api/search": "search",
  "/api/session": "session",
  "/api/telemetry": "telemetry",
  "/consent": "consent",
  "/login": "login",
  "/mcp": "mcp",
  "/security": "security",
} as const;
