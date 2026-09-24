import { reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const sidebarModule = /(?:^|\/)sidebar(?:\.[cm]?[jt]sx?)?$/u;

const isIntrinsic = (node: Node, tagName: string): boolean => {
  return (
    node.type === "JSXElement" &&
    node.openingElement.name.type === "JSXIdentifier" &&
    node.openingElement.name.name === tagName
  );
};

const rendersNavigation = (node: Node): boolean => {
  if (isIntrinsic(node, "nav")) {
    return true;
  }
  return containsNavigation(node);
};

const containsNavigation = (node: Node): boolean => {
  if (node.type === "JSXElement" || node.type === "JSXFragment") {
    return node.children.some(rendersNavigation);
  }
  if (node.type === "JSXExpressionContainer") {
    return rendersNavigation(node.expression);
  }
  if (node.type === "ConditionalExpression") {
    return rendersNavigation(node.consequent) || rendersNavigation(node.alternate);
  }
  if (node.type === "LogicalExpression") {
    return rendersNavigation(node.right);
  }
  return false;
};

const appFrameSidebarVisitor = (inspection: LintContext): Visitor => {
  return {
    ExportAllDeclaration(node: Node): void {
      if (node.type === "ExportAllDeclaration" && sidebarModule.test(node.source.value)) {
        reportViolation(inspection, node);
      }
    },
    ExportNamedDeclaration(node: Node): void {
      if (
        node.type === "ExportNamedDeclaration" &&
        node.source &&
        sidebarModule.test(node.source.value)
      ) {
        reportViolation(inspection, node);
      }
    },
    ImportDeclaration(node: Node): void {
      if (node.type === "ImportDeclaration" && sidebarModule.test(node.source.value)) {
        reportViolation(inspection, node);
      }
    },
    JSXElement(node: Node): void {
      if (isIntrinsic(node, "aside") && containsNavigation(node)) {
        reportViolation(inspection, node);
      }
    },
  };
};

export { appFrameSidebarVisitor };
