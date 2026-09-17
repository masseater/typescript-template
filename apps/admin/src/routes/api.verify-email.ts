import { createFileRoute } from "@tanstack/react-router";
import { verifyEmailHandler } from "@template/runtime/handlers";

export const Route = createFileRoute("/api/verify-email")({
  server: { handlers: { POST: verifyEmailHandler } },
});
