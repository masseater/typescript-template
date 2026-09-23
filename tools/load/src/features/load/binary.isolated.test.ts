import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { http, passthrough } from "msw";
import { setupServer } from "msw/node";

import { BinaryUnavailable, installBinary } from "./binary.ts";
import { downloadUrl, releases } from "./releases.ts";

const archives = [...releases.values()].map((release) => downloadUrl(release.archive));

const temporaryHome = Effect.acquireRelease(
  Effect.gen(function* createTemporaryHome() {
    const filesystem = yield* FileSystem.FileSystem;
    const temporaryDirectory = yield* filesystem.makeTempDirectory({ prefix: "template-k6-" });
    return yield* filesystem.realPath(temporaryDirectory);
  }).pipe(Effect.orDie),
  (home) =>
    Effect.gen(function* removeTemporaryHome() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.remove(home, { force: true, recursive: true });
    }).pipe(Effect.orDie),
);

const tamperedArchives = Effect.acquireRelease(
  Effect.sync(() => {
    const server = setupServer(
      ...archives.map((url) =>
        http.get(url, () => new Response(new Uint8Array([0]), { status: 200 })),
      ),
      http.all("*", () => passthrough()),
    );
    server.listen({ onUnhandledRequest: "bypass" });
    return server;
  }),
  (server) =>
    Effect.sync(() => {
      server.close();
    }),
);

describe("the pinned k6 binary", () => {
  it.effect("refuses an archive whose digest does not match the pinned one", () =>
    Effect.gen(function* program() {
      const home = yield* temporaryHome;
      yield* tamperedArchives;
      const failure = yield* installBinary(home).pipe(Effect.flip);
      assert.instanceOf(failure, BinaryUnavailable);
      assert.strictEqual(failure.reason, "archive_corrupted");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
