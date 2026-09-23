import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { isNotFound, isSystemError, modeAllowsGroupOrOther } from "./file-system.ts";

const missingFileVerdicts = Effect.gen(function* readMissingFile() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const directory = yield* filesystem.makeTempDirectoryScoped({ prefix: "cli-file-system-" });
  const readFailure = yield* filesystem
    .readFileString(paths.join(directory, "absent.json"))
    .pipe(Effect.flip);
  return {
    alreadyExists: isSystemError(readFailure, "AlreadyExists"),
    notFound: isNotFound(readFailure),
  };
}).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

describe("a read of a file that does not exist", () => {
  it.effect("is a missing file and no other system error", () =>
    Effect.gen(function* program() {
      const verdicts = yield* missingFileVerdicts;
      assert.deepStrictEqual(verdicts, { alreadyExists: false, notFound: true });
    }),
  );
});

describe("file modes with and without group or other bits", () => {
  it.effect("allow access only when those bits are set", () =>
    Effect.gen(function* program() {
      const allowed = yield* Effect.sync(() =>
        [0o600, 0o640, 0o604].map((fileMode) => modeAllowsGroupOrOther(fileMode)),
      );
      assert.deepStrictEqual(allowed, [false, true, true]);
    }),
  );
});
