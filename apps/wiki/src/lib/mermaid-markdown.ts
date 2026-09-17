import { is, literal, object, string } from "valibot";
import type { Root } from "mdast";
import { toMarkdown } from "mdast-util-to-markdown";
import { visit } from "unist-util-visit";

const chartAttribute = object({
  name: literal("chart"),
  type: literal("mdxJsxAttribute"),
  value: string(),
});

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
        if (is(chartAttribute, attribute)) {
          const text = toMarkdown({ lang: "mermaid", type: "code", value: attribute.value });
          node.data = { ...node.data, _stringify: { text: text.trimEnd() } };
        }
      }
    });
  };
}

export { remarkMermaidSource };
