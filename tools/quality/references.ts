import type { Context, ESTree, Variable } from "vite-plus/lint/plugins";

type Node = ESTree.Node;
export type Origin = readonly string[];

function variableOf(
  context: Context,
  node: Extract<Node, { type: "Identifier" }>,
): Variable | undefined {
  for (let scope = context.sourceCode.getScope(node); scope;) {
    const variable = scope.set.get(node.name);
    if (variable) return variable;
    if (!scope.upper) break;
    scope = scope.upper;
  }
  return undefined;
}

export function staticText(
  context: Context,
  node: Node,
  seen = new Set<Node>(),
): string | undefined {
  if (seen.has(node)) return undefined;
  const next = new Set([...seen, node]);
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion"
  )
    return staticText(context, node.expression, next);
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = staticText(context, node.left, next);
    const right = staticText(context, node.right, next);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  if (node.type === "Identifier") {
    const variable = variableOf(context, node);
    if (variable?.references.some((reference) => reference.isWrite() && !reference.init))
      return undefined;
    const definition = variable?.defs[0]?.node;
    if (definition?.type === "VariableDeclarator" && definition.init)
      return staticText(context, definition.init, next);
  }
  return undefined;
}

function propertyKey(context: Context, node: ESTree.MemberExpression): string | undefined {
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  return staticText(context, node.property);
}

function bindingPath(context: Context, pattern: Node, name: string): string[] | undefined {
  if (pattern.type === "Identifier") return pattern.name === name ? [] : undefined;
  if (pattern.type === "AssignmentPattern") return bindingPath(context, pattern.left, name);
  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      if (property.type === "RestElement") {
        const suffix = bindingPath(context, property.argument, name);
        if (suffix) return suffix;
      }
      if (property.type !== "Property") continue;
      const suffix = bindingPath(context, property.value, name);
      if (!suffix) continue;
      const key =
        !property.computed && property.key.type === "Identifier"
          ? property.key.name
          : staticText(context, property.key);
      if (key !== undefined) return [key, ...suffix];
    }
  }
  return undefined;
}

export function destructuredOrigins(context: Context, pattern: Node, inputs: Origin[]): Origin[] {
  if (pattern.type === "AssignmentPattern")
    return destructuredOrigins(context, pattern.left, inputs);
  if (pattern.type !== "ObjectPattern") return inputs;
  return pattern.properties.flatMap((property) => {
    if (property.type === "RestElement") return inputs;
    const key =
      !property.computed && property.key.type === "Identifier"
        ? property.key.name
        : staticText(context, property.key);
    return key === undefined
      ? []
      : destructuredOrigins(
          context,
          property.value,
          inputs.map((origin) => [...origin, key]),
        );
  });
}

