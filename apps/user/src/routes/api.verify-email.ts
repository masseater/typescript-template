import { createFileRoute } from "@tanstack/react-router";
import { apiResponse, readJson } from "@template/runtime/http";
import * as v from "valibot";

export const Route = createFileRoute("/api/verify-email")({
  server: {
    handlers: {
      POST: ({ request, context }) =>
        apiResponse(async () => {
          const { token } = v.parse(
            v.strictObject({ token: v.pipe(v.string(), v.minLength(1), v.maxLength(4096)) }),
            await readJson(request, context.runtime.config.APP_ORIGIN),
          );
          await context.runtime.auth.api.verifyEmail({ query: { token } });
          return { verified: true };
        }, context.runtime.reportError),
    },
  },
});
