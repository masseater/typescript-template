import { aliasChecker, aliasVisitor } from "./alias-visitor.ts";
import { reportViolation, type LintContext, type Node, type NodeOf } from "./lint-context.ts";
import { origins, propertyName, staticText, type Origin } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const metaPaths: ReadonlySet<string> = new Set(["url", "dirname", "filename", "resolve"]);
const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const builtinModuleLoader = /^(?:global\.)?(?:node:)?process\.getBuiltinModule$/u;

const outOfGraphModules: ReadonlySet<string> = new Set([
  "node:child_process",
  "child_process",
  "node:worker_threads",
  "worker_threads",
]);

const isOutOfGraph = (origin: Origin): boolean => {
  const [source = "", first = "", second = ""] = origin;
  return (
    outOfGraphModules.has(source) ||
    (source === "import.meta" && metaPaths.has(first)) ||
    ((source === "node:process" || source === "process") && first === "cwd") ||
    (source === "global" && first === "process" && second === "cwd")
  );
};

type SourceCheck = (node: Node) => void;

const sourceChecker = (context: LintContext): SourceCheck => {
  return (node) => {
    const source = staticText(context, node) ?? "";
    if (outOfGraphModules.has(source) || source.includes("?")) {
      reportViolation(context, node);
    }
  };
};

const hasQueryOption = (context: LintContext, options: Node): boolean => {
  if (options.type !== "ObjectExpression") {
    return true;
  }
  return options.properties.some(
    (property) => property.type !== "Property" || propertyName(context, property) === "query",
  );
};

function checkGlob(
  context: LintContext,
  node: NodeOf<"CallExpression">,
  checkSource: SourceCheck,
): void {
  const [patterns, options] = node.arguments;
  const list = patterns?.type === "ArrayExpression" ? patterns.elements : [patterns];
  for (const pattern of list) {
    if (pattern && pattern.type !== "SpreadElement") {
      checkSource(pattern);
    }
  }
  if (options !== undefined && hasQueryOption(context, options)) {
    reportViolation(context, options);
  }
}

const callVisitor = (context: LintContext, checkSource: SourceCheck): Visitor => {
  return {
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression") {
        return;
      }
      const callee = origins(context, node.callee).map((origin) => origin.join("."));
      if (callee.includes("import.meta.glob")) {
        checkGlob(context, node, checkSource);
      }
      const [argument] = node.arguments;
      if (
        argument !== undefined &&
        callee.some((name) => name === "require" || builtinModuleLoader.test(name))
      ) {
        checkSource(argument);
      }
    },
  };
};

const moduleVisitor = (context: LintContext, checkSource: SourceCheck): Visitor => {
  const checkAlias = aliasChecker(context, isOutOfGraph);
  return {
    ExportAllDeclaration(node: Node): void {
      if (node.type === "ExportAllDeclaration") {
        checkSource(node.source);
      }
    },
    ExportNamedDeclaration(node: Node): void {
      if (node.type === "ExportNamedDeclaration" && node.source) {
        checkSource(node.source);
      }
    },
    ImportDeclaration(node: Node): void {
      if (node.type !== "ImportDeclaration") {
        return;
      }
      checkSource(node.source);
      for (const specifier of node.specifiers) {
        checkAlias(specifier.local);
      }
    },
    ImportExpression(node: Node): void {
      if (node.type === "ImportExpression") {
        checkSource(node.source);
      }
    },
  };
};

const testImportGraphVisitor = (context: LintContext): Visitor => {
  if (!testFile.test(context.filename.replaceAll("\\", "/"))) {
    return {};
  }
  const checkSource = sourceChecker(context);
  return {
    ...aliasVisitor(context, isOutOfGraph),
    ...moduleVisitor(context, checkSource),
    ...callVisitor(context, checkSource),
  };
};

export { testImportGraphVisitor };
