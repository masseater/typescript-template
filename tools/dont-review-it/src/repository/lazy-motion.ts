import { reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const motionEntry = "motion/react";

const eagerComponent = "motion";

const importedName = (node: Node): string | undefined => {
  if (node.type === "ImportSpecifier") {
    return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
  }
  if (node.type === "ExportSpecifier") {
    return node.local.type === "Identifier" ? node.local.name : node.local.value;
  }
  return undefined;
};

const reportEagerComponents = (inspection: LintContext, specifiers: readonly Node[]): void => {
  for (const specifier of specifiers) {
    if (importedName(specifier) === eagerComponent) {
      reportViolation(inspection, specifier);
    }
  }
};

const lazyMotionVisitor = (inspection: LintContext): Visitor => {
  return {
    ExportNamedDeclaration(node: Node): void {
      if (node.type === "ExportNamedDeclaration" && node.source?.value === motionEntry) {
        reportEagerComponents(inspection, node.specifiers);
      }
    },
    ImportDeclaration(node: Node): void {
      if (node.type === "ImportDeclaration" && node.source.value === motionEntry) {
        reportEagerComponents(inspection, node.specifiers);
      }
    },
  };
};

export { lazyMotionVisitor };
