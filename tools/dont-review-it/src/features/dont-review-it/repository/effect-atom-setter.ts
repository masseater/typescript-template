import { reportViolation, type LintContext, type Node, type NodeOf } from "./lint-context.ts";
import { origins, variableOf, type Origin } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const effectHooks = new Set(["useEffect", "useLayoutEffect"]);

const localStateFactories = new Set(["localState", "optionalState"]);

const functionTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

const isEffectHook = (origin: Origin): boolean => {
  return origin[0] === "react" && effectHooks.has(origin[1] ?? "");
};

const isAtomHook = (origin: Origin, hook: string): boolean => {
  return origin[0] === "@effect/atom-react" && origin[1] === hook && origin.length === 2;
};

const isLocalStateHook = (inspection: LintContext, callee: Node): boolean => {
  if (callee.type !== "Identifier") {
    return false;
  }
  const declaration = variableOf(inspection, callee)?.defs[0]?.node;
  if (declaration?.type !== "VariableDeclarator" || declaration.init?.type !== "CallExpression") {
    return false;
  }
  return origins(inspection, declaration.init.callee).some((origin) =>
    localStateFactories.has(origin.at(-1) ?? ""),
  );
};

const isTupleSetter = (
  inspection: LintContext,
  declaration: NodeOf<"VariableDeclarator">,
  setterName: string,
): boolean => {
  if (declaration.id.type !== "ArrayPattern" || declaration.init?.type !== "CallExpression") {
    return false;
  }
  const setter = declaration.id.elements[1];
  if (setter?.type !== "Identifier" || setter.name !== setterName) {
    return false;
  }
  const callee = declaration.init.callee;
  return (
    origins(inspection, callee).some((origin) => isAtomHook(origin, "useAtom")) ||
    isLocalStateHook(inspection, callee)
  );
};

const isAtomSetter = (inspection: LintContext, callee: NodeOf<"Identifier">): boolean => {
  const declaration = variableOf(inspection, callee)?.defs[0]?.node;
  if (declaration?.type !== "VariableDeclarator") {
    return false;
  }
  if (declaration.id.type === "Identifier" && declaration.init?.type === "CallExpression") {
    return origins(inspection, declaration.init.callee).some((origin) =>
      isAtomHook(origin, "useAtomSet"),
    );
  }
  return isTupleSetter(inspection, declaration, callee.name);
};

const enclosingFunction = (node: Node): Node | undefined => {
  const parent = node.parent;
  if (parent === undefined || parent === null) {
    return undefined;
  }
  return functionTypes.has(parent.type) ? parent : enclosingFunction(parent);
};

const isEffectBody = (inspection: LintContext, body: Node): boolean => {
  const hookCall = body.parent;
  return (
    hookCall?.type === "CallExpression" &&
    hookCall.arguments[0] === body &&
    origins(inspection, hookCall.callee).some(isEffectHook)
  );
};

const effectAtomSetterVisitor = (inspection: LintContext): Visitor => {
  return {
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression" || node.callee.type !== "Identifier") {
        return;
      }
      const body = enclosingFunction(node);
      if (
        body !== undefined &&
        isEffectBody(inspection, body) &&
        isAtomSetter(inspection, node.callee)
      ) {
        reportViolation(inspection, node);
      }
    },
  };
};

export { effectAtomSetterVisitor };
