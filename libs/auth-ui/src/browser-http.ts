import { Effect, Layer, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/unstable/http";

import { isPasskeyOptionsPath, passkeyUVOptions } from "./protocol.ts";

const browserHttp = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { credentials: "same-origin" }),
);

const headerList = (responseHeaders: Readonly<Record<string, string>>): globalThis.Headers => {
  const collected = new globalThis.Headers();
  for (const headerEntry of Object.entries(responseHeaders)) {
    const headerName = headerEntry[0];
    const headerContent = headerEntry[1];
    if (typeof headerContent === "string") {
      collected.append(headerName, headerContent);
    }
  }
  return collected;
};

const bufferedResponse = (
  served: Readonly<{
    readonly headers: Readonly<Record<string, string>>;
    readonly status: number;
  }>,
  responseBody: ArrayBuffer | string,
): Response =>
  new Response(responseBody, {
    headers: headerList(served.headers),
    status: served.status,
  });

const executeBrowserRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Effect.Effect<Response> =>
  Effect.gen(function* adaptPasskeyOptions() {
    const webRequest = new Request(input, init);
    const served = yield* HttpClient.execute(HttpClientRequest.fromWeb(webRequest)).pipe(
      Effect.provide(browserHttp),
    );
    const { pathname } = new URL(webRequest.url);
    if (served.status < 200 || served.status >= 300 || !isPasskeyOptionsPath(pathname)) {
      return bufferedResponse(served, yield* served.arrayBuffer);
    }
    const passkeyOptions = passkeyUVOptions(yield* served.json, pathname);
    const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
      passkeyOptions,
    );
    return bufferedResponse(served, encoded);
  }).pipe(Effect.orDie);

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
