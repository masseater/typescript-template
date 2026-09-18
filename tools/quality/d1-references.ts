import { d1Property, d1Type, followPath, prefixPath, type D1Reference } from "./d1-types.ts";
import {
  bindingPath,
  origins,
  originsSeenFrom,
  propertyKey,
  propertyName,
  variableOf,
  type Resolve,
} from "./references.ts";

import type { Definition, Reference } from "vite-plus/lint/plugins";
import type { DeepReadonly, LintContext, Node, NodeOf } from "./lint-context.ts";

const objectD1References = (
  inspection: LintContext,
  lookup: {
    readonly node: NodeOf<"ObjectExpression">;
    readonly resolve: Resolve<D1Reference[]>;
  },
): D1Reference[] => {
  return lookup.node.properties.flatMap((property): D1Reference[] => {
    if (property.type === "SpreadElement") {
      return lookup.resolve(property.argument);
    }
    const memberName = propertyName(inspection, property);
    return memberName === undefined
      ? []
      : lookup.resolve(property.value).map((reference) => prefixPath(reference, memberName));
  });
};

const boundCallReferences = (reference: D1Reference, bound: boolean): D1Reference[] => {
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
    "@repo/config",
    new Map<string, D1Reference>([["readConfig", { kind: "database", path: ["DB"] }]]),
  ],
  ["@repo/db", new Map<string, D1Reference>([["createDb", { kind: "orm", path: [] }]])],
]);

type Resolution = {
  readonly references: Resolve<D1Reference[]>;
  readonly visited: Readonly<ReadonlySet<Node>>;
};

const callD1References = (
  inspection: LintContext,
  lookup: { readonly node: NodeOf<"CallExpression">; readonly resolution: Resolution },
): D1Reference[] => {
  const { node, resolution } = lookup;
  const known = originsSeenFrom(inspection, {
    node: node.callee,
    visited: resolution.visited,
  }).flatMap(([source, member]): D1Reference[] => {
    const factory = templateFactories.get(source ?? "")?.get(member ?? "");
    return factory === undefined ? [] : [factory];
  });
  const bound =
    node.callee.type === "MemberExpression" && propertyKey(inspection, node.callee) === "bind";
  return [
    ...known,
    ...resolution
      .references(node.callee)
      .flatMap((reference) => boundCallReferences(reference, bound)),
  ];
};

const markDynamic = (reference: D1Reference): D1Reference => {
  return { ...reference, method: "dynamic" };
};

