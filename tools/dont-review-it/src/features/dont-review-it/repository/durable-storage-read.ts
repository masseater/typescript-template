import { reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const namesStorage = (node: Node): boolean =>
  (node.type === "Identifier" && node.name === "storage") ||
  (node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier" &&
    node.property.name === "storage");

const isTypedStorageRead = (node: Node): boolean => {
  if (node.type !== "CallExpression" || (node.typeArguments ?? null) === null) {
    return false;
  }
  const callee = node.callee;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === "get" &&
    namesStorage(callee.object)
  );
};

const durableStorageReadVisitor = (inspection: LintContext): Visitor => ({
  CallExpression(node: Node): void {
    if (isTypedStorageRead(node)) {
      reportViolation(inspection, node);
    }
  },
});

export { durableStorageReadVisitor };
