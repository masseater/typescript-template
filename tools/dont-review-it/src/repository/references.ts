import {
  scopeOf,
  type DeepReadonly,
  type LintContext,
  type Node,
  type NodeOf,
} from "./lint-context.ts";

import type { Definition, Reference, Variable } from "vite-plus/lint/plugins";

type ScopeLink = {
  readonly set: { readonly get: (declared: string) => Variable | undefined };
  readonly upper: ScopeLink | null;
};

const variableOf = (inspection: LintContext, node: NodeOf<"Identifier">): Variable | undefined => {
  const declaredIn = (scope: ScopeLink | null): Variable | undefined =>
    scope === null ? undefined : (scope.set.get(node.name) ?? declaredIn(scope.upper));
  return declaredIn(scopeOf(inspection, node));
};

const constantInitializer = (
  inspection: LintContext,
  node: NodeOf<"Identifier">,
): Node | undefined => {
  const variable = variableOf(inspection, node);
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

type Resolve<Resolved> = (node: Node) => Resolved;

const concatenatedText = (
  left: string | undefined,
  right: string | undefined,
): string | undefined => {
  return left === undefined || right === undefined ? undefined : left + right;
};

const derivedText = (
  inspection: LintContext,
  lookup: { readonly node: Node; readonly resolve: Resolve<string | undefined> },
): string | undefined => {
  const { node, resolve } = lookup;
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion"
  ) {
    return resolve(node.expression);
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    return concatenatedText(resolve(node.left), resolve(node.right));
  }
  const initializer =
    node.type === "Identifier" ? constantInitializer(inspection, node) : undefined;
  return initializer === undefined ? undefined : resolve(initializer);
};

const literalText = (node: Node): string | undefined => {
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }
  if (node.type !== "TemplateLiteral") {
    return undefined;
  }
  return node.expressions.length === 0 ? (node.quasis[0]?.value.cooked ?? undefined) : undefined;
};

const staticText = (inspection: LintContext, node: Node): string | undefined => {
  const textOf = (inspected: Node, visited: Readonly<ReadonlySet<Node>>): string | undefined => {
    const deepened = new Set([...visited, inspected]);
    return visited.has(inspected)
      ? undefined
      : (literalText(inspected) ??
          derivedText(inspection, {
            node: inspected,
            resolve: (child) => textOf(child, deepened),
          }));
  };
  return textOf(node, new Set());
};

const propertyName = (
  inspection: LintContext,
  property: NodeOf<"Property" | "TSPropertySignature">,
): string | undefined => {
  return !property.computed && property.key.type === "Identifier"
    ? property.key.name
    : staticText(inspection, property.key);
};

type Origin = readonly string[];

const extendOrigin = (origin: Origin, suffix: readonly string[]): Origin => {
  return [...origin, ...suffix];
};

const destructuredOrigins = (
  inspection: LintContext,
  binding: { readonly inputs: readonly Origin[]; readonly pattern: Node },
): readonly Origin[] => {
  const spread = (pattern: Node, inputs: readonly Origin[]): readonly Origin[] => {
    if (pattern.type === "AssignmentPattern") {
      return spread(pattern.left, inputs);
    }
    if (pattern.type !== "ObjectPattern") {
      return inputs;
    }
    return pattern.properties.flatMap((property) => {
      if (property.type === "RestElement") {
        return inputs;
      }
      const memberName = propertyName(inspection, property);
      return memberName === undefined
        ? []
        : spread(
            property.value,
            inputs.map((origin) => extendOrigin(origin, [memberName])),
          );
    });
  };
  return spread(binding.pattern, binding.inputs);
};

const propertyBindingPath = (
  inspection: LintContext,
  lookup: {
    readonly property: NodeOf<"ObjectPattern">["properties"][number];
    readonly resolve: Resolve<string[] | undefined>;
  },
): string[] | undefined => {
  const { property, resolve } = lookup;
  if (property.type === "RestElement") {
    return resolve(property.argument);
  }
  const suffix = resolve(property.value);
  const memberName = suffix === undefined ? undefined : propertyName(inspection, property);
  return memberName === undefined || suffix === undefined ? undefined : [memberName, ...suffix];
};

const bindingPath = (
  inspection: LintContext,
  binding: { readonly boundName: string; readonly pattern: Node },
): string[] | undefined => {
  const pathTo = (pattern: Node): string[] | undefined => {
    if (pattern.type === "Identifier") {
      return pattern.name === binding.boundName ? [] : undefined;
    }
    if (pattern.type === "AssignmentPattern") {
      return pathTo(pattern.left);
    }
    return pattern.type === "ObjectPattern"
      ? pattern.properties
          .map((property) => propertyBindingPath(inspection, { property, resolve: pathTo }))
          .find((path) => path !== undefined)
      : undefined;
  };
  return pathTo(binding.pattern);
};

