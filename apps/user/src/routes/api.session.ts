import { createFileRoute } from "@tanstack/react-router";
import { apiResponse } from "@template/runtime/http";

export const Route = createFileRoute("/api/session")({
  server: {
    handlers: {
      GET: ({ request, context }) =>
        apiResponse(async () => {
          const { user, strong } = await context.runtime.session(request, true);
          return {
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              twoFactorEnabled: user.twoFactorEnabled,
            },
            strong,
          };
        }, context.runtime.reportError),
    },
  },
});
