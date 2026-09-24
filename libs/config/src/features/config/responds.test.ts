import { NodeHttpServer } from "@effect/platform-node";
import { Deferred, Effect, Ref } from "effect";
import { HttpServer, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, test } from "vite-plus/test";

import { respondedSuccessfully, waitUntilResponds } from "./responds.ts";

const refused = "connection refused";
const timedOut = "timed out";
const successAfterAttempts = 3;
const unavailableStatus = 503;

const probeCases = [
  ["a successful GET", "GET", 200, undefined, undefined, 200],
  ["an empty successful POST", "POST", 204, undefined, undefined, 204],
  [
    "a status that is not acceptable",
    "GET",
    unavailableStatus,
    undefined,
    undefined,
    unavailableStatus,
  ],
  ["a response that exceeds the timeout", "GET", "silent", 50, undefined, timedOut],
  ["retries until the target responds", "GET", "retry-until-ok", undefined, 2, "200:3"],
  ["retries that are exhausted", "GET", "retry-exhausted", undefined, 1, "503:2"],
] as const;

describe.for(probeCases)(
  "%s",
  ([, method, writeHead, timeoutMilliseconds, retryTimes, pinnedProbe]) => {
    const it = test.extend("observedProbe", () =>
      Effect.runPromise(
        Effect.gen(function* observeProbe() {
          const server = yield* HttpServer.HttpServer;
          const attempts = yield* Ref.make(0);
          const probed = yield* Deferred.make<number | string>();
          yield* server.serve(
            Effect.gen(function* respond() {
              if (writeHead === "silent") {
                yield* Deferred.await(probed);
                return HttpServerResponse.text("ok");
              }
              const seenAttempts =
                writeHead === "retry-until-ok" || writeHead === "retry-exhausted"
                  ? yield* Ref.updateAndGet(attempts, (counted) => counted + 1)
                  : yield* Ref.get(attempts);
              const httpStatus =
                writeHead === "retry-until-ok"
                  ? seenAttempts >= successAfterAttempts
                    ? 200
                    : unavailableStatus
                  : writeHead === "retry-exhausted"
                    ? unavailableStatus
                    : writeHead;
              return httpStatus === 204
                ? HttpServerResponse.empty({ status: httpStatus })
                : HttpServerResponse.text("ok", { status: httpStatus });
            }),
          );
          if (server.address._tag === "UnixPathAddress") {
            return yield* Effect.die(new Error("the probe server did not bind a port"));
          }
          const port = server.address.port;
          const program = waitUntilResponds<number | string>({
            accept: respondedSuccessfully,
            method,
            onStatus: (rejectedStatus) => rejectedStatus,
            onUnreachable: () => timedOut,
            ...(timeoutMilliseconds === undefined ? {} : { timeoutMilliseconds }),
            ...(retryTimes === undefined
              ? {}
              : { retry: { interval: "10 millis", times: retryTimes } }),
            url: `http://127.0.0.1:${port}/ready`,
          });
          if (
            writeHead === unavailableStatus ||
            writeHead === "silent" ||
            writeHead === "retry-exhausted"
          ) {
            const failed = yield* Effect.flip(program);
            yield* Deferred.succeed(probed, failed);
            return writeHead === "retry-exhausted"
              ? `${failed}:${yield* Ref.get(attempts)}`
              : failed;
          }
          const succeeded = yield* program;
          return writeHead === "retry-until-ok"
            ? `${succeeded}:${yield* Ref.get(attempts)}`
            : succeeded;
        }).pipe(Effect.scoped, Effect.provide(NodeHttpServer.layerTest)),
      ));

    it("reports what the probe observed", ({ observedProbe }) => {
      expect(observedProbe).toStrictEqual(pinnedProbe);
    });
  },
);

describe("a target that never accepts the connection", () => {
  const it = test.extend("unreachableName", () =>
    Effect.runPromise(
      Effect.gen(function* probeClosedPort() {
        const closedAddress = yield* Effect.map(
          HttpServer.HttpServer,
          (server) => server.address,
        ).pipe(Effect.provide(NodeHttpServer.layerTest));
        if (closedAddress._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the probe server did not bind a port"));
        }
        const port = closedAddress.port;
        return yield* waitUntilResponds({
          accept: respondedSuccessfully,
          method: "GET",
          onStatus: () => refused,
          onUnreachable: (caught) => (caught instanceof Error ? caught.name : refused),
          url: `http://127.0.0.1:${port}/ready`,
        }).pipe(Effect.flip);
      }),
    ));

  it("names the failure instead of a response status", ({ unreachableName }) => {
    expect(unreachableName).toBe("HttpClientError");
  });
});

describe.for([
  [199, false],
  [200, true],
  [299, true],
  [300, false],
] as const)("HTTP %i", ([httpStatus, accepted]) => {
  const it = test.extend("successful", () => respondedSuccessfully(httpStatus));

  it("is a successful response status only from 200 up to 300", ({ successful }) => {
    expect(successful).toBe(accepted);
  });
});
