import { originVisitor } from "./alias-visitor.ts";
import { reportViolation, scopeOf, type LintContext, type Node } from "./lint-context.ts";
import { origins, propertyKey, type Origin } from "./references.ts";

import type { Variable, Visitor } from "vite-plus/lint/plugins";

type ScopeLink = {
  readonly set: { readonly get: (declared: string) => Variable | undefined };
  readonly upper: ScopeLink | null;
};

const legacyApis: Readonly<Record<string, readonly string[]>> = {
  react: ["createFactory", "forwardRef"],
  "react-dom": ["findDOMNode", "hydrate", "render", "unmountComponentAtNode"],
  "react-dom/server": ["renderToNodeStream", "renderToStaticNodeStream"],
};

const legacyProperties = new Set(["defaultProps", "propTypes"]);

const effectHooks = new Set(["useEffect", "useLayoutEffect"]);

const testRenderer = "react-test-renderer";

const isLegacyApi = (origin: Origin): boolean => {
  const [source = "", ...members] = origin;
  if (source === testRenderer) {
    return true;
  }
  if (source === "react" && members[0] === "createContext" && members.includes("Provider")) {
    return true;
  }
  const apis = legacyApis[source];
  return apis !== undefined && members.some((member) => apis.includes(member));
};

const isCreateContextValue = (inspection: LintContext, expression: Node): boolean => {
  return origins(inspection, expression).some(
    (origin) => origin[0] === "react" && origin[1] === "createContext" && origin.length === 2,
  );
};

const isEffectHook = (origin: Origin): boolean => {
  return origin[0] === "react" && effectHooks.has(origin[1] ?? "");
};

const isEffectEventValue = (origin: Origin): boolean => {
  return origin[0] === "react" && origin[1] === "useEffectEvent" && origin.length === 2;
};

const isStringRef = (expression: Node): boolean => {
  if (expression.type === "Literal") {
    return typeof expression.value === "string";
  }
  return expression.type === "TemplateLiteral" && expression.expressions.length === 0;
};

const variableNamed = (
  inspection: LintContext,
  node: Node,
  declaredName: string,
): Variable | undefined => {
  const declaredIn = (scope: ScopeLink | null): Variable | undefined => {
    return scope === null ? undefined : (scope.set.get(declaredName) ?? declaredIn(scope.upper));
  };
  return declaredIn(scopeOf(inspection, node));
};

const initializerOf = (binding: Variable): Node | undefined => {
  const declaration = binding.defs[0]?.node;
  return declaration?.type === "VariableDeclarator" && declaration.init
    ? declaration.init
    : undefined;
};

const contextProviderName = (name: Node): string | undefined => {
  if (name.type !== "JSXMemberExpression" || name.property.type !== "JSXIdentifier") {
    return undefined;
  }
  if (name.property.name !== "Provider" || name.object.type !== "JSXIdentifier") {
    return undefined;
  }
  return name.object.name;
};

const attributeExpression = (attribute: Node): Node | undefined => {
  if (attribute.type !== "JSXAttribute" || attribute.value === null) {
    return undefined;
  }
  if (attribute.value.type !== "JSXExpressionContainer") {
    return attribute.value;
  }
  return attribute.value.expression.type === "JSXEmptyExpression"
    ? undefined
    : attribute.value.expression;
};

const exportedName = (
  specifier: Extract<Node, { type: "ExportNamedDeclaration" }>["specifiers"][number],
): string => {
  return specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
};

const reactLegacyVisitor = (inspection: LintContext): Visitor => {
  return {
    ...originVisitor(inspection, isLegacyApi),
    AssignmentExpression(node: Node): void {
      if (node.type !== "AssignmentExpression" || node.left.type !== "MemberExpression") {
        return;
      }
      const property = propertyKey(inspection, node.left);
      if (property !== undefined && legacyProperties.has(property)) {
        reportViolation(inspection, node.left);
      }
    },
    ExportAllDeclaration(node: Node): void {
      if (node.type === "ExportAllDeclaration" && node.source.value === testRenderer) {
        reportViolation(inspection, node);
      }
    },
    ExportNamedDeclaration(node: Node): void {
      if (node.type !== "ExportNamedDeclaration" || !node.source) {
        return;
      }
      if (node.source.value === testRenderer) {
        reportViolation(inspection, node);
        return;
      }
      const apis = legacyApis[node.source.value];
      if (apis === undefined) {
        return;
      }
      for (const specifier of node.specifiers) {
        if (apis.includes(exportedName(specifier))) {
          reportViolation(inspection, specifier);
        }
      }
    },
    JSXAttribute(node: Node): void {
      if (node.type !== "JSXAttribute" || node.name.type !== "JSXIdentifier") {
        return;
      }
      const expression = attributeExpression(node);
      if (node.name.name === "ref" && expression !== undefined && isStringRef(expression)) {
        reportViolation(inspection, node);
      }
    },
    JSXOpeningElement(node: Node): void {
      if (node.type !== "JSXOpeningElement") {
        return;
      }
      const provider = contextProviderName(node.name);
      if (provider === undefined) {
        return;
      }
      const binding = variableNamed(inspection, node, provider);
      const initializer = binding === undefined ? undefined : initializerOf(binding);
      if (initializer !== undefined && isCreateContextValue(inspection, initializer)) {
        reportViolation(inspection, node.name);
      }
    },
  };
};

const effectEventDependencyVisitor = (inspection: LintContext): Visitor => {
  return {
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression" || !origins(inspection, node.callee).some(isEffectHook)) {
        return;
      }
      const dependencies = node.arguments[1];
      if (dependencies?.type !== "ArrayExpression") {
        return;
      }
      for (const dependency of dependencies.elements) {
        if (dependency !== null && origins(inspection, dependency).some(isEffectEventValue)) {
          reportViolation(inspection, dependency);
        }
      }
    },
  };
};

export { effectEventDependencyVisitor, reactLegacyVisitor };
