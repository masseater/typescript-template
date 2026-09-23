import { useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";
import { createClientOnlyFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

const renderChart = createClientOnlyFn(
  ({ chart, dark, id }: Readonly<{ chart: string; dark: boolean; id: string }>): Promise<string> =>
    Effect.runPromise(
      Effect.gen(function* renderMermaid() {
        const { default: mermaid } = yield* Effect.promise(() => import("mermaid"));
        mermaid.initialize({
          fontFamily: "inherit",
          securityLevel: "strict",
          startOnLoad: false,
          theme: dark ? "dark" : "default",
        });
        yield* Effect.promise(() => mermaid.parse(chart));
        const { svg } = yield* Effect.promise(() => mermaid.render(id, chart));
        return svg;
      }),
    ),
);

const diagramAtom = Atom.family((diagram: Readonly<{ chart: string; dark: boolean; id: string }>) =>
  requestAtom(() => renderChart(diagram)),
);

function useDiagram(chart: string, dark: boolean, id: string): RequestResult<string> {
  return useAtomValue(diagramAtom({ chart, dark, id }));
}

export { useDiagram };
