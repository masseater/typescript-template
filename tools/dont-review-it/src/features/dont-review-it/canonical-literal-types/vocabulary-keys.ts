import * as ts from "typescript-6";

import { canonicalValueKey } from "../lint/oxlint/lib/canonical-values/catalog.ts";
import { readTextFile, type ScannedFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";

import type {
  CanonicalValuesCatalog,
  CanonicalValuesEntry,
} from "../lint/oxlint/lib/canonical-values/catalog.ts";
import type { CanonicalValue } from "../lint/oxlint/lib/canonical-values/fingerprint.ts";
import type { RepositoryProblem } from "../repository-checks/index.ts";

const PREFIX_TERMINATORS = ["_", "-", "/"] as const;

const commonPrefixOf = (spellings: readonly string[]): string => {
  const [first = "", ...rest] = spellings;
  const shared = rest.reduce((prefix, spelling) => {
    const length = [...prefix].findIndex((character, index) => spelling[index] !== character);
    return length === -1 ? prefix : prefix.slice(0, length);
  }, first);
  const cut = Math.max(...PREFIX_TERMINATORS.map((terminator) => shared.lastIndexOf(terminator)));
  return shared.slice(0, cut + 1);
};

const normalizedSpelling = (spelling: string): string =>
  spelling.toLowerCase().replaceAll(/[_-]/gu, "");

const expectedKeysOf = (values: readonly CanonicalValue[]): readonly (string | null)[] => {
  const spellings = values.filter((value): value is string => typeof value === "string");
  const prefix = spellings.length === values.length ? commonPrefixOf(spellings) : "";
  return values.map((value) =>
    typeof value === "string" ? normalizedSpelling(value.slice(prefix.length)) : null,
  );
};

const unwrappedExpression = (expression: ts.Expression): ts.Expression =>
  ts.isAsExpression(expression) ||
  ts.isSatisfiesExpression(expression) ||
  ts.isParenthesizedExpression(expression)
    ? unwrappedExpression(expression.expression)
    : expression;

type IndexedMember = {
  readonly binding: string;
  readonly index: number;
};

const indexedMemberOf = (expression: ts.Expression): IndexedMember | null => {
  if (!ts.isElementAccessExpression(expression)) return null;
  if (!ts.isIdentifier(expression.expression)) return null;
  const argument = expression.argumentExpression;
  if (!ts.isNumericLiteral(argument)) return null;
  return { binding: expression.expression.text, index: Number(argument.text) };
};

const propertyNameOf = (property: ts.PropertyAssignment): string | null =>
  ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;

const ownerFor = (input: {
  readonly binding: string;
  readonly owners: readonly CanonicalValuesEntry[];
  readonly relativePath: string;
}): CanonicalValuesEntry | undefined => {
  const named = input.owners.filter((owner) => owner.binding === input.binding);
  return named.find((owner) => owner.declarationPath === input.relativePath) ?? named[0];
};

const problemsInObject = (input: {
  readonly object: ts.ObjectLiteralExpression;
  readonly owners: readonly CanonicalValuesEntry[];
  readonly relativePath: string;
  readonly sourceFile: ts.SourceFile;
}): readonly RepositoryProblem[] =>
  input.object.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) return [];
    const member = indexedMemberOf(property.initializer);
    const key = propertyNameOf(property);
    if (member === null || key === null) return [];
    const owner = ownerFor({ ...input, binding: member.binding });
    if (owner === undefined) return [];
    const expected = expectedKeysOf(owner.values)[member.index];
    if (expected === null || expected === undefined || normalizedSpelling(key) === expected) {
      return [];
    }
    const line =
      input.sourceFile.getLineAndCharacterOfPosition(property.getStart(input.sourceFile)).line + 1;
    return [
      {
        file: input.relativePath,
        line,
        message: `A key naming a value of a declared vocabulary must spell that value. \`${key}\` names ${JSON.stringify(owner.values[member.index])} of ${owner.conceptId}; rename the key to that spelling.`,
      },
    ];
  });

const objectsIn = (sourceFile: ts.SourceFile): readonly ts.ObjectLiteralExpression[] =>
  sourceFile.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap((declaration) => {
          if (declaration.initializer === undefined) return [];
          const initializer = unwrappedExpression(declaration.initializer);
          return ts.isObjectLiteralExpression(initializer) ? [initializer] : [];
        })
      : [],
  );

const keysAnotherVocabulary = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly object: ts.ObjectLiteralExpression;
}): boolean =>
  input.object.properties.every((property) => {
    const key = ts.isPropertyAssignment(property) ? propertyNameOf(property) : null;
    return key !== null && input.catalog.entriesByValue.has(canonicalValueKey(key));
  });

export const vocabularyKeyProblems = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly declarationSources: readonly ScannedFile[];
}): readonly RepositoryProblem[] => {
  const bindings = [...new Set(input.catalog.entries.map((owner) => owner.binding))];
  return input.declarationSources.flatMap((file) => {
    const sourceText = readTextFile(file.absolutePath);
    if (sourceText === null) return [];
    if (!bindings.some((binding) => sourceText.includes(`${binding}[`))) return [];
    const sourceFile = ts.createSourceFile(file.absolutePath, sourceText, ts.ScriptTarget.Latest);
    return objectsIn(sourceFile).flatMap((object) =>
      keysAnotherVocabulary({ catalog: input.catalog, object })
        ? []
        : problemsInObject({
        object,
        owners: input.catalog.entries,
        relativePath: file.relativePath,
            sourceFile,
          }),
    );
  });
};
