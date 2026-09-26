import { importedNameOf } from "./imported-binding.ts";
import { propertyKeyOf } from "./object-literal.ts";
import { isRecord } from "./record-value.ts";

import type { ESTree, Options } from "@oxlint/plugins";

export type ConfigOwner = {
  readonly source: string;
  readonly name: string;
};

export const CONFIG_OWNERS_KEY = "configOwners";

export const CONFIG_OWNERS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { source: { type: "string" }, name: { type: "string" } },
    required: ["source", "name"],
    additionalProperties: false,
  },
} as const;

const isConfigOwner = (held: unknown): held is ConfigOwner =>
  isRecord(held) && typeof held.source === "string" && typeof held.name === "string";

export const configOwnersFrom = (ruleOptions: Readonly<Options>): readonly ConfigOwner[] => {
  const [first] = ruleOptions;
  const declared = isRecord(first) ? first[CONFIG_OWNERS_KEY] : undefined;
  return Array.isArray(declared) ? declared.filter(isConfigOwner) : [];
};

export const ownerNamesIn = (
  program: ESTree.Program,
  owners: readonly ConfigOwner[],
): ReadonlySet<string> =>
  new Set(
    program.body.flatMap((statement) =>
      statement.type === "ImportDeclaration"
        ? statement.specifiers.flatMap((specifier) =>
            specifier.type === "ImportSpecifier" &&
            owners.some(
              (owner) =>
                owner.source === statement.source.value && owner.name === importedNameOf(specifier),
            )
              ? [specifier.local.name]
              : [],
          )
        : [],
    ),
  );

const isOwnerReference = (
  expression: ESTree.Expression,
  ownerNames: ReadonlySet<string>,
): boolean => {
  if (expression.type === "Identifier") return ownerNames.has(expression.name);
  return (
    expression.type === "MemberExpression" &&
    !expression.computed &&
    isOwnerReference(expression.object, ownerNames)
  );
};

export type DeclaredValue =
  | { readonly kind: "absent" }
  | { readonly kind: "owned" }
  | { readonly kind: "unreadable" }
  | {
      readonly kind: "written";
      readonly value: ESTree.Expression;
      readonly property: ESTree.ObjectProperty;
    };

const ABSENT: DeclaredValue = { kind: "absent" };
const OWNED: DeclaredValue = { kind: "owned" };
const UNREADABLE: DeclaredValue = { kind: "unreadable" };

export type OwnedLookup = {
  readonly object: ESTree.ObjectExpression;
  readonly key: string;
  readonly ownerNames: ReadonlySet<string>;
};

export const declaredAt = ({ object, key, ownerNames }: OwnedLookup): DeclaredValue => {
  const decisive = object.properties.findLast(
    (entry) =>
      entry.type === "SpreadElement" || (entry.type === "Property" && propertyKeyOf(entry) === key),
  );
  if (decisive === undefined) return ABSENT;
  if (decisive.type === "SpreadElement") {
    return isOwnerReference(decisive.argument, ownerNames) ? OWNED : UNREADABLE;
  }
  if (isOwnerReference(decisive.value, ownerNames)) return OWNED;
  return { kind: "written", value: decisive.value, property: decisive };
};

export const declaredAtPath = ({
  object,
  path,
  ownerNames,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly path: readonly string[];
  readonly ownerNames: ReadonlySet<string>;
}): DeclaredValue => {
  const [key, ...rest] = path;
  if (key === undefined) return UNREADABLE;
  const declared = declaredAt({ object, key, ownerNames });
  if (rest.length === 0 || declared.kind !== "written") return declared;
  return declared.value.type === "ObjectExpression"
    ? declaredAtPath({ object: declared.value, path: rest, ownerNames })
    : UNREADABLE;
};

export const writtenObjectOf = (declared: DeclaredValue): ESTree.ObjectExpression | null =>
  declared.kind === "written" && declared.value.type === "ObjectExpression" ? declared.value : null;

export const spreadsOwner = (
  array: ESTree.ArrayExpression,
  ownerNames: ReadonlySet<string>,
): boolean =>
  array.elements.some(
    (element) =>
      element?.type === "SpreadElement" && isOwnerReference(element.argument, ownerNames),
  );

export const settlesTrue = (declared: DeclaredValue): boolean =>
  declared.kind === "owned" ||
  (declared.kind === "written" &&
    declared.value.type === "Literal" &&
    declared.value.value === true);
