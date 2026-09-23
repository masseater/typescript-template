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
      prefix: "dont-review-it-canonical-literal-",
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

const OWNER = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
`;

const SINGLE_ERROR_OWNER = `/** @canonical-values ui.tone */
export const TONES = ["error"] as const;
export type Tone = (typeof TONES)[number];
`;

layer(NodeServices.layer)("型を見る canonical literal の検査", (it) => {
  it.effect("語彙の型に代入されるリテラルを報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": OWNER,
        "src/consumer.ts": `import type { OrderStatus } from "./owner.ts";
export const selected: OrderStatus = "draft";
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems.join("\n");
      expect(reported).toContain("src/consumer.ts:2");
      expect(reported).toContain("order.status");
    }),
  );

  it.effect("無関係な有限集合の型に載る同綴りは報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true, "lib": ["ESNext", "DOM"] } }\n`,
        "src/owner.ts": SINGLE_ERROR_OWNER,
        "src/fetch.ts": `export const request: RequestInit = { redirect: "error" };
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems
        .filter((problem) => problem.includes("src/fetch.ts"))
        .join("\n");
      expect(reported).toBe("");
    }),
  );

  it.effect("型で区別できない文脈のリテラルは報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": OWNER,
        "src/loose.ts": `export const selected: string = "draft";
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems.join("\n");
      expect(reported).toContain("src/loose.ts:1");
      expect(reported).toContain("order.status");
    }),
  );

  it.effect("語彙が 1 値でも、外部由来の上位集合の型には報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true, "lib": ["ESNext", "DOM"] } }\n`,
        "src/owner.ts": SINGLE_ERROR_OWNER,
        "src/redirect.ts": `export function load(redirect: RequestRedirect): RequestRedirect {
  return redirect;
}
export const chosen = load("error");
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems
        .filter((problem) => problem.includes("src/redirect.ts"))
        .join("\n");
      expect(reported).toBe("");
    }),
  );

  it.effect("由来が取れないインラインの union では集合の関係で判定する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": OWNER,
        "src/inline.ts": `export function paint(status: "draft" | "published"): string {
  return status;
}
export const painted = paint("draft");
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems.join("\n");
      expect(reported).toContain("src/inline.ts:");
      expect(reported).toContain("order.status");
    }),
  );

  it.effect("別の語彙に由来する有限集合には報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** @canonical-values article.status */
export const ARTICLE_STATUSES = ["draft", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
`,
        "src/article.ts": `import type { ArticleStatus } from "./owner.ts";
export const selected: ArticleStatus = "draft";
`,
      });
      const reported = (yield* runChecks(repositoryRoot)).problems
        .filter((problem) => problem.includes("order.status"))
        .join("\n");
      expect(reported).toBe("");
    }),
  );
});

const TWIN_OWNERS = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** @canonical-values article.status */
export const ARTICLE_STATUSES = ["draft", "published"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
`;

const problemsIn = (repositoryRoot: string, fileName: string) =>
  runChecks(repositoryRoot).pipe(
    Effect.map(({ problems }) =>
      problems.filter((problem) => problem.includes(fileName)).join("\n"),
    ),
  );

layer(NodeServices.layer)("型の由来で owner を決める canonical literal の検査", (it) => {
  it.effect("同じ値を持つ別の語彙でも、型が由来する owner だけを報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": TWIN_OWNERS,
        "src/article.ts": `import type { ArticleStatus } from "./owner.ts";
export const selected: ArticleStatus = "draft";
export const labels: { readonly status?: ArticleStatus } = { status: "published" };
`,
      });
      const reported = yield* problemsIn(repositoryRoot, "src/article.ts");
      expect(reported).toContain("src/article.ts:2");
      expect(reported).toContain("src/article.ts:3");
      expect(reported).toContain("article.status");
      expect(reported).not.toContain("order.status");
    }),
  );

  it.effect("比較と switch の case では相手の型が由来する owner だけを報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": TWIN_OWNERS,
        "src/compare.ts": `import type { ArticleStatus } from "./owner.ts";
export const isDraft = (status: ArticleStatus): boolean => status === "draft";
export const label = (status: ArticleStatus): string => {
  switch (status) {
    case "published":
      return status;
    default:
      return "";
  }
};
`,
      });
      const reported = yield* problemsIn(repositoryRoot, "src/compare.ts");
      expect(reported).toContain("src/compare.ts:2");
      expect(reported).toContain("src/compare.ts:5");
      expect(reported).toContain("article.status");
      expect(reported).not.toContain("order.status");
    }),
  );

  it.effect("owner の型を広げた union に載る owner の値は、その owner で報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": OWNER,
        "src/extended.ts": `import type { OrderStatus } from "./owner.ts";
export type Listed = OrderStatus | "deleted";
export const listed: Listed = "draft";
`,
      });
      const reported = yield* problemsIn(repositoryRoot, "src/extended.ts:3");
      expect(reported).toContain("order.status");
    }),
  );
});

layer(NodeServices.layer)("owner の語彙を広げる union の検査", (it) => {
  it.effect("owner の型に owner が持たない値を足した union を報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": OWNER,
        "src/extended.ts": `import type { OrderStatus } from "./owner.ts";
import { ORDER_STATUSES } from "./owner.ts";
export type Listed = OrderStatus | "deleted";
export type Indexed = (typeof ORDER_STATUSES)[number] | "archived";
`,
      });
      const reported = yield* problemsIn(repositoryRoot, "src/extended.ts");
      expect(reported).toContain("src/extended.ts:3");
      expect(reported).toContain('"deleted"');
      expect(reported).toContain("src/extended.ts:4");
      expect(reported).toContain('"archived"');
      expect(reported).toContain("order.status");
    }),
  );

  it.effect("owner の型と null や undefined の union は報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": OWNER,
        "src/optional.ts": `import type { OrderStatus } from "./owner.ts";
export type Maybe = OrderStatus | null | undefined;
export type Flagged = OrderStatus | false;
`,
      });
      expect(yield* problemsIn(repositoryRoot, "src/optional.ts")).toBe("");
    }),
  );

  it.effect("owner と無関係な型とリテラルの union は報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": OWNER,
        "src/unrelated.ts": `export type Size = { readonly width: number };
export type Sizing = Size | "auto";
`,
      });
      expect(yield* problemsIn(repositoryRoot, "src/unrelated.ts")).toBe("");
    }),
  );
});

layer(NodeServices.layer)("owner の語彙を広げない union の検査", (it) => {
  it.effect("owner を要素に持つ配列型や、Exclude で除く値の union は報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
        "src/owner.ts": OWNER,
        "src/narrowed.ts": `import type { OrderStatus } from "./owner.ts";
export type Selection = "all" | readonly OrderStatus[];
export type Remaining = Exclude<string, OrderStatus | "deleted">;
`,
      });
      expect(yield* problemsIn(repositoryRoot, "src/narrowed.ts")).toBe("");
    }),
  );
});
