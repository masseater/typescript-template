import { importVisitor, reportViolation, type LintContext, type Node } from "./lint-context.ts";
import { replacementForImport } from "./retired-packages.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const retiredImportsVisitor = (inspection: LintContext): Visitor => {
  return importVisitor((node: Node) => {
    if (
      node.type === "Literal" &&
      typeof node.value === "string" &&
      replacementForImport(node.value) !== undefined
    ) {
      reportViolation(inspection, node);
    }
  });
};

export { retiredImportsVisitor };
