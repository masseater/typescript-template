import { Effect } from "effect";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { remarkLLMs } from "fumadocs-core/mdx-plugins/remark-llms";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { describe, expect, it } from "vite-plus/test";

import { processedMarkdown } from "./mermaid-markdown.ts";
import { remarkWikiTerm } from "./remark-wiki-term.ts";

function process(source: string): Effect.Effect<unknown> {
  return Effect.gen(function* processMarkdown() {
    const file = yield* Effect.promise(() =>
      remark()
        .use(remarkMdx)
        .use(remarkMdxMermaid)
        .use(remarkWikiTerm)
        .use(remarkLLMs, { ...processedMarkdown, _data: true })
        .process(source),
    );
    return file.data["markdown"];
  });
}

describe("mermaid diagrams in processed markdown", () => {
  it("keeps a mermaid code block as a mermaid code block", () =>
    Effect.runPromise(
      Effect.gen(function* keepMermaidFence() {
        expect.hasAssertions();
        expect(
          yield* process("```mermaid\nflowchart LR\n  A[ログイン] --> B[ユーザー一覧]\n```\n"),
        ).toBe("```mermaid\nflowchart LR\n  A[ログイン] --> B[ユーザー一覧]\n```\n");
      }),
    ));

  it("widens the fence when the diagram itself contains a fence", () =>
    Effect.runPromise(
      Effect.gen(function* widenFence() {
        expect.hasAssertions();
        expect(yield* process('````mermaid\nflowchart LR\n  A["```"] --> B\n````\n')).toBe(
          '````mermaid\nflowchart LR\n  A["```"] --> B\n````\n',
        );
      }),
    ));

  it("leaves other MDX components to the default stringifier", () =>
    Effect.runPromise(
      Effect.gen(function* leaveMdx() {
        expect.hasAssertions();
        expect(yield* process("<Callout>注意</Callout>\n")).toBe("<Callout>注意</Callout>\n");
      }),
    ));
});

describe("wiki term links in processed markdown", () => {
  it("round-trips [[term]] through TermLink", () =>
    Effect.runPromise(
      Effect.gen(function* roundTripTerm() {
        expect.hasAssertions();
        expect(yield* process("これは[[会員アカウント]]です。\n")).toBe(
          "これは[[会員アカウント]]です。\n",
        );
      }),
    ));

  it("round-trips [[term|label]]", () =>
    Effect.runPromise(
      Effect.gen(function* roundTripLabel() {
        expect.hasAssertions();
        expect(yield* process("[[会員アカウント|会員]]\n")).toBe("[[会員アカウント|会員]]\n");
      }),
    ));

  it("leaves code fences alone", () =>
    Effect.runPromise(
      Effect.gen(function* leaveFence() {
        expect.hasAssertions();
        expect(yield* process("```\n[[会員アカウント]]\n```\n")).toBe(
          "```\n[[会員アカウント]]\n```\n",
        );
      }),
    ));
});
