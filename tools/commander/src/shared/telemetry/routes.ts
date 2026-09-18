export const routes = {
  "/": "commander",
  "/api/chat": "chat-api",
  "/api/chat/stop": "chat-stop-api",
  "/api/events": "events-api",
  "/api/ledger": "ledger-api",
  "/api/tasks/*": "tasks-api",
  "/api/telemetry": "telemetry",
} as const;
