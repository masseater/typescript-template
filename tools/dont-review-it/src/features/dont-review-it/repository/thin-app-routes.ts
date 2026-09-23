import { filename, reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const routeFile = /(?:^|\/)apps\/[^/]+\/src\/app\/routes\/.+\.[cm]?[jt]sx?$/u;
const exemptBasename = /(?:^|\/)(?:__root|-root-document|.*-provider)\.[cm]?[jt]sx?$/u;

const isAppRouteModule = (inspected: string): boolean => {
  const normalized = inspected.replaceAll("\\", "/");
  return routeFile.test(normalized) && !exemptBasename.test(normalized);
};

const thinAppRoutesVisitor = (inspection: LintContext): Visitor => {
  if (!isAppRouteModule(filename(inspection))) {
    return {};
  }
  return {
    JSXElement(node: Node): void {
      reportViolation(inspection, node);
    },
    JSXFragment(node: Node): void {
      reportViolation(inspection, node);
    },
  };
};

export { isAppRouteModule, thinAppRoutesVisitor };
