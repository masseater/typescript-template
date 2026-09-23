import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { aliasedPathsFor } from "./tsconfig-path-aliases.ts";

layer(NodeServices.layer)("aliasedPathsFor", (it) => {
  describe("a specifier standing for a path a wildcard declaration spells", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wildcard");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("is read as the path the project declares for it", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { paths, workspaceRoot } = yield* fixtures;
        expect(paths).toStrictEqual([
          pathService.join(workspaceRoot, "wildcard", "values", "order.assets.ts"),
        ]);
      }),
    );
  });

  describe("a specifier shorter than the declaration", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wildcard");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("stands for nothing", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a specifier opening differently from the declaration", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wildcard");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@other/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("stands for nothing", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a declaration carrying no wildcard", () => {
    describe("the specifier it spells", () => {
      const fixtures = Effect.gen(function* fixtures() {
        const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
          const filesystem = yield* FileSystem.FileSystem;
          const root = yield* filesystem.makeTempDirectoryScoped({
            prefix: "tsconfig-path-aliases-",
          });

          return root;
        });
        const paths = yield* Effect.gen(function* paths() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const directory = pathService.join(workspaceRoot, "exact");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            pathService.join(directory, "tsconfig.json"),
            '{ "compilerOptions": { "paths": { "@data/table": ["./values/table.assets.ts"] } } }\n',
          );
          return aliasedPathsFor({
            specifier: "@data/table",
            fromFile: pathService.join(directory, "reader.ts"),
          });
        });
        return { workspaceRoot, paths };
      });

      it.effect("stands for exactly the path declared for it", () =>
        Effect.gen(function* program() {
          const pathService = yield* Path.Path;
          const { paths, workspaceRoot } = yield* fixtures;
          expect(paths).toStrictEqual([
            pathService.join(workspaceRoot, "exact", "values", "table.assets.ts"),
          ]);
        }),
      );
    });

    describe("any other specifier", () => {
      const fixtures = Effect.gen(function* fixtures() {
        const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
          const filesystem = yield* FileSystem.FileSystem;
          const root = yield* filesystem.makeTempDirectoryScoped({
            prefix: "tsconfig-path-aliases-",
          });

          return root;
        });
        const paths = yield* Effect.gen(function* paths() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const directory = pathService.join(workspaceRoot, "exact");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            pathService.join(directory, "tsconfig.json"),
            '{ "compilerOptions": { "paths": { "@data/table": ["./values/table.assets.ts"] } } }\n',
          );
          return aliasedPathsFor({
            specifier: "@data/other",
            fromFile: pathService.join(directory, "reader.ts"),
          });
        });
        return { workspaceRoot, paths };
      });

      it.effect("stands for nothing", () =>
        Effect.gen(function* program() {
          const { paths } = yield* fixtures;
          expect(paths).toStrictEqual([]);
        }),
      );
    });
  });

  describe("a specifier standing under two declarations, one opening longer than the other", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "layered");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "paths": { "@data/*": ["./shallow/*"], "@data/deep/*": ["./deep/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/deep/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("is read through the declaration spelling the longest opening", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { paths, workspaceRoot } = yield* fixtures;
        expect(paths).toStrictEqual([
          pathService.join(workspaceRoot, "layered", "deep", "order.assets.ts"),
        ]);
      }),
    );
  });

  describe("those same two declarations with the longest opening written first", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "reversed");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "paths": { "@data/deep/*": ["./deep/*"], "@data/*": ["./shallow/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/deep/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect(
      "is read through the longest opening again, because the written order does not decide",
      () =>
        Effect.gen(function* program() {
          const pathService = yield* Path.Path;
          const { paths, workspaceRoot } = yield* fixtures;
          expect(paths).toStrictEqual([
            pathService.join(workspaceRoot, "reversed", "deep", "order.assets.ts"),
          ]);
        }),
    );
  });

  describe("a declaration spelling two wildcards", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wild");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "paths": { "@data/*/*": ["./values/*"], "@data/held": "./values/held.ts" } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/left/right",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("stands for nothing", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a declaration holding a single path instead of a list", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wild");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "paths": { "@data/*/*": ["./values/*"], "@data/held": "./values/held.ts" } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/held",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("stands for nothing", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a project naming a base directory of its own", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "based");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("has the paths it declares read from that directory", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { paths, workspaceRoot } = yield* fixtures;
        expect(paths).toStrictEqual([
          pathService.join(workspaceRoot, "based", "src", "values", "order.assets.ts"),
        ]);
      }),
    );
  });

  describe("a project that inherits its paths", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "inherited");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "extends": ["./tsconfig.base.json"] }\n',
        );
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.base.json"),
          '{ "compilerOptions": { "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("reads them from the configuration it extends", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { paths, workspaceRoot } = yield* fixtures;
        expect(paths).toStrictEqual([
          pathService.join(workspaceRoot, "inherited", "values", "order.assets.ts"),
        ]);
      }),
    );
  });

  describe("a configuration inherited from an installed package", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "packaged");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "extends": "@fixture/preset/tsconfig.json" }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("carries no paths of its own", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("configurations that extend each other in a circle", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "circular");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "extends": "./tsconfig.other.json" }\n',
        );
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.other.json"),
          '{ "extends": "./tsconfig.json" }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("come to an end", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a configuration that is not an object of settings", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "listed");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(pathService.join(directory, "tsconfig.json"), "[]");
        return aliasedPathsFor({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("declares no paths", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a project that declares no paths at all", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "plain");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "strict": true } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("stands for nothing", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a directory holding no configuration at all", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "bare");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        return aliasedPathsFor({
          specifier: "@data/order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("stands for nothing", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a specifier naming this directory", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wildcard");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "./order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("is never read as a path alias", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a specifier naming the directory above", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wildcard");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "../order.assets.ts",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("is never read as a path alias", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a specifier naming an absolute place", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wildcard");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: pathService.join(directory, "order.assets.ts"),
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("is never read as a path alias", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a subpath specifier", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({
          prefix: "tsconfig-path-aliases-",
        });

        return root;
      });
      const paths = yield* Effect.gen(function* paths() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const directory = pathService.join(workspaceRoot, "wildcard");
        yield* filesystem.makeDirectory(directory, { recursive: true });
        yield* filesystem.writeFileString(
          pathService.join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "#data",
          fromFile: pathService.join(directory, "reader.ts"),
        });
      });
      return { workspaceRoot, paths };
    });

    it.effect("is never read as a path alias", () =>
      Effect.gen(function* program() {
        const { paths } = yield* fixtures;
        expect(paths).toStrictEqual([]);
      }),
    );
  });
});
