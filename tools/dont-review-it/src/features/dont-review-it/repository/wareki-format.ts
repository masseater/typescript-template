import { filename, reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const isDateTimeFormat = (node: Node): boolean => {
  if (node.type !== "NewExpression") {
    return false;
  }
  const callee = node.callee;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Intl" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "DateTimeFormat"
  );
};

const warekiFormatVisitor = (inspection: LintContext): Visitor => {
  if (filename(inspection).endsWith("/libs/ui/src/features/ui/wareki.ts")) {
    return {};
  }
  return {
    NewExpression(node: Node): void {
      if (isDateTimeFormat(node)) {
        reportViolation(inspection, node);
      }
    },
  };
};

const warekiFormatters = new Set(["formatWarekiDate", "formatWarekiDateTime", "formatWarekiMonth"]);

const dataSegmentFile = /\/src\/(?:.+\/)?(?:api|model)\/[^/]+$/u;

const warekiInDataSegmentVisitor = (inspection: LintContext): Visitor => {
  if (!dataSegmentFile.test(filename(inspection))) {
    return {};
  }
  return {
    ImportDeclaration(node: Node): void {
      if (node.type !== "ImportDeclaration" || node.source.value !== "@repo/ui") {
        return;
      }
      for (const specifier of node.specifiers) {
        if (
          specifier.type === "ImportSpecifier" &&
          warekiFormatters.has(
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value,
          )
        ) {
          reportViolation(inspection, specifier);
        }
      }
    },
  };
};

export { warekiFormatVisitor, warekiInDataSegmentVisitor };
