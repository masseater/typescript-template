export const routes = {
  "/": "home",
  "/*": "page",
  "/api/search": "search",
  "/api/health": "health",
  "/mcp": "mcp",
  "/api/telemetry": "telemetry",
} as const;
