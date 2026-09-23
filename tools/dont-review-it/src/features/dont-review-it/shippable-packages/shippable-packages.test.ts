import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultShippablePackagesConfig } from "./config.ts";
import { shippablePackagesProblems } from "./shippable-packages.ts";

layer(NodeServices.layer)("shippablePackagesProblems", (it) => {
  describe("a published package depending on a workspace nobody can install", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const withheld = paths.join(repositoryRoot, "packages/internal/package.json");
      const shipped = paths.join(repositoryRoot, "packages/shipped/package.json");
      yield* filesystem.makeDirectory(paths.dirname(withheld), { recursive: true });
      yield* filesystem.makeDirectory(paths.dirname(shipped), { recursive: true });
      yield* filesystem.writeFileString(
        withheld,
        `{
  "name": "@example/internal",
  "private": true
}
`,
      );
      yield* filesystem.writeFileString(
        shipped,
        `{
  "name": "@example/shipped",
  "dependencies": {
    "@example/internal": "workspace:*"
  }
}
`,
      );
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is told at the dependencies field to let the build absorb it", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/shipped/package.json",
              "line": 3,
              "message": "A package that npm can publish must not declare dependencies on @example/internal, because that workspace is marked "private": true and no registry ever serves it. Move it to devDependencies so the build bundles it, or let it publish by removing "private": true.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a published package keeping that workspace in devDependencies", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const withheld = paths.join(repositoryRoot, "packages/internal/package.json");
      const shipped = paths.join(repositoryRoot, "packages/shipped/package.json");
      yield* filesystem.makeDirectory(paths.dirname(withheld), { recursive: true });
      yield* filesystem.makeDirectory(paths.dirname(shipped), { recursive: true });
      yield* filesystem.writeFileString(
        withheld,
        `{
  "name": "@example/internal",
  "private": true
}
`,
      );
      yield* filesystem.writeFileString(
        shipped,
        `{
  "name": "@example/shipped",
  "devDependencies": {
    "@example/internal": "workspace:*"
  }
}
`,
      );
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is left alone, because nothing an installer resolves names it", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a published package whose bin points at TypeScript source", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const manifest = paths.join(repositoryRoot, "packages/shipped/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/shipped",
  "bin": {
    "shipped": "./src/cli.ts"
  }
}
`,
      );
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is told at the bin field to name the built output", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/shipped/package.json",
              "line": 3,
              "message": "The published bin.shipped entry must not point at ./src/cli.ts, because Node refuses to strip types from a file under node_modules and an installer finds nothing it can run there. Point it at the built output, through publishConfig when the local path has to stay on the source.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a published package replacing its source entries at publish time", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const manifest = paths.join(repositoryRoot, "packages/shipped/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["dist"],
  "bin": {
    "shipped": "./src/cli.ts"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "publishConfig": {
    "bin": {
      "shipped": "./dist/cli.mjs"
    },
    "exports": {
      ".": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      }
    }
  }
}
`,
      );
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is left alone, because what publishes resolves without stripping", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a published package whose replacement still names source", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const manifest = paths.join(repositoryRoot, "packages/shipped/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["src"],
  "publishConfig": {
    "exports": {
      ".": "./src/index.ts"
    }
  }
}
`,
      );
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is told at the publishConfig block that carries the replacement", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/shipped/package.json",
              "line": 4,
              "message": "The published exports["."] entry must not point at ./src/index.ts, because Node refuses to strip types from a file under node_modules and an installer finds nothing it can run there. Point it at the built output, through publishConfig when the local path has to stay on the source.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a published package whose files allowlist drops the built output", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const manifest = paths.join(repositoryRoot, "packages/shipped/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["skills"],
  "exports": {
    ".": "./dist/index.mjs",
    "./package.json": "./package.json"
  }
}
`,
      );
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is told at the files allowlist to carry what the entry names", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/shipped/package.json",
              "line": 3,
              "message": "The files allowlist must not leave out dist, because npm packs only what files names and a published entry would resolve to a path the archive never carried. Add "dist" to files.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a published package without a files allowlist", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const manifest = paths.join(repositoryRoot, "packages/shipped/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/shipped",
  "exports": {
    ".": "./dist/index.mjs"
  }
}
`,
      );
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is left alone, because a manifest without the allowlist packs all", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a manifest that holds nothing", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const manifest = paths.join(repositoryRoot, "fixtures/empty/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(manifest, "");
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is counted by nothing, because it names no package", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 0 });
      }),
    );
  });

  describe("a manifest without a name", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-shippable-packages-",
      });

      const manifest = paths.join(repositoryRoot, "fixtures/fragment/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{ "sideEffects": false }
`,
      );
      return yield* shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it.effect("is counted by nothing, because it names no package", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 0 });
      }),
    );
  });
});
