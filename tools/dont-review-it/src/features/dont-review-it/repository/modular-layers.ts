import { architectureKindOf, modularLayers } from "@repo/config";

import { reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const modularLayerSet: ReadonlySet<string> = new Set(modularLayers);

const workspaceSource = (
  inspected: string,
): { readonly inside: string; readonly workspacePath: string } | undefined => {
  const matched =
    /\/(?<area>apps|libs|tools|infra)\/(?<name>[^/]+)\/src\/(?<inside>.+)$/u.exec(inspected)
      ?.groups;
  if (
    matched?.["area"] === undefined ||
    matched["name"] === undefined ||
    matched["inside"] === undefined
  ) {
    return undefined;
  }
  return {
    inside: matched["inside"],
    workspacePath: `${matched["area"]}/${matched["name"]}`,
  };
};

const isOutsideModularLayers = (inspected: string): boolean => {
  const source = workspaceSource(inspected);
  if (source === undefined || architectureKindOf(source.workspacePath) !== "modular") {
    return false;
  }
  const [layer, ...segments] = source.inside.split("/");
  if (layer === undefined || !modularLayerSet.has(layer)) {
    return true;
  }
  if (layer === "features") {
    return segments.length === 0;
  }
  return false;
};

const modularLayersVisitor = (inspection: LintContext): Visitor => {
  if (!isOutsideModularLayers(inspection.filename.replaceAll("\\", "/"))) {
    return {};
  }
  return {
    Program(node: Node): void {
      reportViolation(inspection, node);
    },
  };
};

export { modularLayersVisitor, workspaceSource };
