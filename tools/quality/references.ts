import { scopeOf } from "./lint-context.ts";

import type { Definition, Reference, Scope, Variable } from "vite-plus/lint/plugins";
import type { DeepReadonly, LintContext, Node, NodeOf } from "./lint-context.ts";

type Resolve<Result> = (node: Node) => Result;

type Origin = readonly string[];

const knownGlobals: ReadonlyMap<string, Origin> = new Map([
  ["vi", ["vitest", "vi"]],
  ["vitest", ["vitest", "vi"]],
  ["jest", ["@jest/globals", "jest"]],
  ["process", ["node:process"]],
  ["globalThis", ["global"]],
  ["global", ["global"]],
  ["window", ["global"]],
  ["require", ["require"]],
]);

const extendOrigin = (origin: Origin, suffix: readonly string[]): Origin => {
  return [...origin, ...suffix];
};

const variableOf = (context: LintContext, node: NodeOf<"Identifier">): Variable | undefined => {
  let scope: Scope | null = scopeOf(context, node);
  while (scope !== null) {
    const variable = scope.set.get(node.name);
    if (variable !== undefined) {
      return variable;
    }
    scope = scope.upper;
  }
  return undefined;
};

const constantInitializer = (
  context: LintContext,
  node: NodeOf<"Identifier">,
): Node | undefined => {
  const variable = variableOf(context, node);
  if (
    variable?.references.some(
      (reference: DeepReadonly<Reference>) => reference.isWrite() && !reference.init,
    ) === true
  ) {
    return undefined;
  }
  const definition = variable?.defs[0]?.node;
  return definition?.type === "VariableDeclarator" && definition.init ? definition.init : undefined;
};

const derivedText = (
  context: LintContext,
  node: Node,
  resolve: Resolve<string | undefined>,
): string | undefined => {
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion"
  ) {
    return resolve(node.expression);
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = resolve(node.left);
    const right = resolve(node.right);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  const initializer = node.type === "Identifier" ? constantInitializer(context, node) : undefined;
  return initializer === undefined ? undefined : resolve(initializer);
};

const staticText = (
  context: LintContext,
  node: Node,
  seen: Readonly<ReadonlySet<Node>> = new Set(),
): string | undefined => {
  if (seen.has(node)) {
    return undefined;
  }
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }
  if (node.type === "TemplateLiteral") {
    return node.expressions.length === 0 ? (node.quasis[0]?.value.cooked ?? undefined) : undefined;
  }
  const next = new Set([...seen, node]);
  return derivedText(context, node, (child) => staticText(context, child, next));
};

const propertyKey = (
  context: LintContext,
  node: NodeOf<"MemberExpression">,
): string | undefined => {
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  return staticText(context, node.property);
};

const propertyName = (
  context: LintContext,
  property: NodeOf<"Property" | "TSPropertySignature">,
): string | undefined => {
  return !property.computed && property.key.type === "Identifier"
    ? property.key.name
    : staticText(context, property.key);
};

const propertyBindingPath = (
  context: LintContext,
  property: NodeOf<"ObjectPattern">["properties"][number],
  resolve: Resolve<string[] | undefined>,
): string[] | undefined => {
  if (property.type === "RestElement") {
    return resolve(property.argument);
  }
  const suffix = resolve(property.value);
  const key = suffix === undefined ? undefined : propertyName(context, property);
  return key === undefined || suffix === undefined ? undefined : [key, ...suffix];
};

const destructuredOrigins = (
  context: LintContext,
  pattern: Node,
  inputs: readonly Origin[],
): readonly Origin[] => {
  if (pattern.type === "AssignmentPattern") {
    return destructuredOrigins(context, pattern.left, inputs);
  }
  if (pattern.type !== "ObjectPattern") {
    return inputs;
  }
  return pattern.properties.flatMap((property) => {
    if (property.type === "RestElement") {
      return inputs;
    }
    const key = propertyName(context, property);
    return key === undefined
      ? []
      : destructuredOrigins(
          context,
          property.value,
          inputs.map((origin) => extendOrigin(origin, [key])),
        );
  });
};

