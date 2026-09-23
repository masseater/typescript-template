import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MiniMap,
  Position,
  useInternalNode,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useId } from "react";

import { DiagramCanvas } from "./diagram-canvas.tsx";

import type { Cardinality, ErGraph, ErLink, ErTable } from "#pages/docs/model/er-graph.ts";
import type { ReactElement } from "react";

type TableNode = Node<ErTable, "table">;
type LinkEdge = Edge<ErLink & { markerPrefix: string }, "link">;

const cardinalityMarks: Readonly<Record<Cardinality, ReactElement>> = {
  ONE_OR_MORE: <path d="M 12 3 L 12 17 M 12 10 L 20 3 M 12 10 L 20 17 M 12 10 L 20 10" />,
  ONLY_ONE: <path d="M 10 3 L 10 17 M 14 3 L 14 17" />,
  ZERO_OR_MORE: (
    <>
      <circle cx="7" cy="10" r="3.5" />
      <path d="M 12 10 L 20 3 M 12 10 L 20 17 M 12 10 L 20 10" />
    </>
  ),
  ZERO_OR_ONE: (
    <>
      <circle cx="7" cy="10" r="3.5" />
      <path d="M 14 3 L 14 17" />
    </>
  ),
};

function CardinalityMarkers({ prefix }: Readonly<{ prefix: string }>): ReactElement {
  return (
    <svg aria-hidden className="absolute size-0">
      <defs>
        {Object.entries(cardinalityMarks).map(([name, mark]) => (
          <marker
            key={name}
            id={`${prefix}-${name}`}
            className="fill-fd-background stroke-fd-muted-foreground"
            markerHeight="20"
            markerUnits="userSpaceOnUse"
            markerWidth="20"
            orient="auto-start-reverse"
            refX="20"
            refY="10"
            viewBox="0 0 20 20"
          >
            {mark}
          </marker>
        ))}
      </defs>
    </svg>
  );
}

function TableNodeView({ data, selected }: NodeProps<TableNode>): ReactElement {
  return (
    <div
      className={`bg-fd-card text-fd-card-foreground size-full overflow-hidden rounded-md border font-mono text-xs shadow-sm ${selected ? "border-fd-foreground ring-fd-foreground ring-1" : "border-fd-border"}`}
    >
      <Handle className="opacity-0" isConnectable={false} position={Position.Top} type="target" />
      <p className="bg-fd-muted flex h-8 items-center px-3 font-bold whitespace-pre">
        {data.label}
      </p>
      <div className="grid grid-cols-[repeat(4,auto)] justify-start gap-x-4 px-3 whitespace-pre">
        {data.attributes.map((attribute) => (
          <div
            key={attribute.name}
            className="border-fd-border col-span-4 grid h-6 grid-cols-subgrid items-center border-t"
          >
            <span className="text-fd-muted-foreground">{attribute.type}</span>
            <span>{attribute.name}</span>
            <span className="text-fd-primary font-bold">{attribute.keys.join(",")}</span>
            <span className="text-fd-muted-foreground">{attribute.comment}</span>
          </div>
        ))}
      </div>
      <Handle
        className="opacity-0"
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

function LinkEdgeView({
  data,
  source,
  sourcePosition,
  sourceX,
  sourceY,
  target,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<LinkEdge>): ReactElement {
  const sourceSelected = useInternalNode(source)?.selected === true;
  const targetSelected = useInternalNode(target)?.selected === true;
  const touchesSelection = sourceSelected || targetSelected;
  if (data === undefined) {
    throw new Error("an ER link edge was drawn without its relationship");
  }
  const [path, labelX, labelY] = getBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });
  return (
    <>
      <BaseEdge
        className={`${touchesSelection ? "stroke-fd-foreground stroke-2" : "stroke-fd-muted-foreground"} fill-none ${data.dashed ? "[stroke-dasharray:6_4]" : ""}`}
        markerEnd={`url(#${data.markerPrefix}-${data.targetEnd})`}
        markerStart={`url(#${data.markerPrefix}-${data.sourceEnd})`}
        path={path}
      />
      {data.label !== "" && (
        <EdgeLabelRenderer>
          <span
            className={`bg-fd-background text-fd-muted-foreground nodrag nopan absolute rounded-sm px-1 font-mono text-xs ${touchesSelection ? "text-fd-foreground font-bold" : ""}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { table: TableNodeView };
const edgeTypes = { link: LinkEdgeView };

function ErDiagram({ graph }: Readonly<{ graph: ErGraph }>): ReactElement {
  const markerPrefix = `er-marker-${useId().replaceAll(":", "")}`;
  return (
    <DiagramCanvas
      defaultEdges={graph.links.map((link): LinkEdge => ({
        data: { ...link, markerPrefix },
        id: link.id,
        source: link.source,
        target: link.target,
        type: "link",
      }))}
      defaultNodes={graph.tables.map((table): TableNode => ({
        data: table,
        height: table.height,
        id: table.id,
        position: { x: table.x, y: table.y },
        type: "table",
        width: table.width,
      }))}
      edgeTypes={edgeTypes}
      nodesDraggable
      nodeTypes={nodeTypes}
    >
      <CardinalityMarkers prefix={markerPrefix} />
      <MiniMap pannable zoomable />
    </DiagramCanvas>
  );
}

export { ErDiagram };
