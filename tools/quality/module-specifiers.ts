import { importVisitor, reportViolation } from "./lint-context.ts";
import { origins } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";
import type { LintContext, Node } from "./lint-context.ts";
import type { Origin } from "./references.ts";

function isApplicationOrLibrary(context: LintContext): boolean {
  return /\/(?:apps|libs)\/[^/]+\//u.test(context.filename.replaceAll("\\", "/"));
}

function isCommonJsLoader(origin: Origin): boolean {
  const [source, ...members] = origin;
  return (
    (source === "require" && members.length === 0) ||
    ((source === "node:module" || source === "module") && members[0] === "createRequire")
  );
}

function specifierVisitor(context: LintContext): {
  readonly commonJs: (node: Node) => void;
  readonly loaderCall: (callee: Node) => boolean;
  readonly visitor: Visitor;
} {
  const shipped = isApplicationOrLibrary(context);
  function commonJs(node: Node): void {
    if (shipped) {
      reportViolation(context, node);
    }
  }
  return {
    commonJs,
    loaderCall: (callee) => origins(context, callee).some((origin) => isCommonJsLoader(origin)),
    visitor: {
      ...importVisitor((node: Node) => {
        if (shipped && (node.type !== "Literal" || typeof node.value !== "string")) {
          reportViolation(context, node);
        }
      }),
      TSExternalModuleReference(node: Node): void {
        if (node.type === "TSExternalModuleReference") {
          commonJs(node);
        }
      },
    },
  };
}

export { specifierVisitor };
