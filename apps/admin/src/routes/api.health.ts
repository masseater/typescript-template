import { createFileRoute } from "@tanstack/react-router";
import { healthHandler } from "@template/runtime/handlers";

export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: healthHandler } },
});
