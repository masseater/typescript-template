import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { defaultShippablePackagesConfig } from "../src/features/dont-review-it/shippable-packages/config.ts";
import { shippablePackagesProblems } from "../src/features/dont-review-it/shippable-packages/shippable-packages.ts";

const config = defaultShippablePackagesConfig;

const WITHHELD = {
  "packages/internal/package.json": `{
  "name": "@example/internal",
  "private": true
}`,
};

const repositoryWith = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* repositoryWith() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "dont-review-it-shippable-packages-",
    });
    yield* Effect.forEach(
      Object.entries(files),
      ([spelled, source]) =>
        Effect.gen(function* writeFixture() {
          const checked = paths.join(repositoryRoot, spelled);
          yield* filesystem.makeDirectory(paths.dirname(checked), { recursive: true });
          yield* filesystem.writeFileString(checked, source);
        }),
      { discard: true },
    );
    return repositoryRoot;
  });

layer(NodeServices.layer)("出荷できるパッケージの検査", (it) => {
  it.effect("公開できるパッケージが private なワークスペースを依存に載せていることを報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WITHHELD,
        "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "dependencies": { "@example/internal": "workspace:*" }
}`,
      });

      expect((yield* shippablePackagesProblems({ repositoryRoot, config })).problems).toStrictEqual(
        [
          {
            file: "packages/shipped/package.json",
            line: 3,
            message:
              'A package that npm can publish must not declare dependencies on @example/internal, because that workspace is marked "private": true and no registry ever serves it. Move it to devDependencies so the build bundles it, or let it publish by removing "private": true.',
          },
        ],
      );
    }),
  );

  it.effect("同じワークスペースを開発依存に置いた公開できるパッケージを黙って通す", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WITHHELD,
        "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "devDependencies": { "@example/internal": "workspace:*" }
}`,
      });

      expect((yield* shippablePackagesProblems({ repositoryRoot, config })).problems).toStrictEqual(
        [],
      );
    }),
  );

  it.effect("公開後に実行時が解決する入口が型注釈を持つソースを指していることを報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "bin": { "shipped": "./src/cli.ts" }
}`,
      });

      expect((yield* shippablePackagesProblems({ repositoryRoot, config })).problems).toStrictEqual(
        [
          {
            file: "packages/shipped/package.json",
            line: 3,
            message:
              "The published bin.shipped entry must not point at ./src/cli.ts, because Node refuses to strip types from a file under node_modules and an installer finds nothing it can run there. Point it at the built output, through publishConfig when the local path has to stay on the source.",
          },
        ],
      );
    }),
  );

  it.effect("公開後の入口を publishConfig が成果物へ置き換えているパッケージを黙って通す", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "files": ["dist"],
  "bin": { "shipped": "./src/cli.ts" },
  "publishConfig": { "bin": { "shipped": "./dist/cli.mjs" } }
}`,
      });

      expect((yield* shippablePackagesProblems({ repositoryRoot, config })).problems).toStrictEqual(
        [],
      );
    }),
  );

  it.effect("型を渡す条件がソースを指していても報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "files": ["dist", "src"],
  "exports": { ".": { "types": "./src/index.ts", "default": "./dist/index.mjs" } }
}`,
      });

      expect((yield* shippablePackagesProblems({ repositoryRoot, config })).problems).toStrictEqual(
        [],
      );
    }),
  );

  it.effect("公開後の入口が指す場所を files の許可リストが載せていないことを報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "files": ["skills"],
  "exports": { ".": "./dist/index.mjs" }
}`,
      });

      expect((yield* shippablePackagesProblems({ repositoryRoot, config })).problems).toStrictEqual(
        [
          {
            file: "packages/shipped/package.json",
            line: 3,
            message:
              'The files allowlist must not leave out dist, because npm packs only what files names and a published entry would resolve to a path the archive never carried. Add "dist" to files.',
          },
        ],
      );
    }),
  );

  it.effect("private なパッケージを、公開できるものとして数えない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WITHHELD,
        "packages/shipped/package.json": `{
  "name": "@example/shipped"
}`,
      });

      expect((yield* shippablePackagesProblems({ repositoryRoot, config })).scanned).toBe(1);
    }),
  );
});
