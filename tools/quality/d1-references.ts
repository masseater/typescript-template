import { d1Property, d1Type, followPath, prefixPath } from "./d1-types.ts";
import { bindingPath, origins, propertyKey, propertyName, variableOf } from "./references.ts";

import type { Definition, Reference } from "vite-plus/lint/plugins";
import type { D1Reference } from "./d1-types.ts";
import type { DeepReadonly, LintContext, Node, NodeOf } from "./lint-context.ts";
import type { Resolve } from "./references.ts";

type BindingLookup = {
  readonly name: string;
  readonly seen: Readonly<ReadonlySet<Node>>;
};

const annotatedBinding = (
  context: LintContext,
  pattern: Node,
  lookup: BindingLookup,
): D1Reference[] => {
  if (pattern.type === "AssignmentPattern") {
    return annotatedBinding(context, pattern.left, lookup);
  }
  if (pattern.type === "TSParameterProperty") {
    return annotatedBinding(context, pattern.parameter, lookup);
  }
  const path = bindingPath(context, pattern, lookup.name);
  if (!path || !("typeAnnotation" in pattern) || !pattern.typeAnnotation) {
    return [];
  }
  return followPath(d1Type(context, pattern.typeAnnotation, lookup.seen), path);
};

const objectD1References = (
  context: LintContext,
  node: NodeOf<"ObjectExpression">,
  resolve: Resolve<D1Reference[]>,
): D1Reference[] => {
  return node.properties.flatMap((property): D1Reference[] => {
    if (property.type === "SpreadElement") {
      return resolve(property.argument);
    }
    const key = propertyName(context, property);
    return key === undefined
      ? []
      : resolve(property.value).map((reference) => prefixPath(reference, key));
  });
};

const callResult = (reference: D1Reference, bound: boolean): D1Reference[] => {
  if (bound) {
    return [reference];
  }
  if (reference.method === "prepare" || reference.method === "bind") {
    return [{ kind: "statement", path: [] }];
  }
  return reference.method === "withSession" ? [{ kind: "session", path: [] }] : [];
};

const templateFactories = new Map<string, ReadonlyMap<string, D1Reference>>([
  [
    "@template/config",
    new Map<string, D1Reference>([["readConfig", { kind: "database", path: ["DB"] }]]),
  ],
  ["@template/db", new Map<string, D1Reference>([["createDb", { kind: "orm", path: [] }]])],
]);

type Resolution = {
  readonly references: Resolve<D1Reference[]>;
  readonly seen: Readonly<ReadonlySet<Node>>;
};

const callD1References = (
  context: LintContext,
  node: NodeOf<"CallExpression">,
  resolution: Resolution,
): D1Reference[] => {
  const known = origins(context, node.callee, resolution.seen).flatMap(
    ([source, name]): D1Reference[] => {
      const factory = templateFactories.get(source ?? "")?.get(name ?? "");
      return factory === undefined ? [] : [factory];
    },
  );
  const bound =
    node.callee.type === "MemberExpression" && propertyKey(context, node.callee) === "bind";
  return [
    ...known,
    ...resolution.references(node.callee).flatMap((reference) => callResult(reference, bound)),
  ];
};

const markDynamic = (reference: D1Reference): D1Reference => {
  return { ...reference, method: "dynamic" };
};

const memberD1References = (
  context: LintContext,
  node: NodeOf<"MemberExpression">,
  resolve: Resolve<D1Reference[]>,
): D1Reference[] => {
  const key = propertyKey(context, node);
  const receiver = resolve(node.object);
  if (key !== undefined) {
    return d1Property(receiver, key);
  }
  return receiver
    .filter((reference) => reference.path.length === 0 && reference.kind !== "orm")
    .map((reference) => markDynamic(reference));
};

const workerBindingReferences = (
  source: string | undefined,
  member: string | undefined,
): D1Reference[] => {
  if (source !== "cloudflare:workers") {
    return [];
  }
  if (member === "env") {
    return [{ kind: "database", path: ["DB"] }];
  }
  return member === undefined ? [{ kind: "database", path: ["env", "DB"] }] : [];
};

