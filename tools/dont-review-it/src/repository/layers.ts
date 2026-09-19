import { applications } from "@repo/config";

import { reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const layeredApps: readonly string[] = applications;
const layers: ReadonlySet<string> = new Set([
  "app",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
]);

const isOutsideLayers = (inspected: string): boolean => {
  const matched = /\/apps\/(?<app>[^/]+)\/src\/(?<inside>.+)$/u.exec(inspected)?.groups;
  const [layer, ...segments] = matched?.inside?.split("/") ?? [];
  return (
    layeredApps.includes(matched?.app ?? "") && (segments.length === 0 || !layers.has(layer ?? ""))
  );
};

const layersVisitor = (inspection: LintContext): Visitor => {
  if (!isOutsideLayers(inspection.filename.replaceAll("\\", "/"))) {
    return {};
  }
  return {
    Program(node: Node): void {
      reportViolation(inspection, node);
    },
  };
};

export { layersVisitor };
