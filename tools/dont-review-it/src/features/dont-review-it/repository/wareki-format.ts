import { filename, reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const warekiOwner = /\/libs\/ui\/src\/wareki\.ts$/u;

const isDateTimeFormat = (node: Node): boolean => {
  if (node.type !== "NewExpression") {
    return false;
  }
  const callee = node.callee;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Intl" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "DateTimeFormat"
  );
};

const warekiFormatVisitor = (inspection: LintContext): Visitor => {
  if (warekiOwner.test(filename(inspection))) {
    return {};
  }
  return {
    NewExpression(node: Node): void {
      if (isDateTimeFormat(node)) {
        reportViolation(inspection, node);
      }
    },
  };
};

export { warekiFormatVisitor };
