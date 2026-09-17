import { describe, expect, it } from "vite-plus/test";
import { remark } from "remark";
import { remarkLLMs } from "fumadocs-core/mdx-plugins/remark-llms";
import remarkMdx from "remark-mdx";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { remarkMermaidSource } from "./mermaid-markdown.ts";

async function processedMarkdown(source: string): Promise<unknown> {
  const file = await remark()
    .use(remarkMdx)
    .use(remarkMdxMermaid)
    .use(remarkMermaidSource)
    .use(remarkLLMs, { _data: true, headingIds: false })
    .process(source);
  return file.data["markdown"];
}

describe("mermaid diagrams in processed markdown", () => {
  it("keeps a mermaid code block as a mermaid code block", async () => {
    expect.hasAssertions();
    await expect(
      processedMarkdown("```mermaid\nflowchart LR\n  A[ログイン] --> B[ユーザー一覧]\n```\n"),
    ).resolves.toBe("```mermaid\nflowchart LR\n  A[ログイン] --> B[ユーザー一覧]\n```\n");
  });

  it("widens the fence when the diagram itself contains a fence", async () => {
    expect.hasAssertions();
    await expect(
      processedMarkdown('````mermaid\nflowchart LR\n  A["```"] --> B\n````\n'),
    ).resolves.toBe('````mermaid\nflowchart LR\n  A["```"] --> B\n````\n');
  });

  it("leaves other MDX components to the default stringifier", async () => {
    expect.hasAssertions();
    await expect(processedMarkdown("<Callout>注意</Callout>\n")).resolves.toBe(
      "<Callout>注意</Callout>\n",
    );
  });
});
