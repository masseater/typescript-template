import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { http, passthrough } from "msw";
import { setupServer } from "msw/node";

import { BinaryUnavailable, installBinary } from "./binary.ts";
import { downloadUrl, releases } from "./releases.ts";

const prefix = path.join(tmpdir(), "template-k6-");
const archives = [...releases.values()].map((release) => downloadUrl(release.archive));

const temporaryHome = Effect.acquireRelease(
  Effect.promise(async () => realpath(await mkdtemp(prefix))),
  (home) => Effect.promise(async () => rm(home, { force: true, recursive: true })),
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
    }).pipe(Effect.scoped),
  );
});
