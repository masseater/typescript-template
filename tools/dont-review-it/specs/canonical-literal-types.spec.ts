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
