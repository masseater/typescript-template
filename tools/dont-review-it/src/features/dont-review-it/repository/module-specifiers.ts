import { importVisitor, reportViolation, type LintContext, type Node } from "./lint-context.ts";
import { origins, type Origin } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const isApplicationOrLibrary = (inspection: LintContext): boolean => {
  return /\/(?:apps|libs)\/[^/]+\//u.test(inspection.filename.replaceAll("\\", "/"));
};

const isCommonJsLoader = (origin: Origin): boolean => {
  const [source, ...members] = origin;
  return (
    (source === "require" && members.length === 0) ||
    ((source === "node:module" || source === "module") && members[0] === "createRequire")
  );
};

const specifierVisitor = (
  inspection: LintContext,
): {
  readonly commonJs: (node: Node) => void;
  readonly loaderCall: (callee: Node) => boolean;
  readonly visitor: Visitor;
} => {
  const shipped = isApplicationOrLibrary(inspection);
  const commonJs = (node: Node): void => {
    if (shipped) {
      reportViolation(inspection, node);
    }
  };
  return {
    commonJs,
    loaderCall: (callee) => origins(inspection, callee).some((origin) => isCommonJsLoader(origin)),
    visitor: {
      ...importVisitor((node: Node) => {
        if (shipped && (node.type !== "Literal" || typeof node.value !== "string")) {
          reportViolation(inspection, node);
        }
      }),
      TSExternalModuleReference(node: Node): void {
        if (node.type === "TSExternalModuleReference") {
          commonJs(node);
        }
      },
    },
  };
};

export { specifierVisitor };
