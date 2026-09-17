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
          const verification = new URL("/api/auth/verify-email", context.runtime.config.APP_ORIGIN);
          verification.searchParams.set("token", token);
          const response = await context.runtime.auth.handler(
            new Request(verification, { method: "GET", headers: request.headers }),
          );
          await response.body?.cancel();
          if (!response.ok)
            throw Object.assign(new Error("EMAIL_VERIFICATION_FAILED"), {
              statusCode: response.status === 429 ? 429 : 400,
            });
          return { verified: true };
        }, context.runtime.reportError),
    },
  },
});
