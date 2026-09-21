import { resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { useTheme } from "fumadocs-ui/provider/base";
import { useId } from "react";

import { useDiagram } from "#pages/docs/model/diagram.ts";

import type { ReactElement } from "react";

function Mermaid({ chart }: Readonly<{ chart: string }>): ReactElement {
  const { resolvedTheme } = useTheme();
  const diagram = useDiagram(chart, resolvedTheme === "dark", `mermaid-${useId()}`);
  const svg = AsyncResult.isSuccess(diagram) ? diagram.value : undefined;
  const failure = resultError(diagram);
  const place = (container: HTMLDivElement | null): void => {
    if (container !== null && svg !== undefined) {
      container.replaceChildren(document.createRange().createContextualFragment(svg));
    }
  };
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
