import { dirname, resolve } from "node:path";

import { measureStage } from "@repo/lint-rule-authoring";
import { groupBy } from "es-toolkit";
import * as ts from "typescript-6";

import {
  canonicalValueKey,
  type CanonicalValuesCatalog,
  type CanonicalValuesEntry,
} from "../lint/oxlint/lib/canonical-values/catalog.ts";
import { ownersVisibleFrom } from "../lint/oxlint/lib/canonical-values/consumer-package.ts";
import {
  readTextFile,
  type ScannedFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import {
  canonicalValuesTypeScriptConfigPath,
  createCanonicalValuesTypeScriptProgram,
} from "../lint/oxlint/lib/canonical-values/typescript-program.ts";
import { contextualOriginSymbol, declaredOutsideRepository } from "./contextual-origin.ts";
import { canonicalLiteralSitesIn, type CanonicalLiteralSite } from "./literal-sites.ts";
import {
  finiteMembersOf,
  membersOfValues,
  sameVocabulary,
  sharesVocabulary,
} from "./vocabulary-members.ts";

import type { RepositoryProblem, ScannedProblems } from "@repo/repository-checks";

const QUOTATION_MARKS = ['"', "'", "`"] as const;

const stringNeedlesOf = (spelling: string): readonly string[] =>
  QUOTATION_MARKS.map((quotation) => `${quotation}${spelling}${quotation}`);

const needlesForOwner = (owner: CanonicalValuesEntry): readonly string[] =>
  owner.values.flatMap((spelling) =>
    typeof spelling === "string" ? stringNeedlesOf(spelling) : [String(spelling)],
  );

const searchNeedles = (catalog: CanonicalValuesCatalog): readonly string[] => [
  ...new Set(catalog.entries.flatMap(needlesForOwner)),
];

const carriesNeedle = (input: {
  readonly file: ScannedFile;
  readonly needles: readonly string[];
}): boolean => {
  const sourceText = readTextFile(input.file.absolutePath);
  return sourceText !== null && input.needles.some((needle) => sourceText.includes(needle));
};

const ownedRangesIn = (input: {
  readonly owners: readonly CanonicalValuesEntry[];
  readonly sourceFile: ts.SourceFile;
}): readonly { readonly start: number; readonly end: number }[] => {
  const bindings = new Set(input.owners.map((owner) => owner.binding));
  return input.sourceFile.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) return [];
    const declares = statement.declarationList.declarations.some(
      (declaration) => ts.isIdentifier(declaration.name) && bindings.has(declaration.name.text),
    );
    return declares
      ? [{ start: statement.getStart(input.sourceFile), end: statement.getEnd() }]
      : [];
  });
};

const conceptSummary = (owners: readonly CanonicalValuesEntry[]): string =>
  owners
    .map((owner) => {
      const routes = owner.importRoutes.map((route) => route.specifier).join(", ");
      return routes === ""
        ? `${owner.conceptId} declared in ${owner.declarationPath}`
        : `${owner.conceptId} exported from ${routes}`;
    })
    .toSorted()
    .join("; ");

const derivesFromOwners = (input: {
  readonly checker: ts.TypeChecker;
  readonly owners: readonly CanonicalValuesEntry[];
  readonly program: ts.Program;
  readonly site: CanonicalLiteralSite;
}): readonly CanonicalValuesEntry[] => {
  const contextualType = input.checker.getContextualType(input.site.node);
  if (contextualType === undefined) return input.owners;
  const finiteMembers = finiteMembersOf({ checker: input.checker, type: contextualType });
  if (finiteMembers === null) return input.owners;
  const origin = contextualOriginSymbol({
    checker: input.checker,
    contextualType,
    node: input.site.node,
  });
  if (origin !== undefined) {
    if (declaredOutsideRepository({ holder: origin, program: input.program })) return [];
    return input.owners.filter((owner) =>
      sameVocabulary({ context: finiteMembers, owned: membersOfValues(owner.values) }),
    );
  }
  return input.owners.filter((owner) =>
    sharesVocabulary({ context: finiteMembers, owned: membersOfValues(owner.values) }),
  );
};

