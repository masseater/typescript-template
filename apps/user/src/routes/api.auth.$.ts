import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      GET: async ({ request, context }) => context.runtime.auth.handler(request),
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      POST: async ({ request, context }) => context.runtime.auth.handler(request),
    },
  },
});