type OriginLookup<Inspected extends Node = Node> = {
  readonly node: Inspected;
  readonly resolve: Resolve<Origin[]>;
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

const definitionOrigins = (
  inspection: LintContext,
  lookup: OriginLookup<NodeOf<"Identifier">> & { readonly definition: DeepReadonly<Definition> },
): Origin[] => {
  const declaration = lookup.definition.node;
  const imported = importedOrigin(declaration);
  if (imported !== undefined) {
    return [imported];
  }
  if (declaration.type !== "VariableDeclarator" || !declaration.init) {
    return [];
  }
  const suffix = bindingPath(inspection, {
    boundName: lookup.node.name,
    pattern: declaration.id,
  });
  return suffix === undefined
    ? []
    : lookup.resolve(declaration.init).map((origin) => extendOrigin(origin, suffix));
};

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

const identifierOrigins = (
  inspection: LintContext,
  lookup: OriginLookup<NodeOf<"Identifier">>,
): Origin[] => {
  const variable = variableOf(inspection, lookup.node);
  if (variable === undefined || variable.defs.length === 0) {
    const known = knownGlobals.get(lookup.node.name);
    return known === undefined ? [] : [known];
  }
  const definitions = variable.defs.flatMap((definition: DeepReadonly<Definition>) =>
    definitionOrigins(inspection, { ...lookup, definition }),
  );
  const assignments = variable.references.flatMap((reference: DeepReadonly<Reference>) =>
    !reference.isWrite() || reference.init || !reference.writeExpr
      ? []
      : lookup.resolve(reference.writeExpr),
  );
  return [...definitions, ...assignments];
};

const callOrigins = (
  inspection: LintContext,
  lookup: OriginLookup<NodeOf<"CallExpression">>,
): Origin[] => {
  const called = lookup.resolve(lookup.node.callee);
  if (
    called.some((origin) =>
      ["node:module.createRequire", "module.createRequire"].includes(origin.join(".")),
    )
  ) {
    return [["require"]];
  }
  if (!called.some((origin) => origin.length === 1 && origin[0] === "require")) {
    return [];
  }
  const [first] = lookup.node.arguments;
  const source = first === undefined ? undefined : staticText(inspection, first);
  return source === undefined ? [] : [[source]];
};

const propertyKey = (
  inspection: LintContext,
  node: NodeOf<"MemberExpression">,
): string | undefined => {
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  return staticText(inspection, node.property);
};

const memberOrigins = (
  inspection: LintContext,
  lookup: OriginLookup<NodeOf<"MemberExpression">>,
): Origin[] => {
  const member = propertyKey(inspection, lookup.node);
  return member === undefined
    ? []
    : lookup.resolve(lookup.node.object).map((origin) => extendOrigin(origin, [member]));
};

const metaOrigins = (node: NodeOf<"MetaProperty">): Origin[] => {
  return node.meta.name === "import" && node.property.name === "meta" ? [["import.meta"]] : [];
};

const importedModuleOrigins = (
  inspection: LintContext,
  node: NodeOf<"ImportExpression">,
): Origin[] => {
  const source = staticText(inspection, node.source);
  return source === undefined ? [] : [[source]];
};

const expressionOrigins = (inspection: LintContext, lookup: OriginLookup): Origin[] => {
  const { node, resolve } = lookup;
  if (node.type === "MetaProperty") {
    return metaOrigins(node);
  }
  if (node.type === "MemberExpression") {
    return memberOrigins(inspection, { node, resolve });
  }
  if (node.type === "ImportExpression") {
    return importedModuleOrigins(inspection, node);
  }
  if (node.type === "CallExpression") {
    return callOrigins(inspection, { node, resolve });
  }
  return node.type === "Identifier" ? identifierOrigins(inspection, { node, resolve }) : [];
};

const unwrappedOrigin = (node: Node): Node | undefined => {
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "ChainExpression"
  ) {
    return node.expression;
  }
  return node.type === "AwaitExpression" ? node.argument : undefined;
};

const originsSeenFrom = (
  inspection: LintContext,
  traversal: { readonly node: Node; readonly visited: Readonly<ReadonlySet<Node>> },
): Origin[] => {
  const { node, visited } = traversal;
  const deepened = new Set([...visited, node]);
  const unwrapped = unwrappedOrigin(node);
  if (visited.has(node)) {
    return [];
  }
  return unwrapped === undefined
    ? expressionOrigins(inspection, {
        node,
        resolve: (child) => originsSeenFrom(inspection, { node: child, visited: deepened }),
      })
    : originsSeenFrom(inspection, { node: unwrapped, visited: deepened });
};

const origins = (inspection: LintContext, node: Node): Origin[] => {
  return originsSeenFrom(inspection, { node, visited: new Set() });
};

export {
  bindingPath,
  destructuredOrigins,
  origins,
  originsSeenFrom,
  propertyKey,
  propertyName,
  staticText,
  variableOf,
};
export type { Origin, Resolve };
