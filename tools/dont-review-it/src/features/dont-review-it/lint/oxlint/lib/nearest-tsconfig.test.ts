import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { extendsOneOf, nearestTsconfigExtends } from "./nearest-tsconfig.ts";

const LIBRARY_PRESET = "dont-review-it/tsconfig/library.json";

const APP_PRESET = "dont-review-it/tsconfig/app.json";

layer(NodeServices.layer)("nearestTsconfigExtends", (it) => {
  describe("a tsconfig carrying a single extends entry", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const extendsRead = yield* Effect.gen(function* extendsRead() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(workspaceRoot, "single");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(directory, "tsconfig.json"),
          '{ "extends": "./preset.json" }\n',
        );
        return nearestTsconfigExtends(paths.join(directory, "index.ts"));
      });
      return { workspaceRoot, extendsRead };
    });

    it.effect("reads it as a list of one beside the path it was read from", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { extendsRead, workspaceRoot } = yield* fixtures;
        expect(extendsRead).toStrictEqual({
          tsconfigPath: paths.join(workspaceRoot, "single", "tsconfig.json"),
          specifiers: ["./preset.json"],
        });
      }),
    );
  });

  describe("a tsconfig carrying several extends entries", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const specifiers = yield* Effect.gen(function* specifiers() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(workspaceRoot, "several");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(directory, "tsconfig.json"),
          '{ "extends": ["./first.json", "./second.json"] }\n',
        );
        const read = nearestTsconfigExtends(paths.join(directory, "index.ts"));
        return read === null ? null : read.specifiers;
      });
      return { workspaceRoot, specifiers };
    });

    it.effect("keeps every entry in the order they were written", () =>
      Effect.gen(function* program() {
        const { specifiers } = yield* fixtures;
        expect(specifiers).toStrictEqual(["./first.json", "./second.json"]);
      }),
    );
  });

  describe("a tsconfig whose extends array mixes texts with other values", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const specifiers = yield* Effect.gen(function* specifiers() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(workspaceRoot, "mixed");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(directory, "tsconfig.json"),
          '{ "extends": ["./first.json", 7, null] }\n',
        );
        const read = nearestTsconfigExtends(paths.join(directory, "index.ts"));
        return read === null ? null : read.specifiers;
      });
      return { workspaceRoot, specifiers };
    });

    it.effect("drops the entries that are not strings", () =>
      Effect.gen(function* program() {
        const { specifiers } = yield* fixtures;
        expect(specifiers).toStrictEqual(["./first.json"]);
      }),
    );
  });

  describe("a tsconfig carrying comments and a trailing comma", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const specifiers = yield* Effect.gen(function* specifiers() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(workspaceRoot, "jsonc");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(directory, "tsconfig.json"),
          '{\n  // the preset\n  "extends": "./preset.json",\n}\n',
        );
        const read = nearestTsconfigExtends(paths.join(directory, "index.ts"));
        return read === null ? null : read.specifiers;
      });
      return { workspaceRoot, specifiers };
    });

    it.effect("reads it all the same", () =>
      Effect.gen(function* program() {
        const { specifiers } = yield* fixtures;
        expect(specifiers).toStrictEqual(["./preset.json"]);
      }),
    );
  });

  describe("a tsconfig without an extends field", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const specifiers = yield* Effect.gen(function* specifiers() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(workspaceRoot, "bare");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "strict": true } }\n',
        );
        const read = nearestTsconfigExtends(paths.join(directory, "index.ts"));
        return read === null ? null : read.specifiers;
      });
      return { workspaceRoot, specifiers };
    });

    it.effect("reports no specifier", () =>
      Effect.gen(function* program() {
        const { specifiers } = yield* fixtures;
        expect(specifiers).toStrictEqual([]);
      }),
    );
  });

  describe("a tsconfig that cannot be read as JSON", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const specifiers = yield* Effect.gen(function* specifiers() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(workspaceRoot, "broken");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(paths.join(directory, "tsconfig.json"), "{ not json\n");
        const read = nearestTsconfigExtends(paths.join(directory, "index.ts"));
        return read === null ? null : read.specifiers;
      });
      return { workspaceRoot, specifiers };
    });

    it.effect("reports no specifier", () =>
      Effect.gen(function* program() {
        const { specifiers } = yield* fixtures;
        expect(specifiers).toStrictEqual([]);
      }),
    );
  });

  describe("a source sitting deeper than the tsconfig above it", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const extendsRead = yield* Effect.gen(function* extendsRead() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(workspaceRoot, "nested");
        yield* filesystem.makeDirectory(paths.join(directory, "src", "deep"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(directory, "tsconfig.json"),
          '{ "extends": "./preset.json" }\n',
        );
        return nearestTsconfigExtends(paths.join(directory, "src", "deep", "index.ts"));
      });
      return { workspaceRoot, extendsRead };
    });

    it.effect("walks up until it meets a tsconfig", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { extendsRead, workspaceRoot } = yield* fixtures;
        expect(extendsRead).toStrictEqual({
          tsconfigPath: paths.join(workspaceRoot, "nested", "tsconfig.json"),
          specifiers: ["./preset.json"],
        });
      }),
    );
  });

  describe("a source with a tsconfig beside it and another one further up", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const specifiers = yield* Effect.gen(function* specifiers() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const outer = paths.join(workspaceRoot, "outer");
        yield* filesystem.makeDirectory(paths.join(outer, "inner"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(outer, "tsconfig.json"),
          '{ "extends": "./outer.json" }\n',
        );
        yield* filesystem.writeFileString(
          paths.join(outer, "inner", "tsconfig.json"),
          '{ "extends": "./inner.json" }\n',
        );
        const read = nearestTsconfigExtends(paths.join(outer, "inner", "index.ts"));
        return read === null ? null : read.specifiers;
      });
      return { workspaceRoot, specifiers };
    });

    it.effect("stops at the nearest tsconfig instead of the outermost one", () =>
      Effect.gen(function* program() {
        const { specifiers } = yield* fixtures;
        expect(specifiers).toStrictEqual(["./inner.json"]);
      }),
    );
  });

  describe("a tsconfig removed after it was read once", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "nearest-tsconfig-" });

        return root;
      });
      const specifiers = yield* Effect.gen(function* specifiers() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(workspaceRoot, "remembered");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(directory, "tsconfig.json"),
          '{ "extends": "./preset.json" }\n',
        );
        nearestTsconfigExtends(paths.join(directory, "index.ts"));
        yield* filesystem.remove(paths.join(directory, "tsconfig.json"));
        const read = nearestTsconfigExtends(paths.join(directory, "index.ts"));
        return read === null ? null : read.specifiers;
      });
      return { workspaceRoot, specifiers };
    });

    it.effect("still answers, because the reading is remembered", () =>
      Effect.gen(function* program() {
        const { specifiers } = yield* fixtures;
        expect(specifiers).toStrictEqual(["./preset.json"]);
      }),
    );
  });
});

describe("extendsOneOf", () => {
  describe("a package specifier naming an allowed preset", () => {
    const it = test.extend("verdict", () =>
      extendsOneOf(["@repo/dont-review-it/tsconfig/library.json"], [LIBRARY_PRESET]));

    it("matches it by the tail that names the preset file", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a relative specifier reaching the same file", () => {
    const it = test.extend("verdict", () =>
      extendsOneOf(["../dont-review-it/tsconfig/library.json"], [LIBRARY_PRESET]));

    it("matches it", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a list where only one entry names an allowed preset", () => {
    const it = test.extend("verdict", () =>
      extendsOneOf(
        ["./local.json", "@repo/dont-review-it/tsconfig/app.json"],
        [LIBRARY_PRESET, APP_PRESET],
      ));

    it("accepts it", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a preset of the same name owned by somebody else", () => {
    const it = test.extend("verdict", () =>
      extendsOneOf(["@other/tsconfig/library.json"], [LIBRARY_PRESET]));

    it("rejects it", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("an empty list of specifiers", () => {
    const it = test.extend("verdict", () => extendsOneOf([], [LIBRARY_PRESET]));

    it("rejects it", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});
