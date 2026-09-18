import { origins, propertyName, staticText, variableOf, type Resolve } from "./references.ts";

import type { LintContext, Node, NodeOf } from "./lint-context.ts";

const d1Methods = {
  database: new Set(["prepare", "batch", "exec", "withSession", "dump"]),
  orm: new Set<string>(),
  session: new Set(["prepare", "batch"]),
  statement: new Set(["bind", "first", "run", "all", "raw"]),
} satisfies Readonly<Record<string, ReadonlySet<string>>>;

type D1Kind = keyof typeof d1Methods;

type D1Reference = {
  readonly kind: D1Kind;
  readonly method?: string | undefined;
  readonly path: readonly string[];
};

const d1Property = (references: readonly D1Reference[], segment: string): D1Reference[] => {
  return references.flatMap((reference): D1Reference[] => {
    if (reference.path.length > 0) {
      return reference.path[0] === segment ? [{ ...reference, path: reference.path.slice(1) }] : [];
    }
    if (reference.method !== undefined) {
      return ["bind", "call", "apply"].includes(segment) ? [reference] : [];
    }
    if (reference.kind === "orm" && segment === "$client") {
      return [{ kind: "database", path: [] }];
    }
    return d1Methods[reference.kind].has(segment) ? [{ ...reference, method: segment }] : [];
  });
};

const followPath = (references: readonly D1Reference[], path: readonly string[]): D1Reference[] => {
  return path.reduce<D1Reference[]>(
    (reached, segment) => d1Property(reached, segment),
    [...references],
  );
};

const prefixPath = (reference: D1Reference, segment: string): D1Reference => {
  return { ...reference, path: [segment, ...reference.path] };
};

const memberD1Types = (
  inspection: LintContext,
  lookup: {
    readonly members: NodeOf<"TSTypeLiteral">["members"];
    readonly resolve: Resolve<D1Reference[]>;
  },
): D1Reference[] => {
  return lookup.members.flatMap((member): D1Reference[] => {
    if (member.type !== "TSPropertySignature" || !member.typeAnnotation) {
      return [];
    }
    const memberName = propertyName(inspection, member);
    return memberName === undefined
      ? []
      : lookup.resolve(member.typeAnnotation).map((reference) => prefixPath(reference, memberName));
  });
};

type D1TypeLookup<Inspected extends Node = Node> = {
  readonly node: Inspected;
  readonly resolve: Resolve<D1Reference[]>;
};

const declaredD1Type = (inspection: LintContext, lookup: D1TypeLookup): D1Reference[] => {
  const { node, resolve } = lookup;
  if (node.type === "TSIndexedAccessType" && node.indexType.type === "TSLiteralType") {
    const segment = staticText(inspection, node.indexType.literal);
    return segment === undefined ? [] : d1Property(resolve(node.objectType), segment);
  }
  if (node.type === "TSInterfaceDeclaration") {
    return [...resolve(node.body), ...node.extends.flatMap((base) => resolve(base.expression))];
  }
  if (node.type === "TSTypeLiteral") {
    return memberD1Types(inspection, { members: node.members, resolve });
  }
  return node.type === "TSInterfaceBody"
    ? memberD1Types(inspection, { members: node.body, resolve })
    : [];
};

const declaredType = (
  block: NodeOf<"Program" | "BlockStatement">,
  typeName: string,
): Node | undefined => {
  for (const statement of block.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (
      (declaration?.type === "TSTypeAliasDeclaration" ||
        declaration?.type === "TSInterfaceDeclaration") &&
      declaration.id.name === typeName
    ) {
      return declaration;
    }
  }
  return undefined;
};

const localType = (node: Node, typeName: string): Node | undefined => {
  const { parent } = node;
  if (!parent) {
    return undefined;
  }
  const declaration =
    parent.type === "Program" || parent.type === "BlockStatement"
      ? declaredType(parent, typeName)
      : undefined;
  return declaration ?? localType(parent, typeName);
};

const workerTypeKinds = new Map<string, D1Kind>([
  ["D1Database", "database"],
  ["D1DatabaseSession", "session"],
  ["D1PreparedStatement", "statement"],
]);

const templateTypes = new Map<string, ReadonlyMap<string, D1Reference>>([
  [
    "@repo/db",
    new Map<string, D1Reference>([
      ["DatabaseBinding", { kind: "database", path: [] }],
      ["Database", { kind: "orm", path: [] }],
    ]),
  ],
  [
    "@repo/config",
    new Map<string, D1Reference>([["AppConfig", { kind: "database", path: ["DB"] }]]),
  ],
  [
    "@repo/runtime",
    new Map<string, D1Reference>([
      ["AppRequestContext", { kind: "database", path: ["runtime", "config", "DB"] }],
    ]),
  ],
]);

const d1NamedType = (source: string, typeName: string): D1Reference[] => {
  const workerKind =
    source === "@cloudflare/workers-types" ||
    source.startsWith("@cloudflare/workers-types/") ||
    source === "global"
      ? workerTypeKinds.get(typeName)
      : undefined;
  if (workerKind !== undefined) {
    return [{ kind: workerKind, path: [] }];
  }
  const known = templateTypes.get(source)?.get(typeName);
  return known === undefined ? [] : [known];
};

const identifierD1Type = (
  inspection: LintContext,
  lookup: D1TypeLookup<NodeOf<"Identifier">>,
): D1Reference[] => {
  const declaration = localType(lookup.node, lookup.node.name);
  if (declaration !== undefined) {
    return lookup.resolve(declaration);
  }
  const imported = origins(inspection, lookup.node);
  if (imported.length > 0) {
    return imported.flatMap(([source, typeName]) => d1NamedType(source ?? "", typeName ?? ""));
  }
  return variableOf(inspection, lookup.node) === undefined
    ? d1NamedType("global", lookup.node.name)
    : [];
};

const namedD1Type = (inspection: LintContext, lookup: D1TypeLookup): D1Reference[] => {
  const { node, resolve } = lookup;
  if (node.type === "TSQualifiedName") {
    return origins(inspection, node.left).flatMap((origin) =>
      d1NamedType(origin[0] ?? "", node.right.name),
    );
  }
  if (node.type === "TSImportType" && node.qualifier?.type === "Identifier") {
    return d1NamedType(node.source.value, node.qualifier.name);
  }
  return node.type === "Identifier"
    ? identifierD1Type(inspection, { node, resolve })
    : declaredD1Type(inspection, { node, resolve });
};

const d1Type = (
  inspection: LintContext,
  traversal: { readonly node: Node; readonly visited: Readonly<ReadonlySet<Node>> },
): D1Reference[] => {
  const { node, visited } = traversal;
  if (visited.has(node)) {
    return [];
  }
  const deepened = new Set([...visited, node]);
  if (
    node.type === "TSTypeAnnotation" ||
    node.type === "TSTypeAliasDeclaration" ||
    node.type === "TSParenthesizedType" ||
    node.type === "TSTypeOperator"
  ) {
    return d1Type(inspection, { node: node.typeAnnotation, visited: deepened });
  }
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return node.types.flatMap((member) => d1Type(inspection, { node: member, visited: deepened }));
  }
  return node.type === "TSTypeReference"
    ? d1Type(inspection, { node: node.typeName, visited: deepened })
    : namedD1Type(inspection, {
        node,
        resolve: (child) => d1Type(inspection, { node: child, visited: deepened }),
      });
};

export { d1Property, d1Type, followPath, prefixPath };
export type { D1Reference };
