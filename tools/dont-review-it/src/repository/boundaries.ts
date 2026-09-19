import { destructuresD1Operation, isD1Operation } from "./d1-references.ts";
import { filename, reportViolation, type LintContext, type Node } from "./lint-context.ts";
import { specifierVisitor } from "./module-specifiers.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const rawD1Adapters = ["migrate-d1", "testing", "testing-node"] as const;
const rawD1Modules = rawD1Adapters.map((adapter) => `libs/db/src/${adapter}.ts`);
const rawD1Pattern = new RegExp(String.raw`/libs/db/src/(?:${rawD1Adapters.join("|")})\.ts$`, "u");

const rawD1Checks = (
  inspection: LintContext,
): {
  readonly destructuring: (
    reported: Node,
    destructuring: { readonly input: Node; readonly pattern: Node },
  ) => void;
  readonly operation: (node: Node) => void;
} => {
  const allowed = rawD1Pattern.test(filename(inspection));
  return {
    destructuring: (reported, { input, pattern }) => {
      if (!allowed && destructuresD1Operation(inspection, { input, pattern })) {
        reportViolation(inspection, reported);
      }
    },
    operation: (node) => {
      if (!allowed && isD1Operation(inspection, node)) {
        reportViolation(inspection, node);
      }
    },
  };
};

const boundariesVisitor = (inspection: LintContext): Visitor => {
  const specifiers = specifierVisitor(inspection);
  const checks = rawD1Checks(inspection);
  return {
    ...specifiers.visitor,
    AssignmentExpression(node: Node): void {
      if (node.type === "AssignmentExpression") {
        checks.destructuring(node, { input: node.right, pattern: node.left });
      }
    },
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression") {
        return;
      }
      checks.operation(node.callee);
      if (specifiers.loaderCall(node.callee)) {
        specifiers.commonJs(node);
      }
    },
    MemberExpression(node: Node): void {
      checks.operation(node);
    },
    ObjectPattern(node: Node): void {
      if (node.type === "ObjectPattern" && node.typeAnnotation) {
        checks.destructuring(node, { input: node.typeAnnotation, pattern: node });
      }
    },
    VariableDeclarator(node: Node): void {
      if (node.type === "VariableDeclarator" && node.init) {
        checks.destructuring(node, { input: node.init, pattern: node.id });
      }
    },
  };
};

export { boundariesVisitor, rawD1Modules };
