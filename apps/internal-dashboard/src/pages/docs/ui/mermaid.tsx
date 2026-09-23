import { resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { useTheme } from "fumadocs-ui/provider/base";
import { useId } from "react";

import { useDiagram } from "#pages/docs/model/diagram.ts";
import { ErDiagram } from "./er-diagram.tsx";
import { SvgDiagram } from "./svg-diagram.tsx";

import type { ReactElement } from "react";

function Mermaid({ chart }: Readonly<{ chart: string }>): ReactElement {
  const { resolvedTheme } = useTheme();
  const diagram = useDiagram(chart, resolvedTheme === "dark", `mermaid-${useId()}`);
  const drawn = AsyncResult.isSuccess(diagram) ? diagram.value : undefined;
  const failure = resultError(diagram);
  return (
    <figure
      className="bg-fd-background not-prose my-6"
      aria-busy={drawn === undefined && failure === undefined}
    >
      {drawn?.kind === "er" && <ErDiagram graph={drawn.graph} />}
      {drawn?.kind === "svg" && <SvgDiagram svg={drawn.svg} />}
      {failure !== undefined && (
        <figcaption role="alert">図を描画できませんでした: {failure}</figcaption>
      )}
      {drawn === undefined && (
        <CodeBlock title="mermaid">
          <Pre>{chart}</Pre>
        </CodeBlock>
      )}
    </figure>
  );
}

export { Mermaid };
