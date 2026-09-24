import { filename, reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const routeFile = /(?:^|\/)apps\/[^/]+\/src\/app\/routes\/.+\.[cm]?[jt]sx?$/u;
const exemptBasename = /(?:^|\/)(?:__root|-root-document|.*-provider)\.[cm]?[jt]sx?$/u;

const isAppRouteModule = (inspected: string): boolean => {
  const normalized = inspected.replaceAll("\\", "/");
  return routeFile.test(normalized) && !exemptBasename.test(normalized);
};

const containsJsx = (node: unknown): boolean => {
  if (typeof node !== "object" || node === null) {
    return false;
  }
  if ("type" in node && (node.type === "JSXElement" || node.type === "JSXFragment")) {
    return true;
  }
  return Object.values(node).some((child) => containsJsx(child));
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

export { containsJsx, isAppRouteModule, thinAppRoutesVisitor };
