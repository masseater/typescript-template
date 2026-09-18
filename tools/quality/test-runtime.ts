import { importVisitor, reportViolation } from "./lint-context.ts";
import { staticText } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";
import type { LintContext, Node } from "./lint-context.ts";

const workerTestSuffix = ".worker.test.ts";
const workerTests = `**/*${workerTestSuffix}`;
const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const deployedToWorkers = /\/(?:apps|libs|infra\/(?:budget|error|health)-monitor)\//u;
const browserOrNodeOnly =
  /\/libs\/ui\/|\/libs\/observability\/src\/browser\.ts$|\/libs\/runtime\/src\/client\.ts$|\/libs\/db\/src\/(?:remote|testing-node)[^/]*\.ts$/u;
const nodeRuntimeModules = [
  "node:",
  "msw/node",
  "miniflare",
  "wrangler",
  "drizzle-kit",
  "@effect/platform-node",
] as const;
const workerRuntimeModules = ["cloudflare:test", "cloudflare:workers"] as const;

const importsAnyOf = (specifiers: readonly string[], source: string): boolean => {
  return specifiers.some(
    (specifier) =>
      source === specifier ||
      source.startsWith(`${specifier}/`) ||
      (specifier.endsWith(":") && source.startsWith(specifier)),
  );
};

const workerTestFile = /\.worker\.test\.[cm]?[jt]sx?$/u;

const runsInWorkerRuntime = (current: string): boolean => {
  return (
    deployedToWorkers.test(current) &&
    !browserOrNodeOnly.test(current) &&
    (!testFile.test(current) || workerTestFile.test(current))
  );
};

const testRuntimeVisitor = (context: LintContext): Visitor => {
  const current = context.filename.replaceAll("\\", "/");
  if (!testFile.test(current)) {
    return {};
  }
  const forbidden = workerTestFile.test(current) ? nodeRuntimeModules : workerRuntimeModules;
  return importVisitor((node: Node) => {
    if (importsAnyOf(forbidden, staticText(context, node) ?? "")) {
      reportViolation(context, node);
    }
  });
};

export {
  nodeRuntimeModules,
  runsInWorkerRuntime,
  testRuntimeVisitor,
  workerRuntimeModules,
  workerTestSuffix,
  workerTests,
};