export function origins(context: Context, node: Node, seen = new Set<Node>()): Origin[] {
  if (seen.has(node)) return [];
  const next = new Set([...seen, node]);
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "ChainExpression"
  )
    return origins(context, node.expression, next);
  if (node.type === "AwaitExpression") return origins(context, node.argument, next);
  if (node.type === "MetaProperty" && node.meta.name === "import" && node.property.name === "meta")
    return [["import.meta"]];
  if (node.type === "MemberExpression") {
    const key = propertyKey(context, node);
    return key === undefined
      ? []
      : origins(context, node.object, next).map((origin) => [...origin, key]);
  }
  if (node.type === "ImportExpression") {
    const source = staticText(context, node.source);
    return source === undefined ? [] : [[source]];
  }
  if (node.type === "CallExpression") {
    const targets = origins(context, node.callee, next);
    if (
      targets.some(
        (origin) =>
          origin.join(".") === "node:module.createRequire" ||
          origin.join(".") === "module.createRequire",
      )
    )
      return [["require"]];
    if (targets.some((origin) => origin.length === 1 && origin[0] === "require")) {
      const first = node.arguments[0];
      const source = first ? staticText(context, first) : undefined;
      return source === undefined ? [] : [[source]];
    }
  }
  if (node.type !== "Identifier") return [];
  const variable = variableOf(context, node);
  if (!variable || variable.defs.length === 0) {
    if (["vi", "vitest"].includes(node.name)) return [["vitest", "vi"]];
    if (node.name === "jest") return [["@jest/globals", "jest"]];
    if (node.name === "process") return [["node:process"]];
    if (["globalThis", "global", "window"].includes(node.name)) return [["global"]];
    if (node.name === "require") return [["require"]];
    return [];
  }
  const definitions = variable.defs.flatMap((definition): Origin[] => {
    const declaration = definition.node;
    if (
      ["ImportSpecifier", "ImportDefaultSpecifier", "ImportNamespaceSpecifier"].includes(
        declaration.type,
      ) &&
      declaration.parent?.type === "ImportDeclaration"
    ) {
      const source = declaration.parent.source.value;
      if (declaration.type === "ImportSpecifier") {
        const name =
          declaration.imported.type === "Identifier"
            ? declaration.imported.name
            : declaration.imported.value;
        return [[source, name]];
      }
      return [[source]];
    }
    if (declaration.type === "VariableDeclarator" && declaration.init) {
      const suffix = bindingPath(context, declaration.id, node.name);
      return suffix
        ? origins(context, declaration.init, next).map((origin) => [...origin, ...suffix])
        : [];
    }
    return [];
  });
  const assignments = variable.references.flatMap((reference) => {
    if (!reference.isWrite() || reference.init || !reference.writeExpr) return [];
    return origins(context, reference.writeExpr, next);
  });
  return [...definitions, ...assignments];
}

type D1Kind = "database" | "session" | "statement" | "orm";
type D1Reference = { path: string[]; kind: D1Kind; method?: string };
const d1Methods: Record<D1Kind, ReadonlySet<string>> = {
  database: new Set(["prepare", "batch", "exec", "withSession", "dump"]),
  session: new Set(["prepare", "batch"]),
  statement: new Set(["bind", "first", "run", "all", "raw"]),
  orm: new Set(),
};

function d1Property(references: D1Reference[], key: string): D1Reference[] {
  return references.flatMap((reference): D1Reference[] => {
    if (reference.path.length)
      return reference.path[0] === key ? [{ ...reference, path: reference.path.slice(1) }] : [];
    if (reference.method) return ["bind", "call", "apply"].includes(key) ? [reference] : [];
    if (reference.kind === "orm" && key === "$client") return [{ path: [], kind: "database" }];
    return d1Methods[reference.kind].has(key) ? [{ ...reference, method: key }] : [];
  });
}

function d1NamedType(source: string, name: string): D1Reference[] {
  if (
    source === "@cloudflare/workers-types" ||
    source.startsWith("@cloudflare/workers-types/") ||
    source === "global"
  ) {
    if (name === "D1Database") return [{ path: [], kind: "database" }];
    if (name === "D1DatabaseSession") return [{ path: [], kind: "session" }];
    if (name === "D1PreparedStatement") return [{ path: [], kind: "statement" }];
  }
  if (source === "@template/db" && name === "DatabaseBinding")
    return [{ path: [], kind: "database" }];
  if (source === "@template/db" && name === "Database") return [{ path: [], kind: "orm" }];
  if (source === "@template/config" && name === "AppConfig")
    return [{ path: ["DB"], kind: "database" }];
  if (source === "@template/runtime" && name === "AppRequestContext")
    return [{ path: ["runtime", "config", "DB"], kind: "database" }];
  return [];
}

function localType(node: Node, name: string): Node | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type !== "Program" && parent.type !== "BlockStatement") continue;
    for (const statement of parent.body) {
      const declaration =
        statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
      if (
        (declaration?.type === "TSTypeAliasDeclaration" ||
          declaration?.type === "TSInterfaceDeclaration") &&
        declaration.id.name === name
      )
        return declaration;
    }
  }
  return undefined;
}

