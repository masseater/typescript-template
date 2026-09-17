import type { LintContext, Node } from "./lint-context.ts";
import type { Origin } from "./references.ts";
import { origins } from "./references.ts";
import { reportViolation } from "./lint-context.ts";

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

function specifierChecks(context: LintContext): {
  readonly commonJs: (node: Node) => void;
  readonly loaderCall: (callee: Node) => boolean;
  readonly source: (node: Node) => void;
} {
  const shipped = isApplicationOrLibrary(context);
  return {
    commonJs: (node) => {
      if (shipped) {
        reportViolation(context, node);
      }
    },
    loaderCall: (callee) => origins(context, callee).some((origin) => isCommonJsLoader(origin)),
    source: (node) => {
      if (shipped && (node.type !== "Literal" || typeof node.value !== "string")) {
        reportViolation(context, node);
      }
    },
  };
}

export { specifierChecks };
