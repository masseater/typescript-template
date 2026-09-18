import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { nodeServer } from "./node-server.ts";

const timeout = 30_000;

async function cloned(incoming: Request): Promise<Response> {
  const copy = new Request(incoming);
  return Response.json({
    body: await copy.text(),
    method: copy.method,
    tag: copy.headers.get("x-tag") ?? "",
  });
}

const listening = Effect.gen(function* listening() {
  const files = yield* FileSystem.FileSystem;
  const staticDirectory = yield* files.makeTempDirectoryScoped({ prefix: "commander-static-" });
  yield* files.writeFileString(`${staticDirectory}/hello.txt`, "static");
  const server = yield* Effect.acquireRelease(
    Effect.promise(async () =>
      nodeServer({ fetch: cloned, hostname: "127.0.0.1", port: 0, staticDirectory }).ready(),
    ),
    (running) => Effect.promise(async () => running.close(true)),
  );
  return new URL(server.url ?? "");
});

function answered(reply: Response): Effect.Effect<unknown> {
  return Effect.promise(async (): Promise<unknown> => reply.json());
}

it.effect(
  "shared code can clone a request that arrived through the node server, with its method, headers and body",
  () =>
    Effect.gen(function* program() {
      const base = yield* listening;
      const reply = yield* Effect.promise(async () =>
        fetch(new URL("/api/chat", base), {
          body: "こんにちは",
          headers: { "x-tag": "from-the-browser" },
          method: "POST",
        }),
      );
      assert.deepStrictEqual(yield* answered(reply), {
        body: "こんにちは",
        method: "POST",
        tag: "from-the-browser",
      });
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "a request without a body stays without one, and built files are served before the handler",
  () =>
    Effect.gen(function* program() {
      const base = yield* listening;
      const page = yield* Effect.promise(async () => fetch(new URL("/", base)));
      assert.deepStrictEqual(yield* answered(page), { body: "", method: "GET", tag: "" });
      const file = yield* Effect.promise(async () => fetch(new URL("/hello.txt", base)));
      assert.strictEqual(yield* Effect.promise(async () => file.text()), "static");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);
