import type { LintContext, Node } from "./lint-context.ts";
import { importVisitor, reportViolation } from "./lint-context.ts";
import type { Visitor } from "vite-plus/lint/plugins";
import { staticText } from "./references.ts";

const workerTestSuffix = ".worker.test.ts";
const workerTests = `**/*${workerTestSuffix}`;
const workerTestFile = /\.worker\.test\.[cm]?[jt]sx?$/u;
const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const workerRuntimeModule = /^cloudflare:/u;
const nodeRuntimeModule =
  /^(?:node:|msw\/node$|miniflare$|wrangler$|drizzle-kit(?:\/|$)|@effect\/platform-node(?:\/|$))/u;

function testRuntimeVisitor(context: LintContext): Visitor {
  const current = context.filename.replaceAll("\\", "/");
  if (!testFile.test(current)) {
    return {};
  }
  const forbidden = workerTestFile.test(current) ? nodeRuntimeModule : workerRuntimeModule;
  return importVisitor((node: Node) => {
    if (forbidden.test(staticText(context, node) ?? "")) {
      reportViolation(context, node);
    }
  });
}

export { testRuntimeVisitor, workerTestSuffix, workerTests };
