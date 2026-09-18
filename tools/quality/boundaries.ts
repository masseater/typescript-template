import type { LintContext, Node } from "./lint-context.ts";
import { destructuresD1Operation, isD1Operation } from "./d1-references.ts";
import { filename, importVisitor, reportViolation } from "./lint-context.ts";
import { importerOf, isApplicationOrLibrary, isForbiddenImport } from "./import-boundaries.ts";
import { origins, staticText } from "./references.ts";
import type { Visitor } from "vite-plus/lint/plugins";

interface RawD1Checks {
  readonly destructuring: (reported: Node, pattern: Node, input: Node) => void;
  readonly operation: (node: Node) => void;
}

const rawD1Adapters = ["migrate-d1", "testing", "testing-node"] as const;
const rawD1Modules = rawD1Adapters.map((name) => `libs/db/src/${name}.ts`);
const rawD1Pattern = new RegExp(String.raw`/libs/db/src/(?:${rawD1Adapters.join("|")})\.ts$`, "u");

function importSourceChecker(context: LintContext): (node: Node) => void {
  const importer = importerOf(filename(context));
  return (node) => {
    const source = staticText(context, node);
    if (
      source === undefined ? isApplicationOrLibrary(importer) : isForbiddenImport(importer, source)
    ) {
      reportViolation(context, node);
    }
  };
}

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
  const checkSource = importSourceChecker(context);
  const checks = rawD1Checks(context);
  return {
    ...importVisitor(checkSource),
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
      const [argument] = node.arguments;
      if (
        argument !== undefined &&
        origins(context, node.callee).some(
          (origin) => origin[0] === "require" && origin.length === 1,
        )
      ) {
        checkSource(argument);
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
