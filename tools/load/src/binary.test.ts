import { BinaryUnavailable, installBinary } from "./binary.ts";
import { assert, describe, it } from "@effect/vitest";
import { downloadUrl, releases, version } from "./releases.ts";
import { http, passthrough } from "msw";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { Effect } from "effect";
import { expect } from "vite-plus/test";
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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

  it("names one release per supported platform of the version it installs", () => {
    expect.hasAssertions();
    expect([...releases.keys()].toSorted()).toStrictEqual([
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
    ]);
    expect([...releases.values()].map((found) => found.archive.includes(version))).toStrictEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(
      [...releases.values()].map((found) => /^[0-9a-f]{64}$/u.test(found.digest)),
    ).toStrictEqual([true, true, true, true]);
  });
});
