import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, type HttpClientResponse } from "effect/unstable/http";

import { isPasskeyOptionsPath, passkeyUVOptions } from "./protocol.ts";

class BrowserHttpFailed extends Schema.TaggedError<BrowserHttpFailed>()("BrowserHttpFailed", {
  reason: Schema.Literals(["request", "passkey_options"]),
}) {}

const requestFromBrowser = (
  fetchImpl: typeof fetch,
  requested: { readonly input: RequestInfo | URL; readonly init?: RequestInit },
): Effect.Effect<Response> =>
  Effect.tryPromise({
    try: (signal) => fetchImpl(requested.input, { ...requested.init, signal }),
    catch: () => new BrowserHttpFailed({ reason: "request" }),
  }).pipe(Effect.orDie);

const executeBrowserRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Effect.Effect<Response> =>
  Effect.gen(function* adaptPasskeyOptions() {
    const served = yield* requestFromBrowser(fetch, {
      input,
      ...(init === undefined ? {} : { init }),
    });
    if (!served.ok) {
      return served;
    }
    const { pathname } = new URL(served.url);
    if (!isPasskeyOptionsPath(pathname)) {
      return served;
    }
    const passkeyOptions: unknown = yield* Effect.tryPromise({
      try: () => served.clone().json(),
      catch: () => new BrowserHttpFailed({ reason: "passkey_options" }),
    }).pipe(Effect.orDie);
    const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
      passkeyUVOptions(passkeyOptions, pathname),
    ).pipe(Effect.orDie);
    return new Response(encoded, {
      headers: served.headers,
      status: served.status,
      statusText: served.statusText,
    });
  });

const browserHttp = FetchHttpClient.layer;

const browserGet = (
  endpoint: string,
  init: globalThis.RequestInit,
): Effect.Effect<HttpClientResponse.HttpClientResponse> =>
  HttpClient.get(endpoint).pipe(
    Effect.provide(browserHttp),
    Effect.provideService(FetchHttpClient.RequestInit, init),
    Effect.orDie,
  );

const authTask = <Result>(task: () => Promise<Result>): Effect.Effect<Result> =>
  Effect.tryPromise(task).pipe(Effect.orDie);

export { authTask, browserGet, browserHttp, executeBrowserRequest };
