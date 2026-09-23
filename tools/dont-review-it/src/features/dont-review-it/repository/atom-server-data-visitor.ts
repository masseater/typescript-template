import { originVisitor } from "./alias-visitor.ts";
import { holdsServerData, isServerCacheApi } from "./atom-server-data.ts";
import { reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const atomServerDataVisitor = (inspection: LintContext): Visitor => {
  return {
    ...originVisitor(inspection, isServerCacheApi, (node) => holdsServerData(inspection, node)),
    ExportNamedDeclaration(node: Node): void {
      if (node.type !== "ExportNamedDeclaration" || !node.source) {
        return;
      }
      for (const specifier of node.specifiers) {
        const exported =
          specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
        if (isServerCacheApi([node.source.value, exported])) {
          reportViolation(inspection, specifier);
        }
      }
    },
  };
};

export { atomServerDataVisitor };
