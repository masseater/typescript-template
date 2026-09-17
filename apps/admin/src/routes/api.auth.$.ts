import { createFileRoute } from "@tanstack/react-router";
import { authHandler } from "@template/runtime/handlers";

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: authHandler, POST: authHandler } },
});
