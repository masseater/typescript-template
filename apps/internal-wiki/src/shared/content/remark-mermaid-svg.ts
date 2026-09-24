import { Schema } from "effect";
import { visitParents } from "unist-util-visit-parents";

import { renderDiagram } from "#shared/diagram/index.ts";

import type { Root } from "mdast";

const MermaidElement = Schema.Struct({
  attributes: Schema.Array(Schema.Unknown),
  name: Schema.Literal("Mermaid"),
  type: Schema.Literal("mdxJsxFlowElement"),
});

const ChartAttribute = Schema.Struct({
  name: Schema.Literal("chart"),
  type: Schema.Literal("mdxJsxAttribute"),
  value: Schema.String,
});

const isMermaidElement = Schema.is(MermaidElement);
const isChartAttribute = Schema.is(ChartAttribute);

function remarkMermaidSvg(): (tree: Root) => void {
  return (tree) => {
    visitParents(tree, (node) => {
      if (!isMermaidElement(node)) {
        return;
      }
      const chart = node.attributes.find((attribute) => isChartAttribute(attribute));
      if (!isChartAttribute(chart)) {
        throw new Error("a Mermaid element carries no chart");
      }
      const diagram = renderDiagram(chart.value);
      Reflect.set(node, "attributes", [
        ...node.attributes,
        { name: "svg", type: "mdxJsxAttribute", value: diagram.svg },
        { name: "aspect", type: "mdxJsxAttribute", value: `${diagram.width} / ${diagram.height}` },
      ]);
    });
  };
}

export { remarkMermaidSvg };
