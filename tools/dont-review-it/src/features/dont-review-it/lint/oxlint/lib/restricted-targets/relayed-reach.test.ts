import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { path } from "../../../../platform/path.ts";
import { restrictedTargetReachedBy } from "./relayed-reach.ts";

import type { RestrictedTargetEntry } from "./restricted-entries.ts";

const RETIRED_LIB: RestrictedTargetEntry = {
  module: "retired-lib",
  exports: [],
  allowedPositions: [],
  substitute: "Read the same value through the reader this package owns.",
};

layer(NodeServices.layer)("restrictedTargetReachedBy", (it) => {
  describe("a specifier that resolves to no file in the repository", () => {
    const it = test.extend("reach", () =>
      restrictedTargetReachedBy({
        specifier: "./never-written-relay.ts",
        fromFile: path.resolve("/repository", "reader.ts"),
        policy: { workspaceRoot: path.resolve("/repository"), entries: [], aliases: [] },
      }));

    it("reaches no restricted target", ({ reach }) => {
      expect(reach).toBe(null);
    });
  });

  describe("a published path the package never wrote", () => {
    const it = test.extend("reach", () =>
      restrictedTargetReachedBy({
        specifier: "@repo/dont-review-it/tsconfig/*",
        fromFile: path.resolve(import.meta.dirname, "relayed-reach.ts"),
        policy: {
          workspaceRoot: path.resolve(
            import.meta.dirname,
            "..",
            "..",
            "..",
            "..",
            "..",
            "..",
            "..",
          ),
          entries: [],
          aliases: [],
        },
      }));

    it("reaches no restricted target", ({ reach }) => {
      expect(reach).toBe(null);
    });
  });

  describe("a local module that forwards the restricted target", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "one-relay");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { readFile } from "./relay.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "relay.ts"),
          'export { readFile } from "retired-lib";\n',
        );
        return restrictedTargetReachedBy({
          specifier: "./relay.ts",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("is reached through it", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toStrictEqual({
          entry: RETIRED_LIB,
          target: "retired-lib",
          relays: ["src/relay.ts"],
        });
      }),
    );
  });

  describe("a target reached through two modules", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "two-relays");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { readFile } from "./first.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "first.ts"),
          'export * from "./second.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "second.ts"),
          'export * from "retired-lib";\n',
        );
        return restrictedTargetReachedBy({
          specifier: "./first.ts",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("names every module walked through on the way", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toStrictEqual({
          entry: RETIRED_LIB,
          target: "retired-lib",
          relays: ["src/first.ts", "src/second.ts"],
        });
      }),
    );
  });

  describe("a module that forwards several modules", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "mixed-relay");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { readFile } from "./relay.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "relay.ts"),
          'export { join } from "node:path";\nexport { readFile } from "retired-lib";\n',
        );
        return restrictedTargetReachedBy({
          specifier: "./relay.ts",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("has its restricted forward picked out", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toStrictEqual({
          entry: RETIRED_LIB,
          target: "retired-lib",
          relays: ["src/relay.ts"],
        });
      }),
    );
  });

  describe("an internal alias prefix", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "aliased-relay");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { readFile } from "~/relay.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "relay.ts"),
          'export * from "retired-lib";\n',
        );
        return restrictedTargetReachedBy({
          specifier: "~/relay.ts",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: {
            workspaceRoot: root,
            entries: [RETIRED_LIB],
            aliases: [{ prefix: "~/", directory: "src" }],
          },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("is followed to the directory it stands for", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toStrictEqual({
          entry: RETIRED_LIB,
          target: "retired-lib",
          relays: ["src/relay.ts"],
        });
      }),
    );
  });

  describe("a module that forwards no restricted target", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "plain-relay");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { join } from "./relay.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "relay.ts"),
          'export { join } from "node:path";\n',
        );
        return restrictedTargetReachedBy({
          specifier: "./relay.ts",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("reaches nothing", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toBe(null);
      }),
    );
  });

  describe("a module already walked through", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "cycle");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { readFile } from "./first.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "first.ts"),
          'export * from "./second.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "second.ts"),
          'export * from "./first.ts";\n',
        );
        return restrictedTargetReachedBy({
          specifier: "./first.ts",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("stops the walk", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toBe(null);
      }),
    );
  });

  describe("a specifier that names no module in the repository", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "named-outright");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { readFile } from "retired-lib";\n',
        );
        return restrictedTargetReachedBy({
          specifier: "retired-lib",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("reaches nothing", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toBe(null);
      }),
    );
  });

  describe("a public entry a package declares but does not carry on disk", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "unbuilt-entry");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.makeDirectory(paths.join(root, "packages", "relay"), { recursive: true });
        yield* filesystem.makeDirectory(paths.join(root, "node_modules", "@fixture"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { readFile } from "@fixture/relay";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "packages", "relay", "package.json"),
          '{"name":"@fixture/relay","exports":{".":{"import":"./built.ts","default":"./relay.ts"}}}',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "packages", "relay", "relay.ts"),
          'export * from "retired-lib";\n',
        );
        yield* filesystem.symlink(
          paths.join(root, "packages", "relay"),
          paths.join(root, "node_modules", "@fixture", "relay"),
        );
        return restrictedTargetReachedBy({
          specifier: "@fixture/relay",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("is walked past", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toStrictEqual({
          entry: RETIRED_LIB,
          target: "retired-lib",
          relays: ["packages/relay/relay.ts"],
        });
      }),
    );
  });

  describe("a relay rewritten after it was walked once", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-relayed-reach-",
      });
      const reach = yield* Effect.gen(function* reach() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "remembered");

        yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "index.ts"),
          'import { readFile } from "./relay.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "src", "relay.ts"),
          'export * from "retired-lib";\n',
        );
        restrictedTargetReachedBy({
          specifier: "./relay.ts",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
        yield* filesystem.writeFileString(
          paths.join(root, "src", "relay.ts"),
          'export { join } from "node:path";\n',
        );
        return restrictedTargetReachedBy({
          specifier: "./relay.ts",
          fromFile: paths.join(root, "src", "index.ts"),
          policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
        });
      });
      return { fixtureRoot, reach };
    });

    it.effect("keeps the forwards read the first time it was walked", () =>
      Effect.gen(function* program() {
        const { reach } = yield* fixtures;
        expect(reach).toStrictEqual({
          entry: RETIRED_LIB,
          target: "retired-lib",
          relays: ["src/relay.ts"],
        });
      }),
    );
  });
});