function d1Type(context: Context, node: Node, seen: Set<Node>): D1Reference[] {
  if (seen.has(node)) return [];
  const next = new Set([...seen, node]);
  if (
    node.type === "TSTypeAnnotation" ||
    node.type === "TSTypeAliasDeclaration" ||
    node.type === "TSParenthesizedType" ||
    node.type === "TSTypeOperator"
  )
    return d1Type(context, node.typeAnnotation, next);
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType")
    return node.types.flatMap((type) => d1Type(context, type, next));
  if (node.type === "TSTypeReference") return d1Type(context, node.typeName, next);
  if (node.type === "TSQualifiedName")
    return origins(context, node.left).flatMap((origin) =>
      d1NamedType(origin[0] ?? "", node.right.name),
    );
  if (node.type === "TSImportType" && node.qualifier?.type === "Identifier")
    return d1NamedType(node.source.value, node.qualifier.name);
  if (node.type === "Identifier") {
    const declaration = localType(node, node.name);
    if (declaration) return d1Type(context, declaration, next);
    const imported = origins(context, node);
    if (imported.length)
      return imported.flatMap(([source, name]) => d1NamedType(source ?? "", name ?? ""));
    return variableOf(context, node) ? [] : d1NamedType("global", node.name);
  }
  if (node.type === "TSIndexedAccessType" && node.indexType.type === "TSLiteralType") {
    const key = staticText(context, node.indexType.literal);
    return key === undefined ? [] : d1Property(d1Type(context, node.objectType, next), key);
  }
  if (node.type === "TSInterfaceDeclaration")
    return [
      ...d1Type(context, node.body, next),
      ...node.extends.flatMap((base) => d1Type(context, base.expression, next)),
    ];
  if (node.type === "TSTypeLiteral" || node.type === "TSInterfaceBody") {
    const members = node.type === "TSTypeLiteral" ? node.members : node.body;
    return members.flatMap((member): D1Reference[] => {
      if (member.type !== "TSPropertySignature" || !member.typeAnnotation) return [];
      const key =
        !member.computed && member.key.type === "Identifier"
          ? member.key.name
          : staticText(context, member.key);
      return key === undefined
        ? []
        : d1Type(context, member.typeAnnotation, next).map((reference) => ({
            ...reference,
            path: [key, ...reference.path],
          }));
    });
  }
  return [];
}

function annotatedBinding(
  context: Context,
  pattern: Node,
  name: string,
  seen: Set<Node>,
): D1Reference[] {
  if (pattern.type === "AssignmentPattern")
    return annotatedBinding(context, pattern.left, name, seen);
  if (pattern.type === "TSParameterProperty")
    return annotatedBinding(context, pattern.parameter, name, seen);
  const path = bindingPath(context, pattern, name);
  if (!path || !("typeAnnotation" in pattern) || !pattern.typeAnnotation) return [];
  return path.reduce(d1Property, d1Type(context, pattern.typeAnnotation, seen));
}

