import type { LintContext, Node } from "./lint-context.ts";
import { origins, propertyName, staticText } from "./references.ts";
import type { Visitor } from "vite-plus/lint/plugins";
import { reportViolation } from "./lint-context.ts";

const elysiaServerOrigin = ["@template/runtime/http", "elysiaServer"];

function filename(context: LintContext): string {
  return context.filename.replaceAll("\\", "/");
}

function servesElysia(context: LintContext, node: Node): boolean {
  return (
    node.type === "CallExpression" &&
    origins(context, node.callee).some(
      (origin) => origin.join(".") === elysiaServerOrigin.join("."),
    )
  );
}

function effectStackVisitor(context: LintContext): Visitor {
  const current = filename(context);
  const elysiaFactory = current.endsWith("/libs/runtime/src/http.ts");
  const startRoute = /\/apps\/[^/]+\/src\/routes\//u.test(current);
  function check(node: Node, typeOnly: boolean): void {
    const source = staticText(context, node);
    if (source === undefined) {
      return;
    }
    if (
      /^valibot(?:\/|$)/u.test(source) ||
      (/^elysia(?:\/|$)/u.test(source) && !elysiaFactory && !typeOnly)
    ) {
      reportViolation(context, node);
    }
  }
  return {
    ExportAllDeclaration(node: Node): void {
      if (node.type === "ExportAllDeclaration") {
        check(node.source, false);
      }
    },
    ExportNamedDeclaration(node: Node): void {
      if (node.type === "ExportNamedDeclaration" && node.source) {
        check(node.source, false);
      }
    },
    ImportDeclaration(node: Node): void {
      if (node.type === "ImportDeclaration") {
        check(node.source, node.importKind === "type");
      }
    },
    ImportExpression(node: Node): void {
      if (node.type === "ImportExpression") {
        check(node.source, false);
      }
    },
    Property(node: Node): void {
      if (!startRoute || node.type !== "Property") {
        return;
      }
      const name = propertyName(context, node);
      if (name === "handlers" || (name === "server" && !servesElysia(context, node.value))) {
        reportViolation(context, node);
      }
    },
  };
}

function isEffectScope(current: string): boolean {
  return (
    /\/(?:apps|libs|infra|tools)\/[^/]+\/src\//u.test(current) &&
    !/\/libs\/ui\/|\/libs\/runtime\/src\/client\.ts$|\/libs\/observability\/src\/browser\.ts$|\.tsx$/u.test(
      current,
    )
  );
}

function isApiErrorThrow(node: Node): boolean {
  return (
    node.type === "ThrowStatement" &&
    node.argument.type === "NewExpression" &&
    node.argument.callee.type === "Identifier" &&
    node.argument.callee.name === "APIError"
  );
}

function effectFailuresVisitor(context: LintContext): Visitor {
  if (!isEffectScope(filename(context))) {
    return {};
  }
  let usesEffect = false;
  return {
    ImportDeclaration(node: Node): void {
      if (node.type === "ImportDeclaration" && /^effect(?:\/|$)/u.test(node.source.value)) {
        usesEffect = true;
      }
    },
    ThrowStatement(node: Node): void {
      if (usesEffect && !isApiErrorThrow(node)) {
        reportViolation(context, node);
      }
    },
    TryStatement(node: Node): void {
      if (usesEffect) {
        reportViolation(context, node);
      }
    },
  };
}

export { effectFailuresVisitor, effectStackVisitor };
