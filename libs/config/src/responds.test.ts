import { NodeHttpServer } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { respondedSuccessfully, waitUntilResponds } from "./responds.ts";

type Reply = (
  request: HttpServerRequest.HttpServerRequest,
) => Effect.Effect<HttpServerResponse.HttpServerResponse>;

const refused = "connection refused";

function listen(reply: Reply) {
  return Effect.gen(function* listenProgram() {
    const built = yield* Layer.build(NodeHttpServer.layerTest);
    const server = Context.get(built, HttpServer.HttpServer);
    yield* server.serve(
      Effect.gen(function* serveProgram() {
        const incoming = yield* HttpServerRequest.HttpServerRequest;
        return yield* reply(incoming);
      }),
    );
    const address = server.address;
    return address._tag === "TcpAddress"
      ? { url: `http://127.0.0.1:${address.port}/ready` }
      : yield* Effect.die("no port");
  }).pipe(Effect.orDie);
}

function unusedPort() {
  return Effect.scoped(
    Effect.gen(function* unusedPortProgram() {
      const built = yield* Layer.build(NodeHttpServer.layerTest);
      const address = Context.get(built, HttpServer.HttpServer).address;
      return address._tag === "TcpAddress" ? address.port : yield* Effect.die("no port");
    }).pipe(Effect.orDie),
  );
}

it.effect("returns the status when the response is acceptable", () =>
  Effect.gen(function* program() {
    const { url } = yield* listen(() => Effect.succeed(HttpServerResponse.empty({ status: 200 })));
    const status = yield* waitUntilResponds({
      accept: respondedSuccessfully,
      method: "GET",
      onStatus: (rejected) => rejected,
      onUnreachable: () => refused,
      url,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(respondedSuccessfully(199), false);
    assert.strictEqual(respondedSuccessfully(299), true);
    assert.strictEqual(respondedSuccessfully(300), false);
  }).pipe(Effect.scoped),
);

it.effect("accepts an empty successful response", () =>
  Effect.gen(function* program() {
    const { url } = yield* listen(() => Effect.succeed(HttpServerResponse.empty({ status: 204 })));
    const status = yield* waitUntilResponds({
      accept: respondedSuccessfully,
      method: "POST",
      onStatus: (rejected) => rejected,
      onUnreachable: () => refused,
      url,
    });
    assert.strictEqual(status, 204);
  }).pipe(Effect.scoped),
);

it.effect("reports a status that is not acceptable", () =>
  Effect.gen(function* program() {
    const { url } = yield* listen(() =>
      Effect.succeed(HttpServerResponse.text("later", { status: 503 })),
    );
    const status = yield* waitUntilResponds({
      accept: respondedSuccessfully,
      method: "GET",
      onStatus: (rejected) => rejected,
      onUnreachable: () => refused,
      url,
    }).pipe(Effect.flip);
    assert.strictEqual(status, 503);
  }).pipe(Effect.scoped),
);

it.effect("reports a target that never accepts the connection", () =>
  Effect.gen(function* program() {
    const port = yield* unusedPort();
    const reason = yield* waitUntilResponds({
      accept: respondedSuccessfully,
      method: "GET",
      onStatus: () => "status",
      onUnreachable: (error) => (error instanceof Error ? error.name : refused),
      url: `http://127.0.0.1:${port}/ready`,
    }).pipe(Effect.flip);
    assert.notStrictEqual(reason, "status");
  }),
);

it.effect("stops waiting when the response exceeds the timeout", () =>
  Effect.gen(function* program() {
    const { url } = yield* listen(() => Effect.never);
    const reason = yield* waitUntilResponds({
      accept: respondedSuccessfully,
      method: "GET",
      onStatus: () => "status",
      onUnreachable: () => "timed out",
      timeoutMilliseconds: 50,
      url,
    }).pipe(Effect.flip);
    assert.strictEqual(reason, "timed out");
  }).pipe(Effect.scoped),
);

it.live("retries until the target responds successfully", () =>
  Effect.gen(function* program() {
    let attempts = 0;
    const { url } = yield* listen(() => {
      attempts += 1;
      return Effect.succeed(
        HttpServerResponse.text(attempts < 3 ? "later" : "ok", {
          status: attempts < 3 ? 503 : 200,
        }),
      );
    });
    const status = yield* waitUntilResponds({
      accept: respondedSuccessfully,
      method: "GET",
      onStatus: (rejected) => rejected,
      onUnreachable: () => refused,
      retry: { interval: "10 millis", times: 2 },
      url,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(attempts, 3);
  }).pipe(Effect.scoped),
);

it.live("stops after the configured retries are exhausted", () =>
  Effect.gen(function* program() {
    let attempts = 0;
    const { url } = yield* listen(() => {
      attempts += 1;
      return Effect.succeed(HttpServerResponse.text("later", { status: 503 }));
    });
    const status = yield* waitUntilResponds({
      accept: respondedSuccessfully,
      method: "GET",
      onStatus: (rejected) => rejected,
      onUnreachable: () => refused,
      retry: { interval: "10 millis", times: 1 },
      url,
    }).pipe(Effect.flip);
    assert.strictEqual(status, 503);
    assert.strictEqual(attempts, 2);
  }).pipe(Effect.scoped),
);
