import type { Root } from "mdast";
import { Schema } from "effect";
import { toMarkdown } from "mdast-util-to-markdown";
import { visit } from "unist-util-visit";

const ChartAttribute = Schema.Struct({
  name: Schema.Literal("chart"),
  type: Schema.Literal("mdxJsxAttribute"),
  value: Schema.String,
});
const isChartAttribute = Schema.is(ChartAttribute);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function remarkMermaidSource(): (tree: Root) => void {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (tree) => {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    visit(tree, "mdxJsxFlowElement", (node) => {
      if (node.name !== "Mermaid") {
        return;
      }
      for (const attribute of node.attributes) {
        if (isChartAttribute(attribute)) {
          const text = toMarkdown({ lang: "mermaid", type: "code", value: attribute.value });
          node.data = { ...node.data, _stringify: { text: text.trimEnd() } };
        }
      }
    });
  };
}

export { remarkMermaidSource };
