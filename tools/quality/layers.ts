import type { Visitor } from "vite-plus/lint/plugins";

import { applications } from "@repo/config";

import type { LintContext, Node } from "./lint-context.ts";
import { reportViolation } from "./lint-context.ts";

const layeredApps: readonly string[] = applications;
const layers: ReadonlySet<string> = new Set([
  "app",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
]);

function isOutsideLayers(current: string): boolean {
  const groups = /\/apps\/(?<app>[^/]+)\/src\/(?<inside>.+)$/u.exec(current)?.groups;
  const [layer, ...segments] = groups?.["inside"]?.split("/") ?? [];
  return (
    layeredApps.includes(groups?.["app"] ?? "") &&
    (segments.length === 0 || !layers.has(layer ?? ""))
  );
}

function layersVisitor(context: LintContext): Visitor {
  if (!isOutsideLayers(context.filename.replaceAll("\\", "/"))) {
    return {};
  }
  return {
    Program(node: Node): void {
      reportViolation(context, node);
    },
  };
}

export { layersVisitor };
