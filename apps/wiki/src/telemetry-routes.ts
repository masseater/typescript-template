export const routes = {
  "/": "home",
  "/*": "page",
  "/api/search": "search",
  "/mcp": "mcp",
  "/api/telemetry": "telemetry",
  "/api/client-config": "client-config",
} as const;
