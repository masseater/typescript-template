export const routes = {
  "/": "home",
  "/*": "page",
  "/api/client-config": "client-config",
  "/api/search": "search",
  "/api/telemetry": "telemetry",
  "/mcp": "mcp",
} as const;
