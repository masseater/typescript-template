import * as ts from "typescript-6";

import { canonicalValueKey } from "../lint/oxlint/lib/canonical-values/catalog.ts";
import { isDependencySource } from "./contextual-origin.ts";
import { spellingOf } from "./literal-sites.ts";
import { ownersReferencedByTypeNode, type OwnerReferenceLookup } from "./referenced-owners.ts";
import { finiteMembersOf } from "./vocabulary-members.ts";

import type { CanonicalValuesEntry } from "../lint/oxlint/lib/canonical-values/catalog.ts";

export type VocabularyExtension = {
  readonly addedValues: readonly (string | number)[];
  readonly node: ts.UnionTypeNode;
  readonly owners: readonly CanonicalValuesEntry[];
};

const addedValueOf = (member: ts.TypeNode): string | number | undefined => {
  if (!ts.isLiteralTypeNode(member)) return undefined;
  const spelling = spellingOf(member.literal);
  return typeof spelling === "string" || typeof spelling === "number" ? spelling : undefined;
};

const NARROWING_UTILITIES: ReadonlySet<string> = new Set(["Exclude", "Extract", "Omit"]);

const narrowsAnotherType = (lookup: OwnerReferenceLookup, union: ts.UnionTypeNode): boolean => {
  const { parent } = union;
  if (!ts.isTypeReferenceNode(parent) || parent.typeArguments?.[1] !== union) return false;
  const utility = lookup.checker.getSymbolAtLocation(parent.typeName);
  const declarations = utility?.getDeclarations() ?? [];
  return (
    utility !== undefined &&
    NARROWING_UTILITIES.has(utility.getName()) &&
    declarations.length > 0 &&
    declarations.every((declaration) =>
      isDependencySource({ program: lookup.program, sourceFile: declaration.getSourceFile() }),
    )
  );
};

const isFiniteMember = (lookup: OwnerReferenceLookup, member: ts.TypeNode): boolean =>
  finiteMembersOf({
    checker: lookup.checker,
    type: lookup.checker.getTypeFromTypeNode(member),
  }) !== null;

const extensionOf = (
  lookup: OwnerReferenceLookup,
  union: ts.UnionTypeNode,
): VocabularyExtension | undefined => {
  const literalValues = union.types.flatMap((member) => {
    const value = addedValueOf(member);
    return value === undefined ? [] : [value];
  });
  if (literalValues.length === 0 || narrowsAnotherType(lookup, union)) return undefined;
  const owners = [
    ...new Set(
      union.types
        .filter((member) => addedValueOf(member) === undefined && isFiniteMember(lookup, member))
        .flatMap((member) => ownersReferencedByTypeNode(lookup, member)),
    ),
  ];
  const held = new Set(owners.flatMap((owner) => owner.values.map(canonicalValueKey)));
  const addedValues = literalValues.filter((value) => !held.has(canonicalValueKey(value)));
  return owners.length === 0 || addedValues.length === 0
    ? undefined
    : { addedValues, node: union, owners };
};

export const vocabularyExtensionsIn = (
  lookup: OwnerReferenceLookup & {
    readonly isSkipped: (node: ts.Node) => boolean;
    readonly sourceFile: ts.SourceFile;
  },
): readonly VocabularyExtension[] => {
  const extensionsUnder = (node: ts.Node): readonly VocabularyExtension[] => {
    const nested = node.getChildren(lookup.sourceFile).flatMap(extensionsUnder);
    if (!ts.isUnionTypeNode(node) || lookup.isSkipped(node)) return nested;
    const extension = extensionOf(lookup, node);
    return extension === undefined ? nested : [extension, ...nested];
  };
  return extensionsUnder(lookup.sourceFile);
};
