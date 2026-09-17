import { is, literal, object, string } from "valibot";
import type { LLMsOptions } from "fumadocs-core/mdx-plugins";

const chartAttribute = object({
  name: literal("chart"),
  type: literal("mdxJsxAttribute"),
  value: string(),
});

const processedMarkdown: LLMsOptions = {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types, max-params
  stringify(node, parent, state, info) {
    const chart =
      node.type === "mdxJsxFlowElement" && node.name === "Mermaid"
        ? // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
          node.attributes.find((attribute) => is(chartAttribute, attribute))
        : undefined;
    return is(chartAttribute, chart)
      ? state.handle({ lang: "mermaid", type: "code", value: chart.value }, parent, state, info)
      : undefined;
  },
};

export { processedMarkdown };