const memberD1References = (
  inspection: LintContext,
  lookup: {
    readonly node: NodeOf<"MemberExpression">;
    readonly resolve: Resolve<D1Reference[]>;
  },
): D1Reference[] => {
  const member = propertyKey(inspection, lookup.node);
  const receiver = lookup.resolve(lookup.node.object);
  if (member !== undefined) {
    return d1Property(receiver, member);
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

type BindingLookup = {
  readonly boundName: string;
  readonly visited: Readonly<ReadonlySet<Node>>;
};

const annotatedBinding = (
  inspection: LintContext,
  lookup: BindingLookup & { readonly pattern: Node },
): D1Reference[] => {
  const { pattern } = lookup;
  if (pattern.type === "AssignmentPattern") {
    return annotatedBinding(inspection, { ...lookup, pattern: pattern.left });
  }
  if (pattern.type === "TSParameterProperty") {
    return annotatedBinding(inspection, { ...lookup, pattern: pattern.parameter });
  }
  const path = bindingPath(inspection, { boundName: lookup.boundName, pattern });
  if (!path || !("typeAnnotation" in pattern) || !pattern.typeAnnotation) {
    return [];
  }
  return followPath(
    d1Type(inspection, { node: pattern.typeAnnotation, visited: lookup.visited }),
    path,
  );
};

const definitionD1References = (
  inspection: LintContext,
  lookup: {
    readonly definition: DeepReadonly<Definition>;
    readonly resolution: Resolution & BindingLookup;
  },
): D1Reference[] => {
  const { definition, resolution } = lookup;
  const declaration = definition.node;
  if (declaration.type === "VariableDeclarator") {
    const path = bindingPath(inspection, {
      boundName: resolution.boundName,
      pattern: declaration.id,
    });
    return [
      ...annotatedBinding(inspection, { ...resolution, pattern: declaration.id }),
      ...(path && declaration.init
        ? followPath(resolution.references(declaration.init), path)
        : []),
    ];
  }
  if (definition.type === "Parameter" && "params" in declaration) {
    return declaration.params.flatMap((parameter) =>
      annotatedBinding(inspection, { ...resolution, pattern: parameter }),
    );
  }
  return [];
};

const assignmentPattern = (node: Node): Node => {
  const { parent } = node;
  return parent && parent.type !== "AssignmentExpression" ? assignmentPattern(parent) : node;
};

const assignmentD1References = (
  inspection: LintContext,
  lookup: {
    readonly reference: DeepReadonly<Reference>;
    readonly resolution: Resolution & BindingLookup;
  },
): D1Reference[] => {
  const { reference, resolution } = lookup;
  if (!reference.isWrite() || reference.init || !reference.writeExpr) {
    return [];
  }
  const path = bindingPath(inspection, {
    boundName: resolution.boundName,
    pattern: assignmentPattern(reference.identifier),
  });
  return path ? followPath(resolution.references(reference.writeExpr), path) : [];
};

const identifierD1References = (
  inspection: LintContext,
  lookup: { readonly node: NodeOf<"Identifier">; readonly resolution: Resolution },
): D1Reference[] => {
  const { node, resolution } = lookup;
  const variable = variableOf(inspection, node);
  if (variable === undefined) {
    return [];
  }
  const bound = { ...resolution, boundName: node.name };
  return [
    ...origins(inspection, node).flatMap(([source, member]) =>
      workerBindingReferences(source, member),
    ),
    ...variable.defs.flatMap((definition: DeepReadonly<Definition>) =>
      definitionD1References(inspection, { definition, resolution: bound }),
    ),
    ...variable.references.flatMap((reference: DeepReadonly<Reference>) =>
      assignmentD1References(inspection, { reference, resolution: bound }),
    ),
  ];
};

const compositeD1References = (
  inspection: LintContext,
  lookup: { readonly node: Node; readonly resolution: Resolution },
): D1Reference[] => {
  const { node, resolution } = lookup;
  if (node.type === "MemberExpression") {
    return memberD1References(inspection, { node, resolve: resolution.references });
  }
  if (node.type === "ObjectExpression") {
    return objectD1References(inspection, { node, resolve: resolution.references });
  }
  if (node.type === "CallExpression") {
    return callD1References(inspection, { node, resolution });
  }
  return node.type === "Identifier" ? identifierD1References(inspection, { node, resolution }) : [];
};

const unwrappedD1Node = (node: Node): Node | undefined => {
  if (node.type === "ChainExpression" || node.type === "TSNonNullExpression") {
    return node.expression;
  }
  return node.type === "AwaitExpression" ? node.argument : undefined;
};

const expressionD1References = (
  inspection: LintContext,
  lookup: { readonly node: Node; readonly resolution: Resolution },
): D1Reference[] => {
  const { node, resolution } = lookup;
  const { references } = resolution;
  const unwrapped = unwrappedD1Node(node);
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSSatisfiesExpression"
  ) {
    return [
      ...references(node.expression),
      ...d1Type(inspection, { node: node.typeAnnotation, visited: resolution.visited }),
    ];
  }
  if (unwrapped !== undefined) {
    return references(unwrapped);
  }
  if (node.type === "ConditionalExpression") {
    return [...references(node.consequent), ...references(node.alternate)];
  }
  return node.type === "LogicalExpression"
    ? [...references(node.left), ...references(node.right)]
    : compositeD1References(inspection, { node, resolution });
};

const d1ReferencesSeenFrom = (
  inspection: LintContext,
  traversal: { readonly node: Node; readonly visited: Readonly<ReadonlySet<Node>> },
): D1Reference[] => {
  const { node, visited } = traversal;
  if (visited.has(node)) {
    return [];
  }
  if (node.type === "TSTypeAnnotation") {
    return d1Type(inspection, { node, visited });
  }
  const deepened = new Set([...visited, node]);
  return expressionD1References(inspection, {
    node,
    resolution: {
      references: (child) => d1ReferencesSeenFrom(inspection, { node: child, visited: deepened }),
      visited: deepened,
    },
  });
};

const d1References = (inspection: LintContext, node: Node): D1Reference[] => {
  return d1ReferencesSeenFrom(inspection, { node, visited: new Set() });
};

const isD1Operation = (inspection: LintContext, node: Node): boolean => {
  return d1References(inspection, node).some(
    (reference) => reference.path.length === 0 && reference.method !== undefined,
  );
};

const destructuredOperation = (
  inspection: LintContext,
  destructuring: { readonly node: Node; readonly references: readonly D1Reference[] },
): boolean => {
  const { node, references } = destructuring;
  if (node.type === "AssignmentPattern") {
    return destructuredOperation(inspection, { node: node.left, references });
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
    const memberName = propertyName(inspection, property);
    return (
      memberName !== undefined &&
      destructuredOperation(inspection, {
        node: property.value,
        references: d1Property(references, memberName),
      })
    );
  });
};

const destructuresD1Operation = (
  inspection: LintContext,
  destructuring: { readonly input: Node; readonly pattern: Node },
): boolean => {
  return destructuredOperation(inspection, {
    node: destructuring.pattern,
    references: d1References(inspection, destructuring.input),
  });
};

export { destructuresD1Operation, isD1Operation };
