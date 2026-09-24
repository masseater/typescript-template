import { termLinkAttribute, wikiTermSyntax } from "@repo/markdown-terms";
import { Schema } from "effect";

import type { LLMsOptions } from "fumadocs-core/mdx-plugins";

const isChartAttribute = Schema.is(
  Schema.Struct({
    name: Schema.Literal("chart"),
    type: Schema.Literal("mdxJsxAttribute"),
    value: Schema.String,
  }),
);

function termLinkMarkdown(node: { readonly attributes: readonly unknown[] }): string | undefined {
  const term = termLinkAttribute(node.attributes, "term");
  return term === undefined
    ? undefined
    : wikiTermSyntax(term, termLinkAttribute(node.attributes, "label"));
}

const processedMarkdown: LLMsOptions = {
  stringify(...stringifyArguments: Parameters<NonNullable<LLMsOptions["stringify"]>>) {
    const [node, parent, state, info] = stringifyArguments;
    if (node.type === "mdxJsxFlowElement" && node.name === "Mermaid") {
      const chart = node.attributes.find((attribute) => isChartAttribute(attribute));
      return isChartAttribute(chart)
        ? state.handle({ lang: "mermaid", type: "code", value: chart.value }, parent, state, info)
        : undefined;
    }
    if (node.type === "mdxJsxTextElement" && node.name === "TermLink") {
      return termLinkMarkdown(node);
    }
    return undefined;
  },
};

export { processedMarkdown };
