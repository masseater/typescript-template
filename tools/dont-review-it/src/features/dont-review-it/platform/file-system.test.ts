import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { pathExists, textOrNull } from "./file-system.ts";

layer(NodeServices.layer)("textOrNull", (it) => {
  describe("a file that exists", () => {
    const presentFileTextFixture = Effect.gen(function* presentFileText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "read-text-" });

      yield* filesystem.writeFileString(paths.join(root, "present.txt"), "written");
      return yield* textOrNull(paths.join(root, "present.txt"));
    });

    it.effect("hands back its text", () =>
      Effect.gen(function* program() {
        const presentFileText = yield* presentFileTextFixture;
        expect(presentFileText).toBe("written");
      }),
    );
  });

  describe("a file that does not exist", () => {
    const missingFileTextFixture = Effect.gen(function* missingFileText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "read-text-" });
      return yield* textOrNull(paths.join(root, "read-text-absent", "missing.txt"));
    });

    it.effect("is an absence", () =>
      Effect.gen(function* program() {
        const missingFileText = yield* missingFileTextFixture;
        expect(missingFileText).toBe(null);
      }),
    );
  });
});

layer(NodeServices.layer)("pathExists", (it) => {
  describe("paths around a file", () => {
    const answersFixture = Effect.gen(function* answers() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "path-exists-" });
      yield* filesystem.writeFileString(paths.join(root, "present.txt"), "written");
      return {
        present: yield* pathExists(paths.join(root, "present.txt")),
        absent: yield* pathExists(paths.join(root, "absent.txt")),
        belowAFile: yield* pathExists(paths.join(root, "present.txt", "inner.txt")),
      };
    });

    it.effect("finds the file and calls both a missing name and a name below the file absent", () =>
      Effect.gen(function* program() {
        expect(yield* answersFixture).toStrictEqual({
          present: true,
          absent: false,
          belowAFile: false,
        });
      }),
    );
  });
});
