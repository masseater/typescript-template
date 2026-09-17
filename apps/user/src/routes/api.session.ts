import { createFileRoute } from "@tanstack/react-router";
import { sessionHandler } from "@template/runtime/handlers";

export const Route = createFileRoute("/api/session")({
  server: { handlers: { GET: sessionHandler } },
});
