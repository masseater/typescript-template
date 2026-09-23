import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { lintRuleWorkspacesIn } from "./lint-rule-workspaces.ts";

const DECLARING_MANIFEST = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

layer(NodeServices.layer)("lintRuleWorkspacesIn", (it) => {
  describe("a repository without a workspace definition", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("declares nothing", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([]);
      }),
    );
  });

  describe("a workspace definition that is a bare scalar", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.writeFileString(paths.join(root, "pnpm-workspace.yaml"), "42\n");
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("declares nothing", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([]);
      }),
    );
  });

  describe("an empty workspace definition", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.writeFileString(paths.join(root, "pnpm-workspace.yaml"), "");
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("declares nothing", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([]);
      }),
    );
  });

  describe("a workspace definition that does not parse", () => {
    const failureFixture = Effect.gen(function* failure() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages: [packages/*\n",
      );
      const failure = yield* Effect.flip(lintRuleWorkspacesIn(root));
      return failure._tag === "WorkspaceDefinitionUnparsable"
        ? { _tag: failure._tag, file: failure.file }
        : { _tag: failure._tag };
    });

    it.effect("is raised instead of being skipped", () =>
      Effect.gen(function* program() {
        const failure = yield* failureFixture;
        expect(failure).toStrictEqual({
          _tag: "WorkspaceDefinitionUnparsable",
          file: "pnpm-workspace.yaml",
        });
      }),
    );
  });

  describe("a definition whose packages field is not a list", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.writeFileString(paths.join(root, "pnpm-workspace.yaml"), "packages: 7\n");
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("declares nothing", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([]);
      }),
    );
  });

  describe("a pattern that is not a word standing beside one that is", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - 7\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("is left out while the others expand", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([
          { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] },
        ]);
      }),
    );
  });

  describe("a pattern naming one directory", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "tools/single"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - tools/single\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "tools/single/package.json"),
        DECLARING_MANIFEST,
      );
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("is taken as it stands", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([
          { workspaceDir: "tools/single", ruleDirectories: ["src/rules"] },
        ]);
      }),
    );
  });

  describe("a pattern whose parent directory does not exist", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - missing/*\n",
      );
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("expands to nothing", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([]);
      }),
    );
  });

  describe("a file sitting beside the workspaces", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(paths.join(root, "packages/stray.txt"), "not a workspace");
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("is not taken for one", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([
          { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] },
        ]);
      }),
    );
  });

  describe("a workspace without a manifest", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/readme.md"),
        "no manifest here",
      );
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("declares nothing", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([]);
      }),
    );
  });

  describe("a manifest that is not an object", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/scalar"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(root, "packages/nothing"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(paths.join(root, "packages/scalar/package.json"), "42");
      yield* filesystem.writeFileString(paths.join(root, "packages/nothing/package.json"), "null");
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("declares nothing", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([]);
      }),
    );
  });

  describe("a manifest that cannot be parsed", () => {
    const failureTagFixture = Effect.gen(function* failureTag() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/broken"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/broken/package.json"),
        "{ not json",
      );
      const failure = yield* Effect.flip(lintRuleWorkspacesIn(root));
      return failure._tag;
    });

    it.effect("is raised instead of being skipped", () =>
      Effect.gen(function* program() {
        const failureTag = yield* failureTagFixture;
        expect(failureTag).toBe("SchemaError");
      }),
    );
  });

  describe("a manifest without a lintRules list", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/plain"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(root, "packages/wrong"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/plain/package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: "plain" }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/wrong/package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "wrong",
          lintRules: "src/rules",
        }),
      );
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("declares nothing", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([]);
      }),
    );
  });

  describe("declared directories holding an entry that is not a word", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/mixed"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(root, "packages/hollow"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/mixed/package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          lintRules: [7, "src/rules"],
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/hollow/package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ lintRules: [7] }),
      );
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("drops that entry and keeps the workspace that has words left", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([
          { workspaceDir: "packages/mixed", ruleDirectories: ["src/rules"] },
        ]);
      }),
    );
  });

  describe("two workspaces declared out of order", () => {
    const workspacesFixture = Effect.gen(function* workspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-workspaces-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/zebra"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(root, "packages/alpha"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/zebra/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/alpha/package.json"),
        DECLARING_MANIFEST,
      );
      return yield* lintRuleWorkspacesIn(root);
    });

    it.effect("come back sorted by their directory", () =>
      Effect.gen(function* program() {
        const workspaces = yield* workspacesFixture;
        expect(workspaces).toStrictEqual([
          { workspaceDir: "packages/alpha", ruleDirectories: ["src/rules"] },
          { workspaceDir: "packages/zebra", ruleDirectories: ["src/rules"] },
        ]);
      }),
    );
  });
});
