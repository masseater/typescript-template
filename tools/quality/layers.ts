import { applications } from "@template/config";

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

const isOutsideLayers = (current: string): boolean => {
  const groups = /\/apps\/(?<app>[^/]+)\/src\/(?<inside>.+)$/u.exec(current)?.groups;
  const [layer, ...segments] = groups?.inside?.split("/") ?? [];
  return (
    layeredApps.includes(groups?.app ?? "") && (segments.length === 0 || !layers.has(layer ?? ""))
  );
};

const layersVisitor = (context: LintContext): Visitor => {
  if (!isOutsideLayers(context.filename.replaceAll("\\", "/"))) {
    return {};
  }
  return {
    Program(node: Node): void {
      reportViolation(context, node);
    },
  };
};

export { layersVisitor };
