import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { request, resultError } from "@template/ui";
import type { ReactElement } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useAtomValue } from "@effect/atom-react";
import { useId } from "react";
import { useTheme } from "fumadocs-ui/provider/base";

interface Diagram {
  readonly chart: string;
  readonly dark: boolean;
  readonly id: string;
}

const renderChart = createClientOnlyFn(async ({ chart, dark, id }: Diagram): Promise<string> => {
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
});

const diagramAtom = Atom.family((diagram: Diagram) =>
  Atom.make(request(async () => renderChart(diagram))).pipe(Atom.withServerValueInitial),
);

function Mermaid({ chart }: Readonly<{ chart: string }>): ReactElement {
  const id = `mermaid-${useId()}`;
  const { resolvedTheme } = useTheme();
  const result = useAtomValue(diagramAtom({ chart, dark: resolvedTheme === "dark", id }));
  const svg = AsyncResult.isSuccess(result) ? result.value : undefined;
  const failure = resultError(result);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  function place(container: HTMLDivElement | null): void {
    if (container !== null && svg !== undefined) {
      container.replaceChildren(document.createRange().createContextualFragment(svg));
    }
  }
  return (
    <figure className="my-6" aria-busy={svg === undefined && failure === undefined}>
      <div ref={place} className="flex justify-center" hidden={svg === undefined} />
      {failure !== undefined && (
        <figcaption role="alert">図を描画できませんでした: {failure}</figcaption>
      )}
      {svg === undefined && (
        <CodeBlock title="mermaid">
          <Pre>{chart}</Pre>
        </CodeBlock>
      )}
    </figure>
  );
}

export { Mermaid };