function d1References(context: Context, node: Node, seen = new Set<Node>()): D1Reference[] {
  if (seen.has(node)) return [];
  const next = new Set([...seen, node]);
  if (node.type === "TSTypeAnnotation") return d1Type(context, node, seen);
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSSatisfiesExpression"
  )
    return [
      ...d1References(context, node.expression, next),
      ...d1Type(context, node.typeAnnotation, next),
    ];
  if (node.type === "ChainExpression" || node.type === "TSNonNullExpression")
    return d1References(context, node.expression, next);
  if (node.type === "AwaitExpression") return d1References(context, node.argument, next);
  if (node.type === "ConditionalExpression")
    return [
      ...d1References(context, node.consequent, next),
      ...d1References(context, node.alternate, next),
    ];
  if (node.type === "LogicalExpression")
    return [...d1References(context, node.left, next), ...d1References(context, node.right, next)];
  if (node.type === "MemberExpression") {
    const key = propertyKey(context, node);
    const receiver = d1References(context, node.object, next);
    if (key === undefined)
      return receiver
        .filter((reference) => reference.path.length === 0 && reference.kind !== "orm")
        .map((reference) => ({ ...reference, method: "dynamic" }));
    return d1Property(receiver, key);
  }
  if (node.type === "ObjectExpression")
    return node.properties.flatMap((property): D1Reference[] => {
      if (property.type === "SpreadElement") return d1References(context, property.argument, next);
      const key =
        !property.computed && property.key.type === "Identifier"
          ? property.key.name
          : staticText(context, property.key);
      return key === undefined
        ? []
        : d1References(context, property.value, next).map((reference) => ({
            ...reference,
            path: [key, ...reference.path],
          }));
    });
  if (node.type === "CallExpression") {
    const targets = origins(context, node.callee, next);
    const known: D1Reference[] = targets.flatMap(([source, name]): D1Reference[] => {
      if (source === "@template/config" && name === "readConfig")
        return [{ path: ["DB"], kind: "database" }];
      if (source === "@template/db" && name === "createDb") return [{ path: [], kind: "orm" }];
      return [];
    });
    return [
      ...known,
      ...d1References(context, node.callee, next).flatMap((reference): D1Reference[] => {
        if (node.callee.type === "MemberExpression" && propertyKey(context, node.callee) === "bind")
          return [reference];
        if (reference.method === "prepare" || reference.method === "bind")
          return [{ path: [], kind: "statement" }];
        if (reference.method === "withSession") return [{ path: [], kind: "session" }];
        return [];
      }),
    ];
  }
  if (node.type !== "Identifier") return [];
  const variable = variableOf(context, node);
  if (!variable) return [];
  const imported = origins(context, node).flatMap(([source, member]): D1Reference[] => {
    if (source !== "cloudflare:workers") return [];
    if (member === "env") return [{ path: ["DB"], kind: "database" }];
    return member === undefined ? [{ path: ["env", "DB"], kind: "database" }] : [];
  });
  const definitions = variable.defs.flatMap((definition): D1Reference[] => {
    const declaration = definition.node;
    if (declaration.type === "VariableDeclarator") {
      const path = bindingPath(context, declaration.id, node.name);
      return [
        ...annotatedBinding(context, declaration.id, node.name, next),
        ...(path && declaration.init
          ? path.reduce(d1Property, d1References(context, declaration.init, next))
          : []),
      ];
    }
    if (definition.type === "Parameter" && "params" in declaration)
      return declaration.params.flatMap((parameter) =>
        annotatedBinding(context, parameter, node.name, next),
      );
    return [];
  });
  const assignments = variable.references.flatMap((reference): D1Reference[] => {
    if (!reference.isWrite() || reference.init || !reference.writeExpr) return [];
    let pattern: Node = reference.identifier;
    while (pattern.parent && pattern.parent.type !== "AssignmentExpression")
      pattern = pattern.parent;
    const path = bindingPath(context, pattern, node.name);
    return path ? path.reduce(d1Property, d1References(context, reference.writeExpr, next)) : [];
  });
  return [...imported, ...definitions, ...assignments];
}

export function isD1Operation(context: Context, node: Node): boolean {
  return d1References(context, node).some(
    (reference) => reference.path.length === 0 && reference.method !== undefined,
  );
}

export function destructuresD1Operation(context: Context, pattern: Node, input: Node): boolean {
  const visit = (node: Node, references: D1Reference[]): boolean => {
    if (node.type === "AssignmentPattern") return visit(node.left, references);
    if (node.type !== "ObjectPattern")
      return references.some(
        (reference) => reference.path.length === 0 && reference.method !== undefined,
      );
    return node.properties.some((property) => {
      if (property.type === "RestElement") return false;
      const key =
        !property.computed && property.key.type === "Identifier"
          ? property.key.name
          : staticText(context, property.key);
      return key !== undefined && visit(property.value, d1Property(references, key));
    });
  };
  return visit(pattern, d1References(context, input));
}
