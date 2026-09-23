import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  sandboxUnsafeReasons,
  sandboxUnsafeTestPattern,
  sandboxUnsafeTests,
} from "./stryker-sandbox.ts";
import configuration from "./stryker.ts";

const qualityDirectory = fileURLToPath(new URL(".", import.meta.url));

const REPOSITORY_DIRECTORY = "tools/dont-review-it/src/features/dont-review-it/repository";

const qualityFiles = Effect.gen(function* qualityFiles() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.readDirectory(qualityDirectory);
});

const onDiskSandboxUnsafe = Effect.map(qualityFiles, (files) =>
  files
    .filter((file) => file.endsWith(".sandbox-unsafe.test.ts"))
    .map((file) => `${REPOSITORY_DIRECTORY}/${file}`)
    .toSorted(),
);

const unmarkedSandboxUnsafe = Effect.gen(function* unmarkedSandboxUnsafe() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const candidates = (yield* qualityFiles).filter(
    (file) => file.endsWith(".test.ts") && !file.endsWith(".sandbox-unsafe.test.ts"),
  );
  const unmarked = yield* Effect.filter(candidates, (file) =>
    Effect.map(filesystem.readFileString(paths.join(qualityDirectory, file)), (source) =>
      sandboxUnsafeReasons.some((reason) => source.includes(reason)),
    ),
  );
  return unmarked.map((file) => `${REPOSITORY_DIRECTORY}/${file}`).toSorted();
});

describe("stryker sandbox unsafe tests", () => {
  it("derives ignorePatterns from the sandbox-unsafe test name", () => {
    expect.hasAssertions();
    expect(configuration.ignorePatterns).toContain(sandboxUnsafeTestPattern);
  });

  it("lists every sandbox-unsafe test beside the pattern", () =>
    Effect.runPromise(
      Effect.gen(function* sandboxUnsafeListed() {
        expect.hasAssertions();
        expect(yield* onDiskSandboxUnsafe).toStrictEqual([...sandboxUnsafeTests].toSorted());
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("marks every test that needs the real repository layout", () =>
    Effect.runPromise(
      Effect.gen(function* sandboxUnsafeMarked() {
        expect.hasAssertions();
        expect(yield* unmarkedSandboxUnsafe).toStrictEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});
