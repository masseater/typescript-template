import { useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";
import { createClientOnlyFn } from "@tanstack/react-start";
import { Atom } from "effect/unstable/reactivity";

const renderChart = createClientOnlyFn(
  async ({
    chart,
    dark,
    id,
  }: Readonly<{ chart: string; dark: boolean; id: string }>): Promise<string> => {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      fontFamily: "inherit",
      securityLevel: "strict",
      startOnLoad: false,
      theme: dark ? "dark" : "default",
    });
    await mermaid.parse(chart);
    const { svg } = await mermaid.render(id, chart);
    return svg;
  },
);

const diagramAtom = Atom.family((diagram: Readonly<{ chart: string; dark: boolean; id: string }>) =>
  requestAtom(async () => renderChart(diagram)),
);

function useDiagram(chart: string, dark: boolean, id: string): RequestResult<string> {
  return useAtomValue(diagramAtom({ chart, dark, id }));
}

export { useDiagram };