const definitionD1References = (
  context: LintContext,
  definition: DeepReadonly<Definition>,
  resolution: Resolution & BindingLookup,
): D1Reference[] => {
  const declaration = definition.node;
  if (declaration.type === "VariableDeclarator") {
    const path = bindingPath(context, declaration.id, resolution.name);
    return [
      ...annotatedBinding(context, declaration.id, resolution),
      ...(path && declaration.init
        ? followPath(resolution.references(declaration.init), path)
        : []),
    ];
  }
  if (definition.type === "Parameter" && "params" in declaration) {
    return declaration.params.flatMap((parameter) =>
      annotatedBinding(context, parameter, resolution),
    );
  }
  return [];
};

const assignmentPattern = (node: Node): Node => {
  const { parent } = node;
  return parent && parent.type !== "AssignmentExpression" ? assignmentPattern(parent) : node;
};

const assignmentD1References = (
  context: LintContext,
  reference: DeepReadonly<Reference>,
  resolution: Resolution & BindingLookup,
): D1Reference[] => {
  if (!reference.isWrite() || reference.init || !reference.writeExpr) {
    return [];
  }
  const path = bindingPath(context, assignmentPattern(reference.identifier), resolution.name);
  return path ? followPath(resolution.references(reference.writeExpr), path) : [];
};

const identifierD1References = (
  context: LintContext,
  node: NodeOf<"Identifier">,
  resolution: Resolution,
): D1Reference[] => {
  const variable = variableOf(context, node);
  if (variable === undefined) {
    return [];
  }
  const lookup = { ...resolution, name: node.name };
  return [
    ...origins(context, node).flatMap(([source, member]) =>
      workerBindingReferences(source, member),
    ),
    ...variable.defs.flatMap((definition: DeepReadonly<Definition>) =>
      definitionD1References(context, definition, lookup),
    ),
    ...variable.references.flatMap((reference: DeepReadonly<Reference>) =>
      assignmentD1References(context, reference, lookup),
    ),
  ];
};

const compositeD1References = (
  context: LintContext,
  node: Node,
  resolution: Resolution,
): D1Reference[] => {
  if (node.type === "MemberExpression") {
    return memberD1References(context, node, resolution.references);
  }
  if (node.type === "ObjectExpression") {
    return objectD1References(context, node, resolution.references);
  }
  if (node.type === "CallExpression") {
    return callD1References(context, node, resolution);
  }
  return node.type === "Identifier" ? identifierD1References(context, node, resolution) : [];
};

const expressionD1References = (
  context: LintContext,
  node: Node,
  resolution: Resolution,
): D1Reference[] => {
  const { references } = resolution;
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSSatisfiesExpression"
  ) {
    return [
      ...references(node.expression),
      ...d1Type(context, node.typeAnnotation, resolution.seen),
    ];
  }
  if (node.type === "ChainExpression" || node.type === "TSNonNullExpression") {
    return references(node.expression);
  }
  if (node.type === "AwaitExpression") {
    return references(node.argument);
  }
  if (node.type === "ConditionalExpression") {
    return [...references(node.consequent), ...references(node.alternate)];
  }
  return node.type === "LogicalExpression"
    ? [...references(node.left), ...references(node.right)]
    : compositeD1References(context, node, resolution);
};

const d1References = (
  context: LintContext,
  node: Node,
  seen: Readonly<ReadonlySet<Node>> = new Set(),
): D1Reference[] => {
  if (seen.has(node)) {
    return [];
  }
  if (node.type === "TSTypeAnnotation") {
    return d1Type(context, node, seen);
  }
  const next = new Set([...seen, node]);
  return expressionD1References(context, node, {
    references: (child) => d1References(context, child, next),
    seen: next,
  });
};

const isD1Operation = (context: LintContext, node: Node): boolean => {
  return d1References(context, node).some(
    (reference) => reference.path.length === 0 && reference.method !== undefined,
  );
};

const destructuredOperation = (
  context: LintContext,
  node: Node,
  references: readonly D1Reference[],
): boolean => {
  if (node.type === "AssignmentPattern") {
    return destructuredOperation(context, node.left, references);
  }
  if (node.type !== "ObjectPattern") {
    return references.some(
      (reference) => reference.path.length === 0 && reference.method !== undefined,
    );
  }
  return node.properties.some((property) => {
    if (property.type === "RestElement") {
      return false;
    }
    const key = propertyName(context, property);
    return (
      key !== undefined &&
      destructuredOperation(context, property.value, d1Property(references, key))
    );
  });
};

const destructuresD1Operation = (context: LintContext, pattern: Node, input: Node): boolean => {
  return destructuredOperation(context, pattern, d1References(context, input));
};

export { destructuresD1Operation, isD1Operation };
