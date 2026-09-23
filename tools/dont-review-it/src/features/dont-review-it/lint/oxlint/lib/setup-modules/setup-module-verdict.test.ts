import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { setupModuleReachedBy, spelledPathOf } from "./setup-module-verdict.ts";

layer(NodeServices.layer)("spelledPathOf", (it) => {
  describe("a file outside the workspace", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const directoryOutsideAnyPackage = yield* Effect.gen(function* directoryOutsideAnyPackage() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "setup-modules-verdict-",
        });

        return root;
      });
      const spelledPath = spelledPathOf({
        file: paths.join(directoryOutsideAnyPackage, "held.ts"),
        workspaceRoot: "/elsewhere",
      });
      return { directoryOutsideAnyPackage, spelledPath };
    });

    it.effect("is spelled by the whole path to it", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { spelledPath, directoryOutsideAnyPackage } = yield* fixtures;
        expect(spelledPath).toBe(paths.join(directoryOutsideAnyPackage, "held.ts"));
      }),
    );
  });
});

layer(NodeServices.layer)("setupModuleReachedBy", (it) => {
  describe("a module belonging to no package at all", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const directoryOutsideAnyPackage = yield* Effect.gen(function* directoryOutsideAnyPackage() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "setup-modules-verdict-",
        });

        return root;
      });
      const verdictOnForbiddenName = yield* Effect.gen(function* verdictOnForbiddenName() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        yield* filesystem.writeFileString(
          paths.join(directoryOutsideAnyPackage, "helpers.ts"),
          "export const build = () => 1;\n",
        );
        return setupModuleReachedBy({
          specifier: "./helpers.ts",
          fromFile: paths.join(directoryOutsideAnyPackage, "loose.test.ts"),
          policy: {
            workspaceRoot: "/elsewhere",
            namePatterns: ["*helper*"],
            allowedPackageSpecifiers: [],
            assetsNameMarkers: new Set(["assets"]),
          },
        });
      });
      return { directoryOutsideAnyPackage, verdictOnForbiddenName };
    });

    it.effect("is judged by its name alone", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { verdictOnForbiddenName, directoryOutsideAnyPackage } = yield* fixtures;
        expect(verdictOnForbiddenName).toStrictEqual({
          path: paths.join(directoryOutsideAnyPackage, "helpers.ts"),
          relays: [],
          reason: "forbiddenName",
        });
      }),
    );
  });

  describe("a module belonging to no package and named as nothing in particular", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const directoryOutsideAnyPackage = yield* Effect.gen(function* directoryOutsideAnyPackage() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "setup-modules-verdict-",
        });

        return root;
      });
      const verdictOnNeutralName = yield* Effect.gen(function* verdictOnNeutralName() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        yield* filesystem.writeFileString(
          paths.join(directoryOutsideAnyPackage, "neutral.ts"),
          "export const held = () => 1;\n",
        );
        return setupModuleReachedBy({
          specifier: "./neutral.ts",
          fromFile: paths.join(directoryOutsideAnyPackage, "loose.test.ts"),
          policy: {
            workspaceRoot: "/elsewhere",
            namePatterns: ["*helper*"],
            allowedPackageSpecifiers: [],
            assetsNameMarkers: new Set(["assets"]),
          },
        });
      });
      return { directoryOutsideAnyPackage, verdictOnNeutralName };
    });

    it.effect("is left undecided", () =>
      Effect.gen(function* program() {
        const { verdictOnNeutralName } = yield* fixtures;
        expect(verdictOnNeutralName).toBe(null);
      }),
    );
  });
});
