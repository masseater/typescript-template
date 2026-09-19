import {
  filename,
  reportViolation,
  type LintContext,
  type Node,
  type NodeOf,
} from "./lint-context.ts";
import { origins, propertyName, staticText } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const definesFileRoute = (inspection: LintContext, node: Node): boolean => {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "CallExpression" &&
    origins(inspection, node.callee.callee).some((origin) => origin[1] === "createFileRoute")
  );
};

const routeOptions = (node: Node): NodeOf<"ObjectExpression">["properties"] => {
  const [routeOption] = node.type === "CallExpression" ? node.arguments : [];
  return routeOption?.type === "ObjectExpression" ? routeOption.properties : [];
};

const elysiaServerOrigin = ["@repo/runtime/http", "elysiaServer"];

const servesElysia = (inspection: LintContext, node: Node): boolean => {
  if (node.type === "ObjectExpression") {
    return node.properties.some(
      (property) =>
        property.type === "SpreadElement" && servesElysia(inspection, property.argument),
    );
  }
  return (
    node.type === "CallExpression" &&
    origins(inspection, node.callee).some(
      (origin) => origin.join(".") === elysiaServerOrigin.join("."),
    )
  );
};

const reportForeignServer = (inspection: LintContext, node: Node): void => {
  if (!definesFileRoute(inspection, node)) {
    return;
  }
  for (const property of routeOptions(node)) {
    if (property.type !== "Property") {
      reportViolation(inspection, property);
    } else if (
      propertyName(inspection, property) === "server" &&
      !servesElysia(inspection, property.value)
    ) {
      reportViolation(inspection, property);
    }
  }
};

const effectStackVisitor = (inspection: LintContext): Visitor => {
  const inspected = filename(inspection);
  const elysiaFactory = inspected.endsWith("/libs/runtime/src/http.ts");
  const startRoute = /\/apps\/[^/]+\/src\/(?:[^/]+\/)*routes\//u.test(inspected);
  const check = (node: Node, typeOnly: boolean): void => {
    const source = staticText(inspection, node);
    if (source === undefined) {
      return;
    }
    if (
      /^valibot(?:\/|$)/u.test(source) ||
      (/^elysia(?:\/|$)/u.test(source) && !elysiaFactory && !typeOnly)
    ) {
      reportViolation(inspection, node);
    }
  };
  return {
    CallExpression(node: Node): void {
      if (startRoute) {
        reportForeignServer(inspection, node);
      }
    },
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
  };
};

const isEffectScope = (inspected: string): boolean => {
  return (
    /\/(?:apps|libs|infra|tools)\/[^/]+\/src\//u.test(inspected) &&
    !/\/libs\/(?:ui|auth-ui)\/|\/libs\/runtime\/src\/client\.ts$|\/libs\/observability\/src\/browser\.ts$|\.tsx$/u.test(
      inspected,
    )
  );
};

const isApiErrorThrow = (node: Node): boolean => {
  return (
    node.type === "ThrowStatement" &&
    node.argument.type === "NewExpression" &&
    node.argument.callee.type === "Identifier" &&
    node.argument.callee.name === "APIError"
  );
};

const enclosingProgram = (node: Node): Node => {
  const { parent } = node;
  return parent ? enclosingProgram(parent) : node;
};

const importsEffect = (node: Node): boolean => {
  const program = enclosingProgram(node);
  return (
    program.type === "Program" &&
    program.body.some(
      (statement) =>
        statement.type === "ImportDeclaration" && /^effect(?:\/|$)/u.test(statement.source.value),
    )
  );
};

const effectFailuresVisitor = (inspection: LintContext): Visitor => {
  if (!isEffectScope(filename(inspection))) {
    return {};
  }
  return {
    ThrowStatement(node: Node): void {
      if (importsEffect(node) && !isApiErrorThrow(node)) {
        reportViolation(inspection, node);
      }
    },
    TryStatement(node: Node): void {
      if (importsEffect(node)) {
        reportViolation(inspection, node);
      }
    },
  };
};

export { effectFailuresVisitor, effectStackVisitor };
