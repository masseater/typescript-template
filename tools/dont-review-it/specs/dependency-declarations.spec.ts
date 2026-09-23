import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { runChecks } from "../src/features/dont-review-it/run-checks.ts";

const repositoryWith = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* repositoryWith() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "dont-review-it-dependencies-",
    });
    yield* Effect.forEach(
      Object.entries(files),
      ([fileName, source]) =>
        Effect.gen(function* writeFixture() {
          const absolutePath = paths.join(repositoryRoot, fileName);
          yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
          yield* filesystem.writeFileString(absolutePath, source);
        }),
      { discard: true },
    );
    return repositoryRoot;
  });

layer(NodeServices.layer)("依存宣言の検査", (it) => {
  it.effect("ワークスペース定義の無いリポジトリでは依存を検査しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "packages/web/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
        "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
      });
      const { problems, warnings, failures } = yield* runChecks(repositoryRoot);

      expect(problems).toStrictEqual([]);
      expect(warnings).toStrictEqual([]);
      expect(failures).toStrictEqual([]);
    }),
  );

  it.effect("解釈できないワークスペース定義を、どの検査も素通りする前に報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "pnpm-workspace.yaml": "packages: [packages/*\n",
      });
      const { problems } = yield* runChecks(repositoryRoot);
      expect(problems.join("\n")).toContain("must not stay in the repository");
    }),
  );

  it.effect("1 つのマニフェストしか使わない catalog エントリを報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
        "packages/web/package.json": `{"dependencies": {"react": "catalog:"}}`,
      });
      const { problems } = yield* runChecks(repositoryRoot);
      expect(problems.join("\n")).toContain("The catalog must not hold react");
    }),
  );

  it.effect("overrides が catalog: で参照するエントリは、使うマニフェストが 1 つでも通す", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "pnpm-workspace.yaml": `packages:
  - packages/*
catalog:
  vite: ^7.0.0
overrides:
  vite: "catalog:"
`,
        "packages/web/package.json": `{"devDependencies": {"vite": "catalog:"}}`,
      });
      const { problems, warnings, failures } = yield* runChecks(repositoryRoot);

      expect(problems).toStrictEqual([]);
      expect(warnings).toStrictEqual([]);
      expect(failures).toStrictEqual([]);
    }),
  );

  it.effect("catalog が持つバージョンをマニフェストが直接書き写していたら報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  typescript: ^5.5.0\n",
        "packages/web/package.json": `{"devDependencies": {"typescript": "catalog:"}}`,
        "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
      });
      const { problems } = yield* runChecks(repositoryRoot);
      expect(problems.join("\n")).toContain("must not carry ^5.5.0 directly");
    }),
  );

  it.effect("複数のマニフェストが catalog の外で同じバージョンを繰り返していたら報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
        "packages/web/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
        "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
      });
      const { problems } = yield* runChecks(repositoryRoot);
      expect(problems.join("\n")).toContain("must not be pinned to ^5.5.0 separately");
    }),
  );

  it.effect("バージョンが食い違う宣言は警告に留め、検査を失敗させない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
        "packages/web/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
        "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
      });
      const { problems, warnings } = yield* runChecks(repositoryRoot);
      expect(problems).toStrictEqual([]);
      expect(warnings.join("\n")).toContain("pinned to different specifiers");
    }),
  );
});
