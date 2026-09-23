import { fromHtml } from "hast-util-from-html";
import { describe, expect, it } from "vite-plus/test";

import { readGeometry } from "./diagram-geometry.ts";

const wrappedAtSpace = `<svg viewBox="0 0 200 100">
  <polyline class="edge" data-from="a" data-to="b" data-label="AI にインタビュー" points="20,50 180,50"/>
  <g class="edge-label" data-from="a" data-to="b"><rect x="60" y="30" width="80" height="40"/><text x="100" y="45" text-anchor="middle"><tspan x="100">AI</tspan><tspan x="100" dy="14">にインタビュー</tspan></text></g>
  <g class="node" data-id="a"><rect x="0" y="40" width="20" height="20"/></g>
  <g class="node" data-id="b"><rect x="180" y="40" width="20" height="20"/></g>
</svg>`;

describe("readGeometry", () => {
  const geometry = readGeometry(fromHtml(wrappedAtSpace, { fragment: true }));

  it("reads a label wrapped at a space as the label of its route", () => {
    expect(geometry.labels.map((label) => label.route.label)).toStrictEqual(["AI にインタビュー"]);
  });
});
