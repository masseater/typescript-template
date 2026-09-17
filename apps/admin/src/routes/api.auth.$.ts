import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request, context }) => context.runtime.auth.handler(request),
      POST: ({ request, context }) => context.runtime.auth.handler(request),
    },
  },
});
