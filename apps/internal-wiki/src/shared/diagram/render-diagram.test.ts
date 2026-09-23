import { fromHtml } from "hast-util-from-html";
import { remark } from "remark";
import { visitParents } from "unist-util-visit-parents";
import { describe, expect, it } from "vite-plus/test";

import { readGeometry } from "./diagram-geometry.ts";
import { overlapsOf } from "./diagram-overlaps.ts";
import { renderDiagram } from "./render-diagram.ts";

const wikiPages: Readonly<Record<string, string>> = import.meta.glob(
  "../../../../internal-dashboard/content/docs/**/*.md",
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
);

const wikiDiagrams = Object.entries(wikiPages).flatMap(([path, markdown]) => {
  const charts: string[] = [];
  visitParents(remark().parse(markdown), "code", (node) => {
    if (node.lang === "mermaid") {
      charts.push(node.value);
    }
  });
  return charts.map((chart, index) => ({
    chart,
    name: `${path.replace("../../../../internal-dashboard/content/docs/", "")} #${index + 1}`,
  }));
});

describe("every Mermaid diagram in the wiki", () => {
  it("is found in the wiki pages", () => {
    expect(wikiDiagrams.length).toBeGreaterThan(0);
  });

  it.each(wikiDiagrams)(
    "$name renders with no shape, route or label drawn over another",
    ({ chart }) => {
      expect(
        overlapsOf(readGeometry(fromHtml(renderDiagram(chart).svg, { fragment: true }))),
      ).toStrictEqual([]);
    },
  );
});
