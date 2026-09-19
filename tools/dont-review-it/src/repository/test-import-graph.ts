import { aliasChecker, aliasVisitor } from "./alias-visitor.ts";
import {
  fixtureOrTestFile,
  reportViolation,
  type LintContext,
  type Node,
  type NodeOf,
} from "./lint-context.ts";
import { origins, propertyName, staticText, type Origin } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const fsModules: ReadonlySet<string> = new Set([
  "node:fs",
  "fs",
  "node:fs/promises",
  "fs/promises",
]);
const osModules: ReadonlySet<string> = new Set(["node:os", "os"]);
const mktempNames: ReadonlySet<string> = new Set(["mkdtemp", "mkdtempSync"]);
const tmpdirNames: ReadonlySet<string> = new Set(["tmpdir"]);

type SourceCheck = (node: Node) => void;

const outOfGraphModules: ReadonlySet<string> = new Set([
  "node:child_process",
  "child_process",
  "node:worker_threads",
  "worker_threads",
]);

const sourceChecker = (inspection: LintContext): SourceCheck => {
  return (node) => {
    const source = staticText(inspection, node) ?? "";
    if (outOfGraphModules.has(source) || source.includes("?")) {
      reportViolation(inspection, node);
    }
  };
};

const hasQueryOption = (inspection: LintContext, globOption: Node): boolean => {
  if (globOption.type !== "ObjectExpression") {
    return true;
  }
  return globOption.properties.some(
    (property) => property.type !== "Property" || propertyName(inspection, property) === "query",
  );
};

const checkGlob = (
  inspection: LintContext,
  glob: { readonly checkSource: SourceCheck; readonly node: NodeOf<"CallExpression"> },
): void => {
  const [patterns, globOption] = glob.node.arguments;
  const globbed = patterns?.type === "ArrayExpression" ? patterns.elements : [patterns];
  for (const pattern of globbed) {
    if (pattern && pattern.type !== "SpreadElement") {
      glob.checkSource(pattern);
    }
  }
  if (globOption !== undefined && hasQueryOption(inspection, globOption)) {
    reportViolation(inspection, globOption);
  }
};

const builtinModuleLoader = /^(?:global\.)?(?:node:)?process\.getBuiltinModule$/u;

const callVisitor = (inspection: LintContext, checkSource: SourceCheck): Visitor => {
  return {
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression") {
        return;
      }
      const callee = origins(inspection, node.callee).map((origin) => origin.join("."));
      if (callee.includes("import.meta.glob")) {
        checkGlob(inspection, { checkSource, node });
      }
      const [argument] = node.arguments;
      if (
        argument !== undefined &&
        callee.some((called) => called === "require" || builtinModuleLoader.test(called))
      ) {
        checkSource(argument);
      }
    },
  };
};

const metaPaths: ReadonlySet<string> = new Set(["url", "dirname", "filename", "resolve"]);

const isProcessCwd = (origin: Origin): boolean => {
  const [source = "", first = "", second = ""] = origin;
  return (
    ((source === "node:process" || source === "process") && first === "cwd") ||
    (source === "global" && first === "process" && second === "cwd")
  );
};

const isOutOfGraph = (origin: Origin): boolean => {
  const [source = "", first = ""] = origin;
  return (
    outOfGraphModules.has(source) ||
    (source === "import.meta" && metaPaths.has(first)) ||
    isProcessCwd(origin)
  );
};

const moduleVisitor = (inspection: LintContext, checkSource: SourceCheck): Visitor => {
  const checkAlias = aliasChecker(inspection, isOutOfGraph);
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

const testImportGraphVisitor = (inspection: LintContext): Visitor => {
  if (!testFile.test(inspection.filename.replaceAll("\\", "/"))) {
    return {};
  }
  const checkSource = sourceChecker(inspection);
  return {
    ...aliasVisitor(inspection, isOutOfGraph),
    ...moduleVisitor(inspection, checkSource),
    ...callVisitor(inspection, checkSource),
  };
};

const gitExecutable = /(?:^|\/)git(?:\.exe)?$/u;

const startsGit = (inspection: LintContext, node: NodeOf<"CallExpression">): boolean => {
  const [command] = node.arguments;
  if (command === undefined || command.type === "SpreadElement") {
    return false;
  }
  const executable = staticText(inspection, command);
  return executable !== undefined && gitExecutable.test(executable);
};

const declaresEnvironment = (inspection: LintContext, node: Node): boolean => {
  return (
    node.type === "ObjectExpression" &&
    node.properties.some(
      (property) => property.type === "Property" && propertyName(inspection, property) === "env",
    )
  );
};

const calledFrom = (
  inspection: LintContext,
  node: NodeOf<"CallExpression">,
  modules: ReadonlySet<string>,
  names: ReadonlySet<string>,
): boolean => {
  return origins(inspection, node.callee).some(
    (origin) => origin.length >= 2 && modules.has(origin[0] ?? "") && names.has(origin[1] ?? ""),
  );
};

const underMktemp = (inspection: LintContext, node: Node): boolean => {
  let current: Node | null | undefined =
    "parent" in node ? (node.parent as Node | null | undefined) : undefined;
  while (current != null) {
    if (
      current.type === "CallExpression" &&
      calledFrom(inspection, current, fsModules, mktempNames)
    ) {
      return true;
    }
    current = "parent" in current ? (current.parent as Node | null | undefined) : undefined;
  }
  return false;
};

const gitEnvironmentVisitor = (inspection: LintContext): Visitor => {
  if (!fixtureOrTestFile.test(inspection.filename.replaceAll("\\", "/"))) {
    return {};
  }
  return {
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression" || !startsGit(inspection, node)) {
        return;
      }
      if (!node.arguments.some((argument) => declaresEnvironment(inspection, argument))) {
        reportViolation(inspection, node);
      }
    },
  };
};

const tempDirectoryVisitor = (inspection: LintContext): Visitor => {
  if (!fixtureOrTestFile.test(inspection.filename.replaceAll("\\", "/"))) {
    return {};
  }
  return {
    CallExpression(node: Node): void {
      if (
        node.type !== "CallExpression" ||
        !calledFrom(inspection, node, osModules, tmpdirNames) ||
        underMktemp(inspection, node)
      ) {
        return;
      }
      reportViolation(inspection, node);
    },
  };
};

export { gitEnvironmentVisitor, tempDirectoryVisitor, testImportGraphVisitor };
