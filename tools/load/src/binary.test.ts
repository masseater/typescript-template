import { BinaryUnavailable, installBinary } from "./binary.ts";
import { assert, describe, it } from "@effect/vitest";
import { downloadUrl, releases } from "./releases.ts";
import { http, passthrough } from "msw";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { Effect } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { setupServer } from "msw/node";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const prefix = path.join(tmpdir(), "template-k6-");
const archives = [...releases.values()].map((release) => downloadUrl(release.archive));

async function temporaryDirectory(): Promise<string> {
  const created = await mkdtemp(prefix);
  return realpath(created);
}

const temporaryHome = Effect.acquireRelease(Effect.promise(temporaryDirectory), (home) =>
  Effect.promise(async () => rm(home, { force: true, recursive: true })),
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
