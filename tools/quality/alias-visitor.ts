import { reportViolation, type LintContext, type Node } from "./lint-context.ts";
import { destructuredOrigins, origins, type Origin } from "./references.ts";

import type { ESTree, Visitor } from "vite-plus/lint/plugins";

const aliasChecker = (
  context: LintContext,
  matches: (origin: Origin) => boolean,
): ((node: Node) => void) => {
  return (node) => {
    if (origins(context, node).some((origin) => matches(origin))) {
      reportViolation(context, node);
    }
  };
};

const aliasVisitor = (context: LintContext, matches: (origin: Origin) => boolean): Visitor => {
  const check = aliasChecker(context, matches);
  return {
    AssignmentExpression(node: Node): void {
      if (
        node.type === "AssignmentExpression" &&
        node.left.type === "ObjectPattern" &&
        destructuredOrigins(context, node.left, origins(context, node.right)).some((origin) =>
          matches(origin),
        )
      ) {
        reportViolation(context, node);
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

    VariableDeclarator(node: ESTree.Node): void {
      if (node.type !== "VariableDeclarator" || node.id.type !== "ObjectPattern") {
        return;
      }
      for (const variable of context.sourceCode.getDeclaredVariables(node)) {
        for (const identifier of variable.identifiers) {
          check(identifier);
        }
      }
    },
  };
};

const originVisitor = (context: LintContext, matches: (origin: Origin) => boolean): Visitor => {
  return {
    ...aliasVisitor(context, matches),
    CallExpression(node: Node): void {
      if (
        node.type === "CallExpression" &&
        node.callee.type !== "MemberExpression" &&
        origins(context, node.callee).some((origin) => matches(origin))
      ) {
        reportViolation(context, node.callee);
      }
    },
  };
};

export { aliasChecker, aliasVisitor, originVisitor };
