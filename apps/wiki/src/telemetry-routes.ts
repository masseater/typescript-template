export const routes = {
  "/": "home",
  "/*": "page",
  "/api/health": "health",
  "/api/search": "search",
  "/api/telemetry": "telemetry",
  "/mcp": "mcp",
} as const;
