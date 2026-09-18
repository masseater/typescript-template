import { Schema } from "effect";
import type { LLMsOptions } from "fumadocs-core/mdx-plugins";

const isChartAttribute = Schema.is(
  Schema.Struct({
    name: Schema.Literal("chart"),
    type: Schema.Literal("mdxJsxAttribute"),
    value: Schema.String,
  }),
);

const processedMarkdown: LLMsOptions = {
  // oxlint-disable-next-line max-params
  stringify(node, parent, state, info) {
    const chart =
      node.type === "mdxJsxFlowElement" && node.name === "Mermaid"
        ? node.attributes.find((attribute) => isChartAttribute(attribute))
        : undefined;
    return isChartAttribute(chart)
      ? state.handle({ lang: "mermaid", type: "code", value: chart.value }, parent, state, info)
      : undefined;
  },
};

export { processedMarkdown };
