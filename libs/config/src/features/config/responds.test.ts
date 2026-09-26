import { NodeHttpServer } from "@effect/platform-node";
import { Deferred, Effect, Ref } from "effect";
import { HttpServer, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, test } from "vite-plus/test";

import { respondedSuccessfully, waitUntilResponds } from "./responds.ts";

describe("a GET answered with 200", () => {
  const it = test.extend("observedStatus", () =>
    Effect.runPromise(
      Effect.gen(function* probeOk() {
        const server = yield* HttpServer.HttpServer;
        yield* server.serve(Effect.succeed(HttpServerResponse.text("ok")));
        if (server.address._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the probe server did not bind a port"));
        }
        const url = `http://127.0.0.1:${server.address.port}/ready`;
        return yield* waitUntilResponds({
          accept: respondedSuccessfully,
          method: "GET",
          onStatus: () => "status",
          onUnreachable: () => "unreachable",
          url,
        });
      }).pipe(Effect.scoped, Effect.provide(NodeHttpServer.layerTest)),
    ));

  it("succeeds with 200", ({ observedStatus }) => {
    expect(observedStatus).toBe(200);
  });
});

describe("a POST answered with an empty 204", () => {
  const it = test.extend("observedStatus", () =>
    Effect.runPromise(
      Effect.gen(function* probeEmptyPost() {
        const server = yield* HttpServer.HttpServer;
        yield* server.serve(Effect.succeed(HttpServerResponse.empty({ status: 204 })));
        if (server.address._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the probe server did not bind a port"));
        }
        const url = `http://127.0.0.1:${server.address.port}/ready`;
        return yield* waitUntilResponds({
          accept: respondedSuccessfully,
          method: "POST",
          onStatus: () => "status",
          onUnreachable: () => "unreachable",
          url,
        });
      }).pipe(Effect.scoped, Effect.provide(NodeHttpServer.layerTest)),
    ));

  it("succeeds with 204", ({ observedStatus }) => {
    expect(observedStatus).toBe(204);
  });
});

describe("a GET answered with 503", () => {
  const it = test.extend("observedFailure", () =>
    Effect.runPromise(
      Effect.gen(function* probeUnavailable() {
        const server = yield* HttpServer.HttpServer;
        yield* server.serve(
          Effect.succeed(HttpServerResponse.text("unavailable", { status: 503 })),
        );
        if (server.address._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the probe server did not bind a port"));
        }
        const url = `http://127.0.0.1:${server.address.port}/ready`;
        return yield* waitUntilResponds({
          accept: respondedSuccessfully,
          method: "GET",
          onStatus: (rejectedStatus) => `status ${rejectedStatus}`,
          onUnreachable: () => "unreachable",
          url,
        }).pipe(Effect.flip);
      }).pipe(Effect.scoped, Effect.provide(NodeHttpServer.layerTest)),
    ));

  it("fails with the value onStatus gives for 503", ({ observedFailure }) => {
    expect(observedFailure).toBe("status 503");
  });
});

describe("a GET that gets no answer within the 50 ms timeout", () => {
  const it = test.extend("observedFailure", () =>
    Effect.runPromise(
      Effect.gen(function* probeSilent() {
        const probed = yield* Deferred.make<string>();
        const server = yield* HttpServer.HttpServer;
        yield* server.serve(
          Deferred.await(probed).pipe(Effect.as(HttpServerResponse.text("late"))),
        );
        if (server.address._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the probe server did not bind a port"));
        }
        const url = `http://127.0.0.1:${server.address.port}/ready`;
        const failed = yield* waitUntilResponds({
          accept: respondedSuccessfully,
          method: "GET",
          onStatus: () => "status",
          onUnreachable: () => "unreachable",
          timeoutMilliseconds: 50,
          url,
        }).pipe(Effect.flip);
        yield* Deferred.succeed(probed, failed);
        return failed;
      }).pipe(Effect.scoped, Effect.provide(NodeHttpServer.layerTest)),
    ));

  it("fails with the value onUnreachable gives", ({ observedFailure }) => {
    expect(observedFailure).toBe("unreachable");
  });
});

describe("a GET answered with 503 twice and then 200, retried 2 times", () => {
  const it = test.extend("observedProbe", () =>
    Effect.runPromise(
      Effect.gen(function* probeUntilOk() {
        const attempts = yield* Ref.make(0);
        const server = yield* HttpServer.HttpServer;
        yield* server.serve(
          Ref.updateAndGet(attempts, (counted) => counted + 1).pipe(
            Effect.map((attempt) =>
              HttpServerResponse.text("ready?", { status: attempt < 3 ? 503 : 200 }),
            ),
          ),
        );
        if (server.address._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the probe server did not bind a port"));
        }
        const url = `http://127.0.0.1:${server.address.port}/ready`;
        const respondedStatus = yield* waitUntilResponds({
          accept: respondedSuccessfully,
          method: "GET",
          onStatus: () => "status",
          onUnreachable: () => "unreachable",
          retry: { interval: "10 millis", times: 2 },
          url,
        });
        return { attempts: yield* Ref.get(attempts), status: respondedStatus };
      }).pipe(Effect.scoped, Effect.provide(NodeHttpServer.layerTest)),
    ));

  it("succeeds with 200 on the third attempt", ({ observedProbe }) => {
    expect(observedProbe).toStrictEqual({ attempts: 3, status: 200 });
  });
});

describe("a GET always answered with 503, retried 1 time", () => {
  const it = test.extend("observedProbe", () =>
    Effect.runPromise(
      Effect.gen(function* probeExhausted() {
        const attempts = yield* Ref.make(0);
        const server = yield* HttpServer.HttpServer;
        yield* server.serve(
          Ref.update(attempts, (counted) => counted + 1).pipe(
            Effect.as(HttpServerResponse.text("unavailable", { status: 503 })),
          ),
        );
        if (server.address._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the probe server did not bind a port"));
        }
        const url = `http://127.0.0.1:${server.address.port}/ready`;
        const failure = yield* waitUntilResponds({
          accept: respondedSuccessfully,
          method: "GET",
          onStatus: (rejectedStatus) => `status ${rejectedStatus}`,
          onUnreachable: () => "unreachable",
          retry: { interval: "10 millis", times: 1 },
          url,
        }).pipe(Effect.flip);
        return { attempts: yield* Ref.get(attempts), failure };
      }).pipe(Effect.scoped, Effect.provide(NodeHttpServer.layerTest)),
    ));

  it("fails with the value onStatus gives for 503 after 2 attempts", ({ observedProbe }) => {
    expect(observedProbe).toStrictEqual({ attempts: 2, failure: "status 503" });
  });
});

describe("a target that never accepts the connection", () => {
  const it = test.extend("observedFailure", () =>
    Effect.runPromise(
      Effect.gen(function* probeClosedPort() {
        const closedAddress = yield* Effect.map(
          HttpServer.HttpServer,
          (server) => server.address,
        ).pipe(Effect.provide(NodeHttpServer.layerTest));
        if (closedAddress._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the probe server did not bind a port"));
        }
        return yield* waitUntilResponds({
          accept: respondedSuccessfully,
          method: "GET",
          onStatus: () => "status",
          onUnreachable: () => "unreachable",
          url: `http://127.0.0.1:${closedAddress.port}/ready`,
        }).pipe(Effect.flip);
      }),
    ));

  it("fails with the value onUnreachable gives instead of onStatus", ({ observedFailure }) => {
    expect(observedFailure).toBe("unreachable");
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
