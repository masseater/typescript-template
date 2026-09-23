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
      prefix: "dont-review-it-bodies-",
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

layer(NodeServices.layer)("重複した宣言本体の検査", (it) => {
  it.effect("同じ本体を綴る宣言を、繰り返しているすべての場所を挙げて報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
        "src/doubled.ts": "export const doubled = (value: number): number => value * 2;\n",
      });
      const reported = (yield* runChecks(repositoryRoot)).problems.join("\n");
      expect(reported).toContain("src/twice.ts:1 (twice)");
      expect(reported).toContain("src/doubled.ts:1 (doubled)");
    }),
  );

  it.effect("テストファイルが繰り返す本体を重複と数えない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
        "src/twice.test.ts": "export const doubled = (value: number): number => value * 2;\n",
      });
      const { problems, warnings, failures } = yield* runChecks(repositoryRoot);

      expect(problems).toStrictEqual([]);
      expect(warnings).toStrictEqual([]);
      expect(failures).toStrictEqual([]);
    }),
  );
});
