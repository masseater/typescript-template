import { aliasChecker, aliasVisitor } from "./alias-visitor.ts";
import { reportViolation } from "./lint-context.ts";
import { origins, propertyName, staticText } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";
import type { LintContext, Node, NodeOf } from "./lint-context.ts";
import type { Origin } from "./references.ts";

type SourceCheck = (node: Node) => void;

const outOfGraphModules: ReadonlySet<string> = new Set([
  "node:child_process",
  "child_process",
  "node:worker_threads",
  "worker_threads",
]);
const metaPaths: ReadonlySet<string> = new Set(["url", "dirname", "filename", "resolve"]);
const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const builtinModuleLoader = /^(?:global\.)?(?:node:)?process\.getBuiltinModule$/u;

function isOutOfGraph(origin: Origin): boolean {
  const [source = "", first = "", second = ""] = origin;
  return (
    outOfGraphModules.has(source) ||
    (source === "import.meta" && metaPaths.has(first)) ||
    ((source === "node:process" || source === "process") && first === "cwd") ||
    (source === "global" && first === "process" && second === "cwd")
  );
}

function sourceChecker(context: LintContext): SourceCheck {
  return (node) => {
    const source = staticText(context, node) ?? "";
    if (outOfGraphModules.has(source) || source.includes("?")) {
      reportViolation(context, node);
    }
  };
}

function hasQueryOption(context: LintContext, options: Node): boolean {
  if (options.type !== "ObjectExpression") {
    return true;
  }
  return options.properties.some(
    (property) => property.type !== "Property" || propertyName(context, property) === "query",
  );
}

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

function callVisitor(context: LintContext, checkSource: SourceCheck): Visitor {
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
}

function moduleVisitor(context: LintContext, checkSource: SourceCheck): Visitor {
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
}

function testImportGraphVisitor(context: LintContext): Visitor {
  if (!testFile.test(context.filename.replaceAll("\\", "/"))) {
    return {};
  }
  const checkSource = sourceChecker(context);
  return {
    ...aliasVisitor(context, isOutOfGraph),
    ...moduleVisitor(context, checkSource),
    ...callVisitor(context, checkSource),
  };
}

const fixtureOrTestFile = /(?:\.(?:test|spec)|-fixture)\.[cm]?[jt]sx?$/u;
const gitExecutable = /(?:^|\/)git(?:\.exe)?$/u;

function startsGit(context: LintContext, node: NodeOf<"CallExpression">): boolean {
  const [command] = node.arguments;
  if (command === undefined || command.type === "SpreadElement") {
    return false;
  }
  const text = staticText(context, command);
  return text !== undefined && gitExecutable.test(text);
}

function declaresEnvironment(context: LintContext, node: Node): boolean {
  return (
    node.type === "ObjectExpression" &&
    node.properties.some(
      (property) => property.type === "Property" && propertyName(context, property) === "env",
    )
  );
}

function gitEnvironmentVisitor(context: LintContext): Visitor {
  if (!fixtureOrTestFile.test(context.filename.replaceAll("\\", "/"))) {
    return {};
  }
  return {
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression" || !startsGit(context, node)) {
        return;
      }
      if (!node.arguments.some((argument) => declaresEnvironment(context, argument))) {
        reportViolation(context, node);
      }
    },
  };
}

export { gitEnvironmentVisitor, testImportGraphVisitor };
