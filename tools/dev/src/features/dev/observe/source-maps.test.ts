import { assert, it } from "@effect/vitest";
import { sourceMapDirectories } from "@repo/vite-config/source-maps";
import { Effect, FileSystem, Path } from "effect";

import { layer } from "../platform.ts";
import { symbolicate } from "./source-maps.ts";

const release = "0".repeat(16);

function sourceMap(source: string): string {
  return JSON.stringify({
    mappings: "AAAA;AAEEA",
    names: ["check"],
    sources: [source],
    version: 3,
  });
}

const writeReleaseMaps = Effect.fn("writeReleaseMaps")(function* writeReleaseMaps(root: string) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const directory = path.join(sourceMapDirectories(root, "service-member").releases, release);
  yield* fs.makeDirectory(path.join(directory, "client/assets"), { recursive: true });
  yield* fs.makeDirectory(path.join(directory, "server/assets"), { recursive: true });
  yield* fs.writeFileString(
    path.join(directory, "client/assets/index-abc.js.map"),
    sourceMap("../../../../../libs/ui/src/features/ui/form.tsx"),
  );
  yield* fs.writeFileString(
    path.join(directory, "server/assets/auth-def.js.map"),
    sourceMap("../../../../../libs/auth/src/features/auth/index.ts"),
  );
});

const temporaryRoot = Effect.acquireRelease(
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) =>
      fs
        .makeTempDirectory({ prefix: "template-symbolicate-" })
        .pipe(Effect.flatMap((root) => fs.realPath(root))),
    ),
  ),
  (root) =>
    FileSystem.FileSystem.pipe(
      Effect.flatMap((fs) => fs.remove(root, { recursive: true })),
      Effect.ignore,
    ),
);

const expectedFrames: unknown[] = [
  {
    column: 5,
    line: 3,
    location: "/assets/index-abc.js:2:3",
    name: "check",
    resolved: true,
    source: "libs/ui/src/features/ui/form.tsx",
  },
  {
    column: 3,
    line: 3,
    location: "auth-def.js:2:1",
    name: "check",
    resolved: true,
    source: "libs/auth/src/features/auth/index.ts",
  },
  { location: "/assets/index-abc.js:9:9", reason: "mapping_missing", resolved: false },
  { location: "missing.js:1:1", reason: "source_map_missing", resolved: false },
  { location: "private@example.com", reason: "location_invalid", resolved: false },
];

it.effect("stack locations resolve to repository sources through the release's private maps", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    yield* writeReleaseMaps(root);
    const frames = yield* symbolicate({ app: "service-member", release, repositoryRoot: root }, [
      "/assets/index-abc.js:2:3",
      "auth-def.js:2:1",
      "/assets/index-abc.js:9:9",
      "missing.js:1:1",
      "private@example.com",
    ]);
    assert.deepStrictEqual<unknown>(frames, expectedFrames);
  }).pipe(Effect.scoped, Effect.provide(layer)),
);
