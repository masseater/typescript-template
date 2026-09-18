import type { ESTree, Visitor } from "vite-plus/lint/plugins";
import type { LintContext, Node, NodeOf } from "./lint-context.ts";
import { destructuredOrigins, origins } from "./references.ts";
import type { Origin } from "./references.ts";
import { reportViolation } from "./lint-context.ts";

function aliasChecker(
  context: LintContext,
  matches: (origin: Origin) => boolean,
): (node: Node) => void {
  return (node) => {
    if (origins(context, node).some((origin) => matches(origin))) {
      reportViolation(context, node);
    }
  };
}

function aliasVisitor(context: LintContext, matches: (origin: Origin) => boolean): Visitor {
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
    ExportNamedDeclaration(node: Node): void {
      if (node.type !== "ExportNamedDeclaration" || !node.source) {
        return;
      }
      for (const specifier of node.specifiers) {
        const name =
          specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
        if (matches([node.source.value, name])) {
          reportViolation(context, specifier);
        }
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
}

function originVisitor(
  context: LintContext,
  matches: (origin: Origin) => boolean,
  forbidsCall: (node: NodeOf<"CallExpression">) => boolean = () => false,
): Visitor {
  return {
    ...aliasVisitor(context, matches),
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression") {
        return;
      }
      if (
        node.callee.type !== "MemberExpression" &&
        origins(context, node.callee).some((origin) => matches(origin))
      ) {
        reportViolation(context, node.callee);
      }
      if (forbidsCall(node)) {
        reportViolation(context, node);
      }
    },
  };
}

export { aliasChecker, aliasVisitor, originVisitor };
