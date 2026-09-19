import { createClientOnlyFn } from "@tanstack/react-start";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { useTheme } from "fumadocs-ui/provider/base";
import { useEffect, useId, useRef, useState } from "react";

import type { ReactElement } from "react";

const renderChart = createClientOnlyFn(
  async (id: string, chart: string, dark: boolean): Promise<DocumentFragment> => {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      fontFamily: "inherit",
      securityLevel: "strict",
      startOnLoad: false,
      theme: dark ? "dark" : "default",
    });
    await mermaid.parse(chart);
    const { svg } = await mermaid.render(id, chart);
    return document.createRange().createContextualFragment(svg);
  },
);

function Mermaid({ chart }: Readonly<{ chart: string }>): ReactElement {
  const id = `mermaid-${useId()}`;
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState<
    | { readonly status: "failed"; readonly message: string }
    | { readonly status: "pending" | "rendered" }
  >({ status: "pending" });
  useEffect(() => {
    const controller = { active: true };
    async function render(): Promise<void> {
      try {
        const diagram = await renderChart(id, chart, resolvedTheme === "dark");
        if (controller.active) {
          container.current?.replaceChildren(diagram);
          setRendering({ status: "rendered" });
        }
      } catch (error) {
        if (controller.active) {
          setRendering({
            message: error instanceof Error ? error.message : String(error),
            status: "failed",
          });
        }
      }
    }
    void render();
    return (): void => {
      controller.active = false;
    };
  }, [chart, id, resolvedTheme]);
  return (
    <figure className="my-6" aria-busy={rendering.status === "pending"}>
      <div
        ref={container}
        className="flex justify-center"
        hidden={rendering.status !== "rendered"}
      />
      {rendering.status === "failed" && (
        <figcaption role="alert">図を描画できませんでした: {rendering.message}</figcaption>
      )}
      {rendering.status !== "rendered" && (
        <CodeBlock title="mermaid">
          <Pre>{chart}</Pre>
        </CodeBlock>
      )}
    </figure>
  );
}

export { Mermaid };
