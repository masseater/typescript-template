// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { createServer } from "node:http";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { respondedSuccessfully, waitUntilResponds } from "./responds.ts";

// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import type { IncomingMessage, Server, ServerResponse } from "node:http";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import type { Socket } from "node:net";
import type { Scope } from "effect";

type Reply = (request: IncomingMessage, response: ServerResponse) => void;

interface Listening {
  readonly server: Server;
  readonly sockets: Set<Socket>;
  readonly url: string;
}

const refused = "connection refused";

function listen(reply: Reply): Effect.Effect<Listening, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.callback<Listening>((resume) => {
      const sockets = new Set<Socket>();
      const server = createServer(reply);
      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => {
          sockets.delete(socket);
        });
      });
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        resume(
          typeof address === "object" && address !== null
            ? Effect.succeed({
                server,
                sockets,
                url: `http://127.0.0.1:${address.port}/ready`,
              })
            : Effect.die("no port"),
        );
      });
    }),
    (listening) =>
      Effect.callback<void>((resume) => {
        for (const socket of listening.sockets) {
          socket.destroy();
        }
        listening.server.close(() => {
          resume(Effect.void);
        });
      }),
  );
}

it.effect("returns the status when the response is acceptable", () =>
  Effect.gen(function* program() {
    const { url } = yield* listen((_request, response) => {
      response.writeHead(200);
      response.end("ok");
    });
    const status = yield* waitUntilResponds<number | string>({
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
    const { url } = yield* listen((_request, response) => {
      response.writeHead(204);
      response.end();
    });
    const status = yield* waitUntilResponds<number | string>({
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
    const { url } = yield* listen((_request, response) => {
      response.writeHead(503);
      response.end("later");
    });
    const status = yield* waitUntilResponds<number | string>({
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
    const port = yield* Effect.promise(async () => {
      const server = createServer();
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          resolve();
        });
      });
      const address = server.address();
      const chosen = typeof address === "object" && address !== null ? address.port : 0;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
      return chosen;
    });
    const reason = yield* waitUntilResponds<string>({
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
    const { url } = yield* listen(() => undefined);
    const reason = yield* waitUntilResponds<string>({
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
    const { url } = yield* listen((_request, response) => {
      attempts += 1;
      response.writeHead(attempts < 3 ? 503 : 200);
      response.end(attempts < 3 ? "later" : "ok");
    });
    const status = yield* waitUntilResponds<number | string>({
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
    const { url } = yield* listen((_request, response) => {
      attempts += 1;
      response.writeHead(503);
      response.end("later");
    });
    const status = yield* waitUntilResponds<number | string>({
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
