import { browserHttp, LoginPage } from "@repo/auth-ui";
import { httpStatus } from "@repo/observability/http-status";
import { decodeJson } from "@repo/runtime/client";
import { Effect, Schema } from "effect";
import { HttpBody, HttpClient } from "effect/unstable/http";

import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

const Redirect = Schema.Struct({ url: Schema.String });

function requestContinuation(oauthQuery: string) {
  return Effect.gen(function* continueOAuth() {
    const requestBody = yield* HttpBody.json({ oauth_query: oauthQuery, postLogin: true });
    return yield* HttpClient.post("/api/auth/oauth2/continue", { body: requestBody }).pipe(
      Effect.provide(browserHttp),
    );
  }).pipe(Effect.orDie);
}

function continuationTarget(oauthQuery: string): Effect.Effect<string> {
  return Effect.gen(function* continuationUrl() {
    const response = yield* requestContinuation(oauthQuery);
    if (response.status === httpStatus.forbidden) {
      return "/security";
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* Effect.die("連携の許可を続けられませんでした。");
    }
    return decodeJson(Redirect, yield* response.json).url;
  }).pipe(Effect.orDie);
}

function continueAuthorization(): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* continueAfterLogin() {
      const oauthQuery = globalThis.location.search.slice(1);
      if (!new URLSearchParams(oauthQuery).has("sig")) {
        globalThis.location.assign("/");
        return;
      }
      globalThis.location.assign(yield* continuationTarget(oauthQuery));
    }),
  );
}

function WikiLogin(): ReactElement {
  return (
    <LoginPage
      title={`${serviceName} にログイン`}
      signUp={false}
      onAuthenticated={continueAuthorization}
    />
  );
}

export { WikiLogin };
