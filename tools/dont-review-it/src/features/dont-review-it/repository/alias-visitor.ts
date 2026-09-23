import {
  declaredVariablesOf,
  reportViolation,
  type LintContext,
  type Node,
  type NodeOf,
} from "./lint-context.ts";
import { destructuredOrigins, origins, type Origin } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const aliasChecker = (
  inspection: LintContext,
  matches: (origin: Origin) => boolean,
): ((node: Node) => void) => {
  return (node) => {
    if (origins(inspection, node).some((origin) => matches(origin))) {
      reportViolation(inspection, node);
    }
  };
};

const aliasVisitor = (inspection: LintContext, matches: (origin: Origin) => boolean): Visitor => {
  const check = aliasChecker(inspection, matches);
  return {
    AssignmentExpression(node: Node): void {
      if (
        node.type === "AssignmentExpression" &&
        node.left.type === "ObjectPattern" &&
        destructuredOrigins(inspection, {
          inputs: origins(inspection, node.right),
          pattern: node.left,
        }).some((origin) => matches(origin))
      ) {
        reportViolation(inspection, node);
      }
    },
    ImportDeclaration(node: Node): void {
      if (node.type !== "ImportDeclaration") {
        return;
      }
      for (const specifier of node.specifiers) {
        check(specifier.local);
      }
    },
    MemberExpression: check,
    VariableDeclarator(node: Node): void {
      if (node.type !== "VariableDeclarator" || node.id.type !== "ObjectPattern") {
        return;
      }
      for (const variable of declaredVariablesOf(inspection, node)) {
        for (const identifier of variable.identifiers) {
          check(identifier);
        }
      }
    },
  };
};

const originVisitor = (
  inspection: LintContext,
  matches: (origin: Origin) => boolean,
  forbidsCall: (node: NodeOf<"CallExpression">) => boolean = () => false,
): Visitor => {
  return {
    ...aliasVisitor(inspection, matches),
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression") {
        return;
      }
      if (
        node.callee.type !== "MemberExpression" &&
        origins(inspection, node.callee).some((origin) => matches(origin))
      ) {
        reportViolation(inspection, node.callee);
      }
      if (forbidsCall(node)) {
        reportViolation(inspection, node);
      }
    },
  };
};

export { aliasChecker, aliasVisitor, originVisitor };
