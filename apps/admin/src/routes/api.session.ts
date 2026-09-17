import { apiResponse } from "@template/runtime/http";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/session")({
  server: {
    handlers: {
      GET: async ({ request, context }) =>
        apiResponse(async () => {
          const { user, strong } = await context.runtime.session(request, true);
          return {
            strong,
            user: {
              email: user.email,
              id: user.id,
              name: user.name,
              role: user.role,
              twoFactorEnabled: user.twoFactorEnabled,
            },
          };
        }, context.runtime.reportError),
    },
  },
});
