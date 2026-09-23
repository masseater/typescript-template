import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";

export const IMPORT_META_REFERENCE = "import.meta";

const KEYED_NODE_KINDS: ReadonlySet<string> = new Set([
  "AccessorProperty",
  "MethodDefinition",
  "Property",
  "PropertyDefinition",
  "TSAbstractAccessorProperty",
  "TSAbstractMethodDefinition",
  "TSAbstractPropertyDefinition",
  "TSMethodSignature",
  "TSPropertySignature",
]);

const NAMING_FIELDS_BY_KIND: Readonly<Record<string, readonly string[]>> = {
  BreakStatement: ["label"],
  ContinueStatement: ["label"],
  ImportAttribute: ["key"],
  JSXAttribute: ["name"],
  JSXMemberExpression: ["property"],
  LabeledStatement: ["label"],
  MemberExpression: ["property"],
  TSEnumMember: ["id"],
  TSImportType: ["qualifier"],
  TSQualifiedName: ["right"],
};

const BINDING_FIELDS_BY_KIND: Readonly<Record<string, readonly string[]>> = {
  ArrowFunctionExpression: ["params"],
  CatchClause: ["param"],
  ClassDeclaration: ["id"],
  ClassExpression: ["id"],
  FunctionDeclaration: ["id", "params"],
  FunctionExpression: ["id", "params"],
  TSInterfaceDeclaration: ["id"],
  TSMappedType: ["key"],
  TSTypeAliasDeclaration: ["id"],
  TSTypeParameter: ["name"],
  VariableDeclarator: ["id"],
};

const kindOf = (node: AstFields): string => String(node[NODE_TYPE_FIELD]);

const namingFieldsOf = (node: AstFields): readonly string[] => {
  if (node.computed === true) return [];
  if (KEYED_NODE_KINDS.has(kindOf(node))) return ["key"];
  return NAMING_FIELDS_BY_KIND[kindOf(node)] ?? [];
};

const nestedOf = (syntaxField: unknown): readonly AstFields[] => {
  if (Array.isArray(syntaxField)) return syntaxField.flatMap(nestedOf);
  return isAstFields(syntaxField) ? [syntaxField] : [];
};

const PATTERN_FIELDS_BY_KIND: Readonly<Record<string, readonly string[]>> = {
  ArrayPattern: ["elements"],
  AssignmentPattern: ["left"],
  ObjectPattern: ["properties"],
  Property: ["value"],
  RestElement: ["argument"],
  TSParameterProperty: ["parameter"],
};

const boundNamesIn = (pattern: AstFields): readonly string[] => {
  if (kindOf(pattern) === "Identifier") return [String(pattern.name)];
  return (PATTERN_FIELDS_BY_KIND[kindOf(pattern)] ?? [])
    .flatMap((field) => nestedOf(pattern[field]))
    .flatMap(boundNamesIn);
};

const declaredNamesIn = (node: AstFields): readonly string[] => [
  ...(BINDING_FIELDS_BY_KIND[kindOf(node)] ?? [])
    .flatMap((field) => nestedOf(node[field]))
    .flatMap(boundNamesIn),
  ...Object.values(node).flatMap(nestedOf).flatMap(declaredNamesIn),
];

const LOWERCASE_INITIAL = /^[a-z]/u;

const TYPE_POSITION_FIELDS: ReadonlySet<string> = new Set([
  "implements",
  "returnType",
  "superTypeArguments",
  "typeAnnotation",
  "typeArguments",
  "typeParameters",
]);

const TYPE_DECLARATION_KINDS: ReadonlySet<string> = new Set([
  "TSDeclareFunction",
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
]);

const FILE_RELATIVE_META_PROPERTIES: ReadonlySet<string> = new Set([
  "dirname",
  "filename",
  "glob",
  "resolve",
  "url",
]);

const isImportMeta = (syntaxField: unknown): boolean =>
  isAstFields(syntaxField) &&
  kindOf(syntaxField) === "MetaProperty" &&
  isAstFields(syntaxField.meta) &&
  syntaxField.meta.name === "import";

const readsFileRelativeMeta = (member: AstFields): boolean =>
  member.computed === true ||
  (isAstFields(member.property) && FILE_RELATIVE_META_PROPERTIES.has(String(member.property.name)));

const ownReferenceOf = (node: AstFields): readonly string[] => {
  const kind = kindOf(node);
  if (kind === "MetaProperty") return isImportMeta(node) ? [IMPORT_META_REFERENCE] : [];
  if (kind === "Identifier") return [String(node.name)];
  if (kind === "JSXIdentifier" && !LOWERCASE_INITIAL.test(String(node.name))) {
    return [String(node.name)];
  }
  return [];
};

const referencedNamesIn = (node: AstFields): readonly string[] => {
  const kind = kindOf(node);
  if (TYPE_DECLARATION_KINDS.has(kind)) return [];
  if (kind === "MetaProperty") return ownReferenceOf(node);
  if (kind === "MemberExpression" && isImportMeta(node.object)) {
    return [
      ...(readsFileRelativeMeta(node) ? [IMPORT_META_REFERENCE] : []),
      ...(node.computed === true ? nestedOf(node.property).flatMap(referencedNamesIn) : []),
    ];
  }
  const skippedFields: ReadonlySet<string> = new Set([
    ...namingFieldsOf(node),
    ...TYPE_POSITION_FIELDS,
  ]);
  return [
    ...ownReferenceOf(node),
    ...Object.entries(node)
      .filter(([field]) => !skippedFields.has(field))
      .flatMap(([, nested]) => nestedOf(nested))
      .flatMap(referencedNamesIn),
  ];
};

export const freeReferencesOf = (body: unknown): readonly string[] => {
  const declared: ReadonlySet<string> = new Set(nestedOf(body).flatMap(declaredNamesIn));
  return [
    ...new Set(
      nestedOf(body)
        .flatMap(referencedNamesIn)
        .filter((name) => !declared.has(name)),
    ),
  ].toSorted((left, right) => left.localeCompare(right));
};
