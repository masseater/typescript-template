import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { AsyncResult } from "effect/unstable/reactivity";
import type { ReactElement } from "react";
import { resultError } from "@template/ui";
import { useDiagram } from "#pages/docs/model/diagram.ts";
import { useId } from "react";
import { useTheme } from "fumadocs-ui/provider/base";

function Mermaid({ chart }: Readonly<{ chart: string }>): ReactElement {
  const { resolvedTheme } = useTheme();
  const result = useDiagram(chart, resolvedTheme === "dark", `mermaid-${useId()}`);
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
