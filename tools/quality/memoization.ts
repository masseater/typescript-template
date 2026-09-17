import type { LintContext, Node } from "./lint-context.ts";
import type { Origin } from "./references.ts";
import type { Visitor } from "vite-plus/lint/plugins";
import { aliasVisitor } from "./alias-visitor.ts";
import { origins } from "./references.ts";
import { reportViolation } from "./lint-context.ts";

const memoizationApis = new Set(["memo", "useCallback", "useMemo"]);

function isManualMemoization(origin: Origin): boolean {
  const [source, ...members] = origin;
  return source === "react" && members.some((member) => memoizationApis.has(member));
}

function memoizationVisitor(context: LintContext): Visitor {
  return {
    ...aliasVisitor(context, isManualMemoization),
    CallExpression(node: Node): void {
      if (
        node.type === "CallExpression" &&
        origins(context, node.callee).some((origin) => isManualMemoization(origin))
      ) {
        reportViolation(context, node.callee);
      }
    },
  };
}

export { memoizationVisitor };
