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
      prefix: "dont-review-it-canonical-",
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

layer(NodeServices.layer)("値の正典の検査", (it) => {
  it.effect("同じ概念を 2 か所で宣言していたら、先に宣言した場所を挙げて報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "src/order.ts": `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
        "src/status.ts": `/** @canonical-values order.status */
export const STATUSES = ["draft", "published"] as const;
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems.join("\n");
      expect(reported).toContain("A concept must be declared in one place");
      expect(reported).toContain("src/order.ts");
    }),
  );

  it.effect("同じ値の集合を別々の概念が宣言していたら、両方の概念を挙げて警告し、落とさない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "src/article.ts": `/** @canonical-values article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
        "src/order.ts": `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
      });
      const report = yield* runChecks(repositoryRoot);
      const reported = report.warnings.join("\n");
      expect(reported).toContain("article.status");
      expect(reported).toContain("order.status");
      expect(report.problems).toStrictEqual([]);
    }),
  );

  it.effect("概念を名指ししない注釈を報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "src/order.ts": `/** @canonical-values */
export const ORDER_STATUSES = ["draft"] as const;
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems.join("\n");
      expect(reported).toContain("must name the concept it declares");
    }),
  );

  it.effect("退役した注釈タグが残っていたら報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "src/order.ts": `/** @canonical-values-exempt */
export const ORDER_STATUSES = ["draft"] as const;
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems.join("\n");
      expect(reported).toContain("@canonical-values-exempt");
    }),
  );

  it.effect("テストファイルが繰り返す値の集合を二重宣言と数えない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "src/order.ts": `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft"] as const;
`,
        "src/order.test.ts": `const FIXTURE_STATUSES = ["draft"] as const;
`,
      });
      const { problems, warnings, failures } = yield* runChecks(repositoryRoot);

      expect(problems).toStrictEqual([]);
      expect(warnings).toStrictEqual([]);
      expect(failures).toStrictEqual([]);
    }),
  );
});
