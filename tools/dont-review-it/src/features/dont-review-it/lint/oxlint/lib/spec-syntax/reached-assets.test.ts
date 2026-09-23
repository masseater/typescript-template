import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { assetsReachedBy } from "./reached-assets.ts";

layer(NodeServices.layer)("assetsReachedBy", (it) => {
  describe("a specifier naming test data beside the reader", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "beside");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "owner", "order.assets.ts"),
          "export const rows = [1];\n",
        );
        return assetsReachedBy({
          specifier: "./order.assets.ts",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("reaches that file", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { reachedFile, reachedAssetsRoot } = yield* fixtures;
        expect(reachedFile).toBe(
          pathService.join(reachedAssetsRoot, "beside", "repo", "owner", "order.assets.ts"),
        );
      }),
    );
  });

  describe("a specifier naming a relay", () => {
    describe("read for the first time", () => {
      const fixtures = Effect.gen(function* fixtures() {
        const filesystem = yield* FileSystem.FileSystem;
        const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-reached-assets-",
        });
        const reachedFile = yield* Effect.gen(function* reachedFile() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const root = pathService.join(reachedAssetsRoot, "relay-first");
          yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            pathService.join(root, "repo", "owner", "order.assets.ts"),
            "export const rows = [1];\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "repo", "owner", "relay.ts"),
            'export * from "./order.assets.ts";\n',
          );
          return assetsReachedBy({
            specifier: "./relay.ts",
            fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
            workspaceRoot: pathService.join(root, "repo"),
            markers: new Set(["assets"]),
          });
        });
        return { reachedAssetsRoot, reachedFile };
      });

      it.effect("reaches the test data behind it", () =>
        Effect.gen(function* program() {
          const pathService = yield* Path.Path;
          const { reachedFile, reachedAssetsRoot } = yield* fixtures;
          expect(reachedFile).toBe(
            pathService.join(reachedAssetsRoot, "relay-first", "repo", "owner", "order.assets.ts"),
          );
        }),
      );
    });

    describe("read a second time", () => {
      const fixtures = Effect.gen(function* fixtures() {
        const filesystem = yield* FileSystem.FileSystem;
        const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-reached-assets-",
        });
        const reachedFile = yield* Effect.gen(function* reachedFile() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const root = pathService.join(reachedAssetsRoot, "relay-second");
          yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            pathService.join(root, "repo", "owner", "order.assets.ts"),
            "export const rows = [1];\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "repo", "owner", "relay.ts"),
            'export * from "./order.assets.ts";\n',
          );
          assetsReachedBy({
            specifier: "./relay.ts",
            fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
            workspaceRoot: pathService.join(root, "repo"),
            markers: new Set(["assets"]),
          });
          return assetsReachedBy({
            specifier: "./relay.ts",
            fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
            workspaceRoot: pathService.join(root, "repo"),
            markers: new Set(["assets"]),
          });
        });
        return { reachedAssetsRoot, reachedFile };
      });

      it.effect("reaches the same file", () =>
        Effect.gen(function* program() {
          const pathService = yield* Path.Path;
          const { reachedFile, reachedAssetsRoot } = yield* fixtures;
          expect(reachedFile).toBe(
            pathService.join(reachedAssetsRoot, "relay-second", "repo", "owner", "order.assets.ts"),
          );
        }),
      );
    });
  });

  describe("a module that holds its own declarations", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "plain");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "owner", "plain.ts"),
          "export const total = 1;\n",
        );
        return assetsReachedBy({
          specifier: "./plain.ts",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("reaches no test data", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });

  describe("files that forward each other in a circle", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "circle");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "owner", "loop-a.ts"),
          'export * from "./loop-b.ts";\n',
        );
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "owner", "loop-b.ts"),
          'export * from "./loop-a.ts";\n',
        );
        return assetsReachedBy({
          specifier: "./loop-a.ts",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("come to an end", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });

  describe("a file forwarding the reader itself", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "back");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "owner", "back.ts"),
          'export * from "./reader.test.ts";\n',
        );
        return assetsReachedBy({
          specifier: "./back.ts",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("comes to an end", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });

  describe("data files outside the repository", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "outside");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        yield* filesystem.makeDirectory(pathService.join(root, "outside"), { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(root, "outside", "order.assets.ts"),
          "export const rows = [3];\n",
        );
        return assetsReachedBy({
          specifier: "../../outside/order.assets.ts",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("are out of reach", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });

  describe("data files inside an installed dependency", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "installed");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "node_modules", "dep"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "node_modules", "dep", "order.assets.ts"),
          "export const rows = [2];\n",
        );
        return assetsReachedBy({
          specifier: "../node_modules/dep/order.assets.ts",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("are out of reach", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });

  describe("a package specifier declared for test data", () => {
    describe("read for the first time", () => {
      const fixtures = Effect.gen(function* fixtures() {
        const filesystem = yield* FileSystem.FileSystem;
        const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-reached-assets-",
        });
        const reachedFile = yield* Effect.gen(function* reachedFile() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const root = pathService.join(reachedAssetsRoot, "package-first");
          yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
            recursive: true,
          });
          yield* filesystem.makeDirectory(
            pathService.join(root, "repo", "packages", "shared", "src"),
            { recursive: true },
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "repo", "packages", "shared", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/shared",
              exports: { "./data": "./src/table.assets.ts", "./gone": "./src/gone.ts" },
            }),
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "repo", "packages", "shared", "src", "table.assets.ts"),
            "export const table = [4];\n",
          );
          yield* filesystem.makeDirectory(
            pathService.join(root, "repo", "node_modules", "@fixture"),
            { recursive: true },
          );
          yield* filesystem.symlink(
            pathService.join(root, "repo", "packages", "shared"),
            pathService.join(root, "repo", "node_modules", "@fixture", "shared"),
          );
          return assetsReachedBy({
            specifier: "@fixture/shared/data",
            fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
            workspaceRoot: pathService.join(root, "repo"),
            markers: new Set(["assets"]),
          });
        });
        return { reachedAssetsRoot, reachedFile };
      });

      it.effect("reaches it", () =>
        Effect.gen(function* program() {
          const pathService = yield* Path.Path;
          const { reachedFile, reachedAssetsRoot } = yield* fixtures;
          expect(reachedFile).toBe(
            pathService.join(
              reachedAssetsRoot,
              "package-first",
              "repo",
              "packages",
              "shared",
              "src",
              "table.assets.ts",
            ),
          );
        }),
      );
    });

    describe("read a second time", () => {
      const fixtures = Effect.gen(function* fixtures() {
        const filesystem = yield* FileSystem.FileSystem;
        const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-reached-assets-",
        });
        const reachedFile = yield* Effect.gen(function* reachedFile() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const root = pathService.join(reachedAssetsRoot, "package-second");
          yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
            recursive: true,
          });
          yield* filesystem.makeDirectory(
            pathService.join(root, "repo", "packages", "shared", "src"),
            { recursive: true },
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "repo", "packages", "shared", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/shared",
              exports: { "./data": "./src/table.assets.ts", "./gone": "./src/gone.ts" },
            }),
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "repo", "packages", "shared", "src", "table.assets.ts"),
            "export const table = [4];\n",
          );
          yield* filesystem.makeDirectory(
            pathService.join(root, "repo", "node_modules", "@fixture"),
            { recursive: true },
          );
          yield* filesystem.symlink(
            pathService.join(root, "repo", "packages", "shared"),
            pathService.join(root, "repo", "node_modules", "@fixture", "shared"),
          );
          assetsReachedBy({
            specifier: "@fixture/shared/data",
            fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
            workspaceRoot: pathService.join(root, "repo"),
            markers: new Set(["assets"]),
          });
          return assetsReachedBy({
            specifier: "@fixture/shared/data",
            fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
            workspaceRoot: pathService.join(root, "repo"),
            markers: new Set(["assets"]),
          });
        });
        return { reachedAssetsRoot, reachedFile };
      });

      it.effect("reaches it on the reading after the first", () =>
        Effect.gen(function* program() {
          const pathService = yield* Path.Path;
          const { reachedFile, reachedAssetsRoot } = yield* fixtures;
          expect(reachedFile).toBe(
            pathService.join(
              reachedAssetsRoot,
              "package-second",
              "repo",
              "packages",
              "shared",
              "src",
              "table.assets.ts",
            ),
          );
        }),
      );
    });
  });

  describe("a package specifier declared for a module that is absent", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "package-gone");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        yield* filesystem.makeDirectory(
          pathService.join(root, "repo", "packages", "shared", "src"),
          { recursive: true },
        );
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "packages", "shared", "package.json"),
          yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            name: "@fixture/shared",
            exports: { "./data": "./src/table.assets.ts", "./gone": "./src/gone.ts" },
          }),
        );
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "packages", "shared", "src", "table.assets.ts"),
          "export const table = [4];\n",
        );
        yield* filesystem.makeDirectory(
          pathService.join(root, "repo", "node_modules", "@fixture"),
          { recursive: true },
        );
        yield* filesystem.symlink(
          pathService.join(root, "repo", "packages", "shared"),
          pathService.join(root, "repo", "node_modules", "@fixture", "shared"),
        );
        return assetsReachedBy({
          specifier: "@fixture/shared/gone",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("reaches no test data", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });

  describe("a path alias standing for a place that holds no module", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "aliased");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "aliased"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(root, "repo", "aliased", "tsconfig.json"),
          yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            compilerOptions: { paths: { "@data/*": ["./absent/*"] } },
          }),
        );
        return assetsReachedBy({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(root, "repo", "aliased", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("reaches no test data", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });

  describe("a specifier standing for nothing", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "nowhere");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        return assetsReachedBy({
          specifier: "nowhere-at-all",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("reaches no test data", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });

  describe("a relative specifier standing for nothing", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const reachedAssetsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-reached-assets-",
      });
      const reachedFile = yield* Effect.gen(function* reachedFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const root = pathService.join(reachedAssetsRoot, "absent");
        yield* filesystem.makeDirectory(pathService.join(root, "repo", "owner"), {
          recursive: true,
        });
        return assetsReachedBy({
          specifier: "./absent.ts",
          fromFile: pathService.join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: pathService.join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });
      return { reachedAssetsRoot, reachedFile };
    });

    it.effect("reaches no test data", () =>
      Effect.gen(function* program() {
        const { reachedFile } = yield* fixtures;
        expect(reachedFile).toBe(null);
      }),
    );
  });
});
