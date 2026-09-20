import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { remarkLLMs } from "fumadocs-core/mdx-plugins/remark-llms";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { describe, expect, it } from "vite-plus/test";

import { processedMarkdown } from "./mermaid-markdown.ts";
import { remarkWikiTerm } from "./remark-wiki-term.ts";

async function process(source: string): Promise<unknown> {
  const file = await remark()
    .use(remarkMdx)
    .use(remarkMdxMermaid)
    .use(remarkWikiTerm)
    .use(remarkLLMs, { ...processedMarkdown, _data: true })
    .process(source);
  return file.data["markdown"];
}

describe("mermaid diagrams in processed markdown", () => {
  it("keeps a mermaid code block as a mermaid code block", async () => {
    expect.hasAssertions();
    await expect(
      process("```mermaid\nflowchart LR\n  A[ログイン] --> B[ユーザー一覧]\n```\n"),
    ).resolves.toBe("```mermaid\nflowchart LR\n  A[ログイン] --> B[ユーザー一覧]\n```\n");
  });

  it("widens the fence when the diagram itself contains a fence", async () => {
    expect.hasAssertions();
    await expect(process('````mermaid\nflowchart LR\n  A["```"] --> B\n````\n')).resolves.toBe(
      '````mermaid\nflowchart LR\n  A["```"] --> B\n````\n',
    );
  });

  it("leaves other MDX components to the default stringifier", async () => {
    expect.hasAssertions();
    await expect(process("<Callout>注意</Callout>\n")).resolves.toBe("<Callout>注意</Callout>\n");
  });
});

describe("wiki term links in processed markdown", () => {
  it("round-trips [[term]] through TermLink", async () => {
    expect.hasAssertions();
    await expect(process("これは[[会員アカウント]]です。\n")).resolves.toBe(
      "これは[[会員アカウント]]です。\n",
    );
  });

  it("round-trips [[term|label]]", async () => {
    expect.hasAssertions();
    await expect(process("[[会員アカウント|会員]]\n")).resolves.toBe("[[会員アカウント|会員]]\n");
  });

  it("leaves code fences alone", async () => {
    expect.hasAssertions();
    await expect(process("```\n[[会員アカウント]]\n```\n")).resolves.toBe(
      "```\n[[会員アカウント]]\n```\n",
    );
  });
});
