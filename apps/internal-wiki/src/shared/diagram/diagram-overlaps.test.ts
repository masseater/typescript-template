import { fromHtml } from "hast-util-from-html";
import { describe, expect, it } from "vite-plus/test";

import { readGeometry } from "./diagram-geometry.ts";
import { overlapsOf } from "./diagram-overlaps.ts";

const node = (id: string, x: number, y: number): string =>
  `<g class="node" data-id="${id}"><rect x="${x}" y="${y}" width="40" height="20"/></g>`;

const tangled = `<svg viewBox="0 0 400 200">
  <polyline class="edge" data-from="a" data-to="c" data-label="goes" points="40,10 360,10"/>
  <polyline class="edge" data-from="d" data-to="e" points="150,100 300,100"/>
  <polyline class="edge" data-from="f" data-to="g" points="200,100 350,100"/>
  <g class="edge-label" data-from="a" data-to="c"><rect x="80" y="2" width="30" height="16"/><text x="95" y="10" text-anchor="middle">goes</text></g>
  ${node("a", 0, 0)}${node("b", 180, 0)}${node("c", 360, 0)}${node("h", 90, 5)}${node("i", 110, 10)}
</svg>`;

describe("overlapsOf", () => {
  const found = overlapsOf(readGeometry(fromHtml(tangled, { fragment: true })));

  it("reports a route drawn through a shape it does not connect", () => {
    expect(found).toContainEqual({ kind: "route-through-shape", subjects: ["route a->c", "b"] });
  });

  it("reports routes drawn along one another between different ends", () => {
    expect(found).toContainEqual({ kind: "route-route", subjects: ["route d->e", "route f->g"] });
  });

  it("reports shapes drawn over one another", () => {
    expect(found).toContainEqual({ kind: "shape-shape", subjects: ["h", "i"] });
  });

  it("reports a label drawn over a shape", () => {
    expect(found).toContainEqual({ kind: "label-shape", subjects: ["label a->c", "h"] });
  });
});
