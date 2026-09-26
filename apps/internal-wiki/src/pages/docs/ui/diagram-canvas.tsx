import {
  Background,
  ControlButton,
  Controls,
  ReactFlow,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { Effect } from "effect";
import { useTheme } from "fumadocs-ui/provider/base";
import { Fullscreen } from "lucide-react";

import type { MouseEvent, ReactElement, ReactNode } from "react";

type DiagramCanvasProps = Readonly<{
  aspect: string;
  children?: ReactNode;
  defaultEdges: Edge[];
  defaultNodes: Node[];
  edgeTypes: EdgeTypes;
  nodesDraggable: boolean;
  nodeTypes: NodeTypes;
}>;

const toggleFullscreen = (figure: HTMLElement): Promise<void> =>
  document.fullscreenElement === figure ? document.exitFullscreen() : figure.requestFullscreen();

const nextFrame = Effect.callback<number>((resume) => {
  requestAnimationFrame((time) => {
    resume(Effect.succeed(time));
  });
});

const toggleAndFit = Effect.fn("toggleAndFit")(function* toggleAndFit(
  figure: HTMLElement | null,
  fitView: () => Promise<boolean>,
) {
  if (figure === null) {
    return yield* Effect.die(new Error("the diagram controls sit outside their figure"));
  }
  yield* Effect.promise(() => toggleFullscreen(figure));
  yield* nextFrame;
  yield* nextFrame;
  return yield* Effect.promise(() => fitView());
});

function FullscreenButton(): ReactElement {
  const { fitView } = useReactFlow();
  const toggle = (event: MouseEvent<HTMLButtonElement>): Promise<boolean> =>
    Effect.runPromise(toggleAndFit(event.currentTarget.closest("figure"), () => fitView()));
  return (
    <ControlButton
      aria-label="全画面で表示"
      onClick={(event) => void toggle(event)}
      title="全画面で表示"
    >
      <Fullscreen />
    </ControlButton>
  );
}

function DiagramCanvas({
  aspect,
  children,
  defaultEdges,
  defaultNodes,
  edgeTypes,
  nodesDraggable,
  nodeTypes,
}: DiagramCanvasProps): ReactElement {
  const { resolvedTheme } = useTheme();
  return (
    <div
      style={{ aspectRatio: aspect }}
      className="border-fd-border bg-fd-background max-h-svh min-h-60 w-full overflow-hidden rounded-md border in-[:fullscreen]:aspect-auto in-[:fullscreen]:h-full in-[:fullscreen]:rounded-none in-[:fullscreen]:border-0"
    >
      <ReactFlow
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        defaultEdges={defaultEdges}
        defaultNodes={defaultNodes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        minZoom={0.05}
        nodesDraggable={nodesDraggable}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false}>
          <FullscreenButton />
        </Controls>
        {children}
      </ReactFlow>
    </div>
  );
}

export { DiagramCanvas };