const problemsInSourceFile = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
  readonly relativePath: string;
  readonly repositoryRoot: string;
  readonly sourceFile: ts.SourceFile;
}): readonly RepositoryProblem[] => {
  const isVisibleOwner = ownersVisibleFrom({
    filename: input.sourceFile.fileName,
    repositoryRoot: input.repositoryRoot,
  });
  const declaredHere = input.catalog.entries.filter(
    (owner) => owner.declarationPath === input.relativePath,
  );
  const sites = canonicalLiteralSitesIn({
    skippedRanges: ownedRangesIn({ owners: declaredHere, sourceFile: input.sourceFile }),
    sourceFile: input.sourceFile,
  });
  return sites.flatMap((site) => {
    const owners = (
      input.catalog.entriesByValue.get(canonicalValueKey(site.spelling)) ?? []
    ).filter(isVisibleOwner);
    if (owners.length === 0) return [];
    const derived = derivesFromOwners({ ...input, owners, site });
    if (derived.length === 0) return [];
    const position = input.sourceFile.getLineAndCharacterOfPosition(
      site.node.getStart(input.sourceFile),
    );
    return [
      {
        file: input.relativePath,
        line: position.line + 1,
        message: `Writing a value that a declared vocabulary already owns as a literal is forbidden. Replace ${site.node.getText(input.sourceFile)} with the binding its owner publishes: ${conceptSummary(derived)}.`,
      },
    ];
  });
};

const problemsInGroup = (input: {
  readonly candidates: readonly ScannedFile[];
  readonly catalog: CanonicalValuesCatalog;
  readonly repositoryRoot: string;
}): readonly RepositoryProblem[] => {
  const rootNames = input.candidates.map((candidate) => candidate.absolutePath);
  const program = createCanonicalValuesTypeScriptProgram({
    repositoryRoot: input.repositoryRoot,
    rootNames,
    searchDirectory: dirname(rootNames[0] as string),
  });
  const checker = program.getTypeChecker();
  return input.candidates.flatMap((candidate) => {
    const sourceFile = program.getSourceFile(candidate.absolutePath);
    return sourceFile === undefined
      ? []
      : problemsInSourceFile({
          catalog: input.catalog,
          checker,
          program,
          relativePath: candidate.relativePath,
          repositoryRoot: input.repositoryRoot,
          sourceFile,
        });
  });
};

const configKeyFor = (input: {
  readonly candidate: ScannedFile;
  readonly repositoryRoot: string;
}): string =>
  canonicalValuesTypeScriptConfigPath({
    repositoryRoot: input.repositoryRoot,
    searchDirectory: dirname(input.candidate.absolutePath),
  }) ?? input.repositoryRoot;

export const runCanonicalLiteralTypeChecks = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly declarationSources: readonly ScannedFile[];
  readonly repositoryRoot: string;
}): ScannedProblems => {
  const repositoryRoot = resolve(input.repositoryRoot);
  const needles = searchNeedles(input.catalog);
  const candidates = measureStage("canonical-literal-types.prefilter", () =>
    needles.length === 0
      ? []
      : input.declarationSources.filter((file) => carriesNeedle({ file, needles })),
  );
  const candidatesByConfig = Object.values(
    groupBy(candidates, (candidate) => configKeyFor({ candidate, repositoryRoot })),
  );
  return {
    problems: measureStage("canonical-literal-types.analysis", () =>
      candidatesByConfig.flatMap((candidatesInGroup) =>
        problemsInGroup({
          candidates: candidatesInGroup,
          catalog: input.catalog,
          repositoryRoot,
        }),
      ),
    ),
    scanned: input.declarationSources.length,
  };
};