const importedOrigin = (declaration: Node): Origin | undefined => {
  if (
    !["ImportSpecifier", "ImportDefaultSpecifier", "ImportNamespaceSpecifier"].includes(
      declaration.type,
    ) ||
    declaration.parent?.type !== "ImportDeclaration"
  ) {
    return undefined;
  }
  const source = declaration.parent.source.value;
  if (declaration.type !== "ImportSpecifier") {
    return [source];
  }
  return declaration.imported.type === "Identifier"
    ? [source, declaration.imported.name]
    : [source, declaration.imported.value];
};

const bindingPath = (context: LintContext, pattern: Node, name: string): string[] | undefined => {
  if (pattern.type === "Identifier") {
    return pattern.name === name ? [] : undefined;
  }
  if (pattern.type !== "ObjectPattern") {
    return pattern.type === "AssignmentPattern"
      ? bindingPath(context, pattern.left, name)
      : undefined;
  }
  for (const property of pattern.properties) {
    const path = propertyBindingPath(context, property, (child) =>
      bindingPath(context, child, name),
    );
    if (path !== undefined) {
      return path;
    }
  }
  return undefined;
};

const identifierOrigins = (
  context: LintContext,
  node: NodeOf<"Identifier">,
  resolve: Resolve<Origin[]>,
): Origin[] => {
  const variable = variableOf(context, node);
  if (variable === undefined || variable.defs.length === 0) {
    const known = knownGlobals.get(node.name);
    return known === undefined ? [] : [known];
  }
  const definitions = variable.defs.flatMap((definition: DeepReadonly<Definition>): Origin[] => {
    const declaration = definition.node;
    const imported = importedOrigin(declaration);
    if (imported !== undefined) {
      return [imported];
    }
    if (declaration.type !== "VariableDeclarator" || !declaration.init) {
      return [];
    }
    const suffix = bindingPath(context, declaration.id, node.name);
    return suffix === undefined
      ? []
      : resolve(declaration.init).map((origin) => extendOrigin(origin, suffix));
  });
  const assignments = variable.references.flatMap((reference: DeepReadonly<Reference>) =>
    !reference.isWrite() || reference.init || !reference.writeExpr
      ? []
      : resolve(reference.writeExpr),
  );
  return [...definitions, ...assignments];
};

function callOrigins(
  context: LintContext,
  node: NodeOf<"CallExpression">,
  resolve: Resolve<Origin[]>,
): Origin[] {
  const targets = resolve(node.callee);
  if (
    targets.some((origin) =>
      ["node:module.createRequire", "module.createRequire"].includes(origin.join(".")),
    )
  ) {
    return [["require"]];
  }
  if (!targets.some((origin) => origin.length === 1 && origin[0] === "require")) {
    return [];
  }
  const [first] = node.arguments;
  const source = first === undefined ? undefined : staticText(context, first);
  return source === undefined ? [] : [[source]];
}

const memberOrigins = (
  context: LintContext,
  node: NodeOf<"MemberExpression">,
  resolve: Resolve<Origin[]>,
): Origin[] => {
  const key = propertyKey(context, node);
  return key === undefined ? [] : resolve(node.object).map((origin) => extendOrigin(origin, [key]));
};

const expressionOrigins = (
  context: LintContext,
  node: Node,
  resolve: Resolve<Origin[]>,
): Origin[] => {
  if (node.type === "MetaProperty") {
    return node.meta.name === "import" && node.property.name === "meta" ? [["import.meta"]] : [];
  }
  if (node.type === "MemberExpression") {
    return memberOrigins(context, node, resolve);
  }
  if (node.type === "ImportExpression") {
    const source = staticText(context, node.source);
    return source === undefined ? [] : [[source]];
  }
  if (node.type === "CallExpression") {
    return callOrigins(context, node, resolve);
  }
  return node.type === "Identifier" ? identifierOrigins(context, node, resolve) : [];
};

const origins = (
  context: LintContext,
  node: Node,
  seen: Readonly<ReadonlySet<Node>> = new Set(),
): Origin[] => {
  if (seen.has(node)) {
    return [];
  }
  const next = new Set([...seen, node]);
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "ChainExpression"
  ) {
    return origins(context, node.expression, next);
  }
  return node.type === "AwaitExpression"
    ? origins(context, node.argument, next)
    : expressionOrigins(context, node, (child) => origins(context, child, next));
};

export {
  bindingPath,
  destructuredOrigins,
  origins,
  propertyKey,
  propertyName,
  staticText,
  variableOf,
};
export type { Origin, Resolve };
