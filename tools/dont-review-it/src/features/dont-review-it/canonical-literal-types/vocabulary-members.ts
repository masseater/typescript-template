import * as ts from "typescript-6";

import {
  canonicalValueKey,
  type CanonicalValue,
} from "../lint/oxlint/lib/canonical-values/fingerprint.ts";

export type VocabularyMembers = ReadonlySet<string>;

const ABSENCE_FLAGS = ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void;

const booleanMember = (checker: ts.TypeChecker, constituent: ts.Type): string =>
  canonicalValueKey(checker.typeToString(constituent) === "true");

const literalMember = (checker: ts.TypeChecker, constituent: ts.Type): string | null => {
  if (constituent.isStringLiteral() || constituent.isNumberLiteral()) {
    return canonicalValueKey(constituent.value);
  }
  return (constituent.flags & ts.TypeFlags.BooleanLiteral) === 0
    ? null
    : booleanMember(checker, constituent);
};

export const finiteMembersOf = (input: {
  readonly checker: ts.TypeChecker;
  readonly type: ts.Type;
}): VocabularyMembers | null => {
  const constituents = input.type.isUnion() ? input.type.types : [input.type];
  const present = constituents.filter((constituent) => (constituent.flags & ABSENCE_FLAGS) === 0);
  const members = present.map((constituent) => literalMember(input.checker, constituent));
  if (members.length === 0 || members.some((member) => member === null)) return null;
  return new Set(members as readonly string[]);
};

export const membersOfValues = (ownedValues: readonly CanonicalValue[]): VocabularyMembers =>
  new Set(ownedValues.map(canonicalValueKey));

export const sameVocabulary = (input: {
  readonly context: VocabularyMembers;
  readonly owned: VocabularyMembers;
}): boolean =>
  input.context.size === input.owned.size &&
  [...input.context].every((member) => input.owned.has(member));

export const sharesVocabulary = (input: {
  readonly context: VocabularyMembers;
  readonly owned: VocabularyMembers;
}): boolean =>
  [...input.context].every((member) => input.owned.has(member)) ||
  [...input.owned].every((member) => input.context.has(member));
