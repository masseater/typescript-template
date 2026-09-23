import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { attempt } from "es-toolkit";
import { describe, expect } from "vite-plus/test";

import { path } from "../../../../platform/path.ts";
import { readJsonFile } from "./read-json-file.ts";

layer(NodeServices.layer)("readJsonFile", (it) => {
  describe("a manifest that parses", () => {
    const fixture = Effect.gen(function* manifest() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "read-json-file-" });

      yield* filesystem.writeFileString(paths.join(root, "package.json"), '{ "name": "order" }');
      return readJsonFile(paths.join(root, "package.json"));
    });

    it.effect("hands back what it declares", () =>
      Effect.gen(function* program() {
        const manifest = yield* fixture;
        expect(manifest).toStrictEqual({ name: "order" });
      }),
    );
  });

  describe("a manifest that is not there", () => {
    const fixture = Effect.gen(function* manifest() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "read-json-file-" });

      return readJsonFile(paths.join(root, "package.json"));
    });

    it.effect("is an absence", () =>
      Effect.gen(function* program() {
        const manifest = yield* fixture;
        expect(manifest).toBe(null);
      }),
    );
  });

  describe("a manifest cut short", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const truncatedJsonDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "read-json-file-truncated-",
      });
      const failureMessage = yield* Effect.gen(function* failureMessage() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        yield* filesystem.makeDirectory(truncatedJsonDirectory, { recursive: true });

        yield* filesystem.writeFileString(
          paths.join(truncatedJsonDirectory, "package.json"),
          '{ "name": ',
        );
        const [failure] = attempt<unknown, Error>(() =>
          readJsonFile(path.join(truncatedJsonDirectory, "package.json")),
        );
        return failure === null ? null : failure.message;
      });
      return { truncatedJsonDirectory, failureMessage };
    });

    it.effect("is raised rather than reported as absent", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { failureMessage, truncatedJsonDirectory } = yield* fixtures;
        expect(failureMessage).toBe(
          `${paths.join(truncatedJsonDirectory, "package.json")} exists but does not parse as JSON`,
        );
      }),
    );
  });

  describe("a manifest holding text that is no JSON at all", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const foreignTextDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "read-json-file-foreign-text-",
      });
      const failureMessage = yield* Effect.gen(function* failureMessage() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        yield* filesystem.makeDirectory(foreignTextDirectory, { recursive: true });

        yield* filesystem.writeFileString(
          paths.join(foreignTextDirectory, "package.json"),
          "not json at all",
        );
        const [failure] = attempt<unknown, Error>(() =>
          readJsonFile(path.join(foreignTextDirectory, "package.json")),
        );
        return failure === null ? null : failure.message;
      });
      return { foreignTextDirectory, failureMessage };
    });

    it.effect("is raised the same way", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { failureMessage, foreignTextDirectory } = yield* fixtures;
        expect(failureMessage).toBe(
          `${paths.join(foreignTextDirectory, "package.json")} exists but does not parse as JSON`,
        );
      }),
    );
  });
});
