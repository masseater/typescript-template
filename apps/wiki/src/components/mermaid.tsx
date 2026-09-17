import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useTheme } from "next-themes";

type Rendering = "failed" | "pending" | "rendered";

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
  const id = `mermaid-${useId().replaceAll(":", "")}`;
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState<Rendering>("pending");
  const [failure, setFailure] = useState("");
  useEffect(() => {
    const controller = { active: true };
    async function render(): Promise<void> {
      try {
        const diagram = await renderChart(id, chart, resolvedTheme === "dark");
        if (controller.active) {
          container.current?.replaceChildren(diagram);
          setRendering("rendered");
        }
      } catch (error) {
        if (controller.active) {
          setFailure(error instanceof Error ? error.message : String(error));
          setRendering("failed");
        }
      }
    }
    void render();
    return (): void => {
      controller.active = false;
    };
  }, [chart, id, resolvedTheme]);
  return (
    <figure className="my-6" aria-busy={rendering === "pending"}>
      <div ref={container} className="flex justify-center" hidden={rendering !== "rendered"} />
      {rendering === "failed" && (
        <figcaption role="alert">図を描画できませんでした: {failure}</figcaption>
      )}
      {rendering !== "rendered" && (
        <CodeBlock title="mermaid">
          <Pre>{chart}</Pre>
        </CodeBlock>
      )}
    </figure>
  );
}

export { Mermaid };
