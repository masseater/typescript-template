import { handleAuthRequest, verifyEmailToken, verifySession } from "@template/auth";
import { ingestBrowser } from "@template/observability";
import { Effect } from "effect";
import { EmailVerificationRequest, EmailVerified, SessionView } from "./contracts.ts";
import { apiBridge, createApi, readJsonBody } from "./http.ts";
import type { AppServices } from "./index.ts";

export const unavailable = { AuthFailure: "unexpected", DatabaseFailure: "unexpected" } as const;

export const accountApi = (bridge: ReturnType<typeof apiBridge<AppServices>>) =>
  createApi()
    .all("/api/auth/*", bridge.raw(handleAuthRequest, unavailable))
    .post("/api/telemetry", bridge.raw(ingestBrowser, {}))
    .get(
      "/api/session",
      bridge.route(SessionView, (request) => verifySession(request.headers, true), unavailable),
    )
    .post(
      "/api/verify-email",
      bridge.route(
        EmailVerified,
        (request) =>
          readJsonBody(EmailVerificationRequest, request).pipe(
            Effect.flatMap(({ token }) => verifyEmailToken(token, request.headers)),
          ),
        {
          ...unavailable,
          EmailVerificationFailed: (error) =>
            error.rateLimited
              ? { status: 429, message: "しばらく待ってから再度お試しください。" }
              : { status: 400, message: "確認リンクが無効か、有効期限が切れています。" },
        },
      ),
    );
