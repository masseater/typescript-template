import { type Node, type NodeProps } from "@xyflow/react";

import { fitDiagramText } from "#pages/docs/model/fit-diagram-text.ts";
import { DiagramCanvas } from "./diagram-canvas.tsx";

import type { ReactElement } from "react";

type SvgNode = Node<{ svg: string }, "svg">;

function SvgNodeView({ data }: NodeProps<SvgNode>): ReactElement {
  const place = (container: HTMLDivElement | null): void => {
    if (container === null) {
      return;
    }
    const parsed = new DOMParser().parseFromString(data.svg, "image/svg+xml").documentElement;
    const svg = document.importNode(parsed, true);
    container.replaceChildren(svg);
    if (!(svg instanceof SVGSVGElement)) {
      throw new Error("the diagram is not an SVG document");
    }
    fitDiagramText(svg);
  };
  return <div ref={place} />;
}

const nodeTypes = { svg: SvgNodeView };

function SvgDiagram({ aspect, svg }: Readonly<{ aspect: string; svg: string }>): ReactElement {
  return (
    <DiagramCanvas
      aspect={aspect}
      defaultEdges={[]}
      defaultNodes={[{ data: { svg }, id: "diagram", position: { x: 0, y: 0 }, type: "svg" }]}
      edgeTypes={{}}
      nodesDraggable={false}
      nodeTypes={nodeTypes}
    />
  );
}

export { SvgDiagram };
