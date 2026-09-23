import { type Node, type NodeProps } from "@xyflow/react";

import { DiagramCanvas } from "./diagram-canvas.tsx";

import type { ReactElement } from "react";

type SvgNode = Node<{ svg: string }, "svg">;

function SvgNodeView({ data }: NodeProps<SvgNode>): ReactElement {
  const place = (container: HTMLDivElement | null): void => {
    const parsed = new DOMParser().parseFromString(data.svg, "image/svg+xml").documentElement;
    container?.replaceChildren(document.importNode(parsed, true));
  };
  return <div ref={place} />;
}

const nodeTypes = { svg: SvgNodeView };

function SvgDiagram({ svg }: Readonly<{ svg: string }>): ReactElement {
  return (
    <DiagramCanvas
      defaultEdges={[]}
      defaultNodes={[{ data: { svg }, id: "diagram", position: { x: 0, y: 0 }, type: "svg" }]}
      edgeTypes={{}}
      nodesDraggable={false}
      nodeTypes={nodeTypes}
    />
  );
}

export { SvgDiagram };
