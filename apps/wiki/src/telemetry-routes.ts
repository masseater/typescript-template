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
  "/mcp": "mcp",
  "/api/telemetry": "telemetry",
  "/api/client-config": "client-config",
} as const;
