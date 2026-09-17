export const routes = {
  "/": "home",
  "/*": "page",
  "/login": "login",
  "/consent": "consent",
  "/security": "security",
  "/api/auth/*": "auth",
  "/.well-known/*": "oauth-discovery",
  "/api/session": "session",
  "/api/search": "search",
  "/api/health": "health",
  "/mcp": "mcp",
  "/api/telemetry": "telemetry",
} as const;
