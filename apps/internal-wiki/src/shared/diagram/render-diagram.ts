import { renderMermaidSVG } from "beautiful-mermaid";
import { Schema } from "effect";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";

import { DiagramCrowded } from "./diagram-crowded.ts";
import { readGeometry, svgOf } from "./diagram-geometry.ts";
import { untangleDiagram } from "./untangle-diagram.ts";

import type { Element } from "hast";
import type { Box } from "./diagram-geometry.ts";

const themeColors = {
  accent: "var(--color-fd-primary)",
  bg: "var(--color-fd-background)",
  border: "var(--color-fd-border)",
  fg: "var(--color-fd-foreground)",
  line: "var(--color-fd-muted-foreground)",
  muted: "var(--color-fd-muted-foreground)",
  surface: "var(--color-fd-card)",
} as const;

const viewBoxOf = (svg: Element): Box => {
  const [x, y, width, height] = String(svg.properties["viewBox"]).split(" ").map(Number);
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    throw new Error("the rendered diagram has no viewBox");
  }
  return { height, width, x, y };
};

const dropFontImports = (svg: Element): void => {
  for (const style of svg.children) {
    if (style.type === "element" && style.tagName === "style") {
      for (const text of style.children) {
        if (text.type === "text") {
          text.value = text.value
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("@import"))
            .join("\n");
        }
      }
    }
  }
};

const isCrowded = Schema.is(DiagramCrowded);

const SPACING_STEPS = [1, 2, 3, 4];
const NODE_SPACING = 24;
const LAYER_SPACING = 40;

type RenderedDiagram = Readonly<{ height: number; svg: string; width: number }>;

const renderSpaced = (chart: string, spread: number): RenderedDiagram => {
  const tree = fromHtml(
    renderMermaidSVG(chart, {
      ...themeColors,
      layerSpacing: LAYER_SPACING * spread,
      nodeSpacing: NODE_SPACING * spread,
      transparent: true,
    }),
    { fragment: true },
  );
  const svg = svgOf(tree);
  dropFontImports(svg);
  const { canvas, overlaps } = untangleDiagram(readGeometry(tree), viewBoxOf(svg));
  if (overlaps.length > 0) {
    throw DiagramCrowded.make({
      reason: `the diagram still overlaps after untangling: ${JSON.stringify(overlaps)}`,
    });
  }
  svg.properties["viewBox"] = `${canvas.x} ${canvas.y} ${canvas.width} ${canvas.height}`;
  svg.properties["width"] = String(canvas.width);
  svg.properties["height"] = String(canvas.height);
  return { height: canvas.height, svg: toHtml(svg, { space: "svg" }), width: canvas.width };
};

const renderDiagram = (chart: string): RenderedDiagram => {
  const failures: string[] = [];
  for (const spread of SPACING_STEPS) {
    try {
      return renderSpaced(chart, spread);
    } catch (error) {
      if (!isCrowded(error)) {
        throw error;
      }
      failures.push(`x${spread}: ${error.reason}`);
    }
  }
  throw new Error(`the diagram stays crowded at every spacing:\n${failures.join("\n")}\n${chart}`);
};

export { renderDiagram };
export type { RenderedDiagram };
