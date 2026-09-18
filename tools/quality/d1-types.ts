import type { LintContext, Node, NodeOf } from "./lint-context.ts";
import { origins, propertyName, staticText, variableOf } from "./references.ts";
import type { Resolve } from "./references.ts";

type D1Kind = "database" | "session" | "statement" | "orm";

interface D1Reference {
  readonly kind: D1Kind;
  readonly method?: string | undefined;
  readonly path: readonly string[];
}

const d1Methods: Readonly<Record<D1Kind, ReadonlySet<string>>> = {
  database: new Set(["prepare", "batch", "exec", "withSession", "dump"]),
  orm: new Set(),
  session: new Set(["prepare", "batch"]),
  statement: new Set(["bind", "first", "run", "all", "raw"]),
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

function prefixPath(reference: D1Reference, key: string): D1Reference {
  return { ...reference, path: [key, ...reference.path] };
}

function d1Property(references: readonly D1Reference[], key: string): D1Reference[] {
  return references.flatMap((reference): D1Reference[] => {
    if (reference.path.length > 0) {
      return reference.path[0] === key ? [{ ...reference, path: reference.path.slice(1) }] : [];
    }
    if (reference.method !== undefined) {
      return ["bind", "call", "apply"].includes(key) ? [reference] : [];
    }
    if (reference.kind === "orm" && key === "$client") {
      return [{ kind: "database", path: [] }];
    }
    return d1Methods[reference.kind].has(key) ? [{ ...reference, method: key }] : [];
  });
}

function followPath(references: readonly D1Reference[], path: readonly string[]): D1Reference[] {
  let current = [...references];
  for (const key of path) {
    current = d1Property(current, key);
  }
  return current;
}

function d1NamedType(source: string, name: string): D1Reference[] {
  const workerKind =
    source === "@cloudflare/workers-types" ||
    source.startsWith("@cloudflare/workers-types/") ||
    source === "global"
      ? workerTypeKinds.get(name)
      : undefined;
  if (workerKind !== undefined) {
    return [{ kind: workerKind, path: [] }];
  }
  const known = templateTypes.get(source)?.get(name);
  return known === undefined ? [] : [known];
}

function declaredType(block: NodeOf<"Program" | "BlockStatement">, name: string): Node | undefined {
  for (const statement of block.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (
      (declaration?.type === "TSTypeAliasDeclaration" ||
        declaration?.type === "TSInterfaceDeclaration") &&
      declaration.id.name === name
    ) {
      return declaration;
    }
  }
  return undefined;
}

function localType(node: Node, name: string): Node | undefined {
  const { parent } = node;
  if (!parent) {
    return undefined;
  }
  const declaration =
    parent.type === "Program" || parent.type === "BlockStatement"
      ? declaredType(parent, name)
      : undefined;
  return declaration ?? localType(parent, name);
}

function memberD1Types(
  context: LintContext,
  members: NodeOf<"TSTypeLiteral">["members"],
  resolve: Resolve<D1Reference[]>,
): D1Reference[] {
  return members.flatMap((member): D1Reference[] => {
    if (member.type !== "TSPropertySignature" || !member.typeAnnotation) {
      return [];
    }
    const key = propertyName(context, member);
    return key === undefined
      ? []
      : resolve(member.typeAnnotation).map((reference) => prefixPath(reference, key));
  });
}

function declaredD1Type(
  context: LintContext,
  node: Node,
  resolve: Resolve<D1Reference[]>,
): D1Reference[] {
  if (node.type === "TSIndexedAccessType" && node.indexType.type === "TSLiteralType") {
    const key = staticText(context, node.indexType.literal);
    return key === undefined ? [] : d1Property(resolve(node.objectType), key);
  }
  if (node.type === "TSInterfaceDeclaration") {
    return [...resolve(node.body), ...node.extends.flatMap((base) => resolve(base.expression))];
  }
  if (node.type === "TSTypeLiteral") {
    return memberD1Types(context, node.members, resolve);
  }
  return node.type === "TSInterfaceBody" ? memberD1Types(context, node.body, resolve) : [];
}

function identifierD1Type(
  context: LintContext,
  node: NodeOf<"Identifier">,
  resolve: Resolve<D1Reference[]>,
): D1Reference[] {
  const declaration = localType(node, node.name);
  if (declaration !== undefined) {
    return resolve(declaration);
  }
  const imported = origins(context, node);
  if (imported.length > 0) {
    return imported.flatMap(([source, name]) => d1NamedType(source ?? "", name ?? ""));
  }
  return variableOf(context, node) === undefined ? d1NamedType("global", node.name) : [];
}

function namedD1Type(
  context: LintContext,
  node: Node,
  resolve: Resolve<D1Reference[]>,
): D1Reference[] {
  if (node.type === "TSQualifiedName") {
    return origins(context, node.left).flatMap((origin) =>
      d1NamedType(origin[0] ?? "", node.right.name),
    );
  }
  if (node.type === "TSImportType" && node.qualifier?.type === "Identifier") {
    return d1NamedType(node.source.value, node.qualifier.name);
  }
  return node.type === "Identifier"
    ? identifierD1Type(context, node, resolve)
    : declaredD1Type(context, node, resolve);
}

function d1Type(
  context: LintContext,
  node: Node,
  seen: Readonly<ReadonlySet<Node>>,
): D1Reference[] {
  if (seen.has(node)) {
    return [];
  }
  const next = new Set([...seen, node]);
  if (
    node.type === "TSTypeAnnotation" ||
    node.type === "TSTypeAliasDeclaration" ||
    node.type === "TSParenthesizedType" ||
    node.type === "TSTypeOperator"
  ) {
    return d1Type(context, node.typeAnnotation, next);
  }
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return node.types.flatMap((type) => d1Type(context, type, next));
  }
  return node.type === "TSTypeReference"
    ? d1Type(context, node.typeName, next)
    : namedD1Type(context, node, (child) => d1Type(context, child, next));
}

export { d1Property, d1Type, followPath, prefixPath };
export type { D1Reference };
