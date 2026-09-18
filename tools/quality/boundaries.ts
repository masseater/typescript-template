import { destructuresD1Operation, isD1Operation } from "./d1-references.ts";
import { filename, reportViolation } from "./lint-context.ts";
import { specifierVisitor } from "./module-specifiers.ts";

import type { Visitor } from "vite-plus/lint/plugins";
import type { LintContext, Node } from "./lint-context.ts";

interface RawD1Checks {
  readonly destructuring: (reported: Node, pattern: Node, input: Node) => void;
  readonly operation: (node: Node) => void;
}

const rawD1Adapters = ["migrate-d1", "testing", "testing-node"] as const;
const rawD1Modules = rawD1Adapters.map((name) => `libs/db/src/${name}.ts`);
const rawD1Pattern = new RegExp(String.raw`/libs/db/src/(?:${rawD1Adapters.join("|")})\.ts$`, "u");

function rawD1Checks(context: LintContext): RawD1Checks {
  const allowed = rawD1Pattern.test(filename(context));
  return {
    destructuring: (reported, pattern, input) => {
      if (!allowed && destructuresD1Operation(context, pattern, input)) {
        reportViolation(context, reported);
      }
    },
    operation: (node) => {
      if (!allowed && isD1Operation(context, node)) {
        reportViolation(context, node);
      }
    },
  };
}

function boundariesVisitor(context: LintContext): Visitor {
  const specifiers = specifierVisitor(context);
  const checks = rawD1Checks(context);
  return {
    ...specifiers.visitor,
    AssignmentExpression(node: Node): void {
      if (node.type === "AssignmentExpression") {
        checks.destructuring(node, node.left, node.right);
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
        checks.destructuring(node, node, node.typeAnnotation);
      }
    },
    VariableDeclarator(node: Node): void {
      if (node.type === "VariableDeclarator" && node.init) {
        checks.destructuring(node, node.id, node.init);
      }
    },
  };
}

export { boundariesVisitor, rawD1Modules };
