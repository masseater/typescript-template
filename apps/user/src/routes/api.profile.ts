import { apiResponse, readJson } from "@template/runtime/http";
import { getProfile, updateProfile } from "@template/db";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request, context }) =>
        apiResponse(async () => {
          const { user } = await context.runtime.session(request);
          return getProfile(context.runtime.database, user.id);
        }, context.runtime.reportError),
      PATCH: async ({ request, context }) =>
        apiResponse(async () => {
          const { user } = await context.runtime.session(request);
          const input = await readJson(request, context.runtime.config.APP_ORIGIN);
          return updateProfile(context.runtime.database, user.id, input);
        }, context.runtime.reportError),
    },
  },
});
