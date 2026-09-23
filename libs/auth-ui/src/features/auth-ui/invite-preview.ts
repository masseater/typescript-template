import { httpStatus } from "@repo/config";
import { ErrorBody, InvitePreview } from "@repo/runtime/contracts";
import { Effect, Option, Result, Schema } from "effect";
import { FetchHttpClient, HttpClient, type HttpClientResponse } from "effect/unstable/http";

import { browserHttp } from "./browser-http.ts";
import { decodeJson } from "./protocol.ts";

type Invitation =
  | Readonly<{ email: string; status: "available" }>
  | Readonly<{ message: string; status: "unavailable" }>;

const unavailable = (unavailableDetail: string): Invitation => ({
  message: unavailableDetail,
  status: "unavailable",
});

const available = (email: string): Invitation => ({ email, status: "available" });

type ServedInvitation = Readonly<Pick<HttpClientResponse.HttpClientResponse, "json" | "status">>;

const readFailureMessage = (served: ServedInvitation, fallback: string): Effect.Effect<string> =>
  Effect.gen(function* decodeFailureMessage() {
    const failureBody = yield* served.json.pipe(Effect.orElseSucceed(() => ({ error: fallback })));
    const decoded = Schema.decodeUnknownResult(ErrorBody)(failureBody);
    return Result.isSuccess(decoded) ? decoded.success.error : fallback;
  });

const readInvitation = (
  served: ServedInvitation,
  closedMessage: string,
): Effect.Effect<Invitation> =>
  Effect.gen(function* decodeInvitation() {
    if (served.status === httpStatus.notFound) {
      return unavailable(closedMessage);
    }
    if (served.status < 200 || served.status >= 300) {
      const failureDetail = yield* readFailureMessage(served, closedMessage);
      return unavailable(failureDetail);
    }
    const servedInvite = yield* served.json.pipe(Effect.orDie);
    return available(decodeJson(InvitePreview, servedInvite).email);
  });

const loadInvitation = (endpoint: string, token: string): Effect.Effect<Invitation> =>
  Effect.gen(function* previewInvitationToken() {
    const closedMessage =
      "招待が無効か、有効期限が切れています。招待した人に再送を依頼してください。";
    const previewLocation = new URL(endpoint, globalThis.location.origin);
    previewLocation.searchParams.set("token", token);
    const served = yield* HttpClient.get(previewLocation.toString()).pipe(
      Effect.provide(browserHttp),
      Effect.provideService(FetchHttpClient.RequestInit, {
        cache: "no-store",
        credentials: "same-origin",
      }),
      Effect.option,
    );
    if (Option.isNone(served)) {
      return unavailable(closedMessage);
    }
    return yield* readInvitation(served.value, closedMessage);
  });

const previewInvitation = (endpoint: string, token: string): Promise<Invitation> =>
  Effect.runPromise(loadInvitation(endpoint, token));

export { previewInvitation, readFailureMessage };
export type { Invitation };
