import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runChecks } from "../src/features/dont-review-it/run-checks.ts";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-canonical-literal-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([fileName, source]) => {
      const absolutePath = join(repositoryRoot, fileName);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

const OWNER = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
`;

const SINGLE_ERROR_OWNER = `/** @canonical-values ui.tone */
export const TONES = ["error"] as const;
export type Tone = (typeof TONES)[number];
`;

describe("型を見る canonical literal の検査", () => {
  it("語彙の型に代入されるリテラルを報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": OWNER,
      "src/consumer.ts": `import type { OrderStatus } from "./owner.ts";
export const selected: OrderStatus = "draft";
`,
    });
    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("src/consumer.ts:2");
    expect(reported).toContain("order.status");
  });

  it("無関係な有限集合の型に載る同綴りは報告しない", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true, "lib": ["ESNext", "DOM"] } }\n`,
      "src/owner.ts": SINGLE_ERROR_OWNER,
      "src/fetch.ts": `export const request: RequestInit = { redirect: "error" };
`,
    });
    const reported = runChecks(repositoryRoot)
      .problems.filter((problem) => problem.includes("src/fetch.ts"))
      .join("\n");
    expect(reported).toBe("");
  });

  it("型で区別できない文脈のリテラルは報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": OWNER,
      "src/loose.ts": `export const selected: string = "draft";
`,
    });
    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("src/loose.ts:1");
    expect(reported).toContain("order.status");
  });

  it("語彙が 1 値でも、外部由来の上位集合の型には報告しない", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true, "lib": ["ESNext", "DOM"] } }\n`,
      "src/owner.ts": SINGLE_ERROR_OWNER,
      "src/redirect.ts": `export function load(redirect: RequestRedirect): RequestRedirect {
  return redirect;
}
export const chosen = load("error");
`,
    });
    const reported = runChecks(repositoryRoot)
      .problems.filter((problem) => problem.includes("src/redirect.ts"))
      .join("\n");
    expect(reported).toBe("");
  });

  it("由来が取れないインラインの union では集合の関係で判定する", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": OWNER,
      "src/inline.ts": `export function paint(status: "draft" | "published"): string {
  return status;
}
export const painted = paint("draft");
`,
    });
    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("src/inline.ts:");
    expect(reported).toContain("order.status");
  });

  it("別の語彙に由来する有限集合には報告しない", async () => {
    const repositoryRoot = await repositoryWith({
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
    const reported = runChecks(repositoryRoot)
      .problems.filter((problem) => problem.includes("order.status"))
      .join("\n");
    expect(reported).toBe("");
  });
});

const TWIN_OWNERS = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** @canonical-values article.status */
export const ARTICLE_STATUSES = ["draft", "published"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
`;

const problemsIn = (repositoryRoot: string, fileName: string): string =>
  runChecks(repositoryRoot)
    .problems.filter((problem) => problem.includes(fileName))
    .join("\n");

describe("型の由来で owner を決める canonical literal の検査", () => {
  it("同じ値を持つ別の語彙でも、型が由来する owner だけを報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": TWIN_OWNERS,
      "src/article.ts": `import type { ArticleStatus } from "./owner.ts";
export const selected: ArticleStatus = "draft";
export const labels: { readonly status?: ArticleStatus } = { status: "published" };
`,
    });
    const reported = problemsIn(repositoryRoot, "src/article.ts");
    expect(reported).toContain("src/article.ts:2");
    expect(reported).toContain("src/article.ts:3");
    expect(reported).toContain("article.status");
    expect(reported).not.toContain("order.status");
  });

  it("比較と switch の case では相手の型が由来する owner だけを報告する", async () => {
    const repositoryRoot = await repositoryWith({
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
    const reported = problemsIn(repositoryRoot, "src/compare.ts");
    expect(reported).toContain("src/compare.ts:2");
    expect(reported).toContain("src/compare.ts:5");
    expect(reported).toContain("article.status");
    expect(reported).not.toContain("order.status");
  });

  it("owner の型を広げた union に載る owner の値は、その owner で報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": OWNER,
      "src/extended.ts": `import type { OrderStatus } from "./owner.ts";
export type Listed = OrderStatus | "deleted";
export const listed: Listed = "draft";
`,
    });
    const reported = problemsIn(repositoryRoot, "src/extended.ts:3");
    expect(reported).toContain("order.status");
  });
});

describe("owner の語彙を広げる union の検査", () => {
  it("owner の型に owner が持たない値を足した union を報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": OWNER,
      "src/extended.ts": `import type { OrderStatus } from "./owner.ts";
import { ORDER_STATUSES } from "./owner.ts";
export type Listed = OrderStatus | "deleted";
export type Indexed = (typeof ORDER_STATUSES)[number] | "archived";
`,
    });
    const reported = problemsIn(repositoryRoot, "src/extended.ts");
    expect(reported).toContain("src/extended.ts:3");
    expect(reported).toContain('"deleted"');
    expect(reported).toContain("src/extended.ts:4");
    expect(reported).toContain('"archived"');
    expect(reported).toContain("order.status");
  });

  it("owner の型と null や undefined の union は報告しない", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": OWNER,
      "src/optional.ts": `import type { OrderStatus } from "./owner.ts";
export type Maybe = OrderStatus | null | undefined;
export type Flagged = OrderStatus | false;
`,
    });
    expect(problemsIn(repositoryRoot, "src/optional.ts")).toBe("");
  });

  it("owner と無関係な型とリテラルの union は報告しない", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": OWNER,
      "src/unrelated.ts": `export type Size = { readonly width: number };
export type Sizing = Size | "auto";
`,
    });
    expect(problemsIn(repositoryRoot, "src/unrelated.ts")).toBe("");
  });
});

describe("owner の語彙を広げない union の検査", () => {
  it("owner を要素に持つ配列型や、Exclude で除く値の union は報告しない", async () => {
    const repositoryRoot = await repositoryWith({
      "tsconfig.json": `{ "compilerOptions": { "strict": true, "noEmit": true } }\n`,
      "src/owner.ts": OWNER,
      "src/narrowed.ts": `import type { OrderStatus } from "./owner.ts";
export type Selection = "all" | readonly OrderStatus[];
export type Remaining = Exclude<string, OrderStatus | "deleted">;
`,
    });
    expect(problemsIn(repositoryRoot, "src/narrowed.ts")).toBe("");
  });
});
