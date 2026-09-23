import { dirname, join, resolve } from "node:path";

import { groupBy } from "es-toolkit";
import * as ts from "typescript-6";

import { measureStage } from "../lint-rule-authoring/index.ts";
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
import { formatValues } from "../lint/oxlint/lib/canonical-values/verify-format.ts";
import {
  contextualOriginSymbol,
  declaredHolderSymbol,
  declaredOutsideRepository,
} from "./contextual-origin.ts";
import { canonicalLiteralSitesIn, type CanonicalLiteralSite } from "./literal-sites.ts";
import { ownersReferencedBySymbol } from "./referenced-owners.ts";
import { vocabularyExtensionsIn } from "./vocabulary-extensions.ts";
import {
  finiteMembersOf,
  membersOfValues,
  sameVocabulary,
  sharesVocabulary,
} from "./vocabulary-members.ts";

import type { RepositoryProblem, ScannedProblems } from "../repository-checks/index.ts";

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

const typeAliasNamesIn = (declarationPath: string, sourceText: string): readonly string[] =>
  ts
    .createSourceFile(declarationPath, sourceText, ts.ScriptTarget.Latest)
    .statements.flatMap((statement) =>
      ts.isTypeAliasDeclaration(statement) ? [statement.name.text] : [],
    );

const ownerDerivedNames = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly repositoryRoot: string;
}): ReadonlySet<string> =>
  new Set(
    input.catalog.entries.flatMap((owner) => {
      const ownerText = readTextFile(join(input.repositoryRoot, owner.declarationPath));
      if (ownerText === null) {
        throw new Error(
          `The catalog owner ${owner.conceptId} is not readable at ${owner.declarationPath}.`,
        );
      }
      return [owner.binding, ...typeAliasNamesIn(owner.declarationPath, ownerText)];
    }),
  );

const carriesNeedle = (input: {
  readonly derivedNames: ReadonlySet<string>;
  readonly file: ScannedFile;
  readonly needles: readonly string[];
}): boolean => {
  const sourceText = readTextFile(input.file.absolutePath);
  if (sourceText === null) return false;
  return (
    input.needles.some((needle) => sourceText.includes(needle)) ||
    (sourceText.includes("|") &&
      [...input.derivedNames].some((derivedName) => sourceText.includes(derivedName)))
  );
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

const EQUALITY_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const comparedOperand = (node: ts.Expression): ts.Expression | undefined => {
  const { parent } = node;
  if (ts.isBinaryExpression(parent) && EQUALITY_OPERATORS.has(parent.operatorToken.kind)) {
    return parent.left === node ? parent.right : parent.left;
  }
  return ts.isCaseClause(parent) && parent.expression === node
    ? parent.parent.parent.expression
    : undefined;
};

type LiteralContext = {
  readonly holders: readonly (ts.Symbol | undefined)[];
  readonly origin: ts.Symbol | undefined;
  readonly type: ts.Type;
};

const literalContext = (input: {
  readonly checker: ts.TypeChecker;
  readonly node: ts.Expression;
}): LiteralContext | undefined => {
  const operand = comparedOperand(input.node);
  if (operand !== undefined) {
    const type = input.checker.getTypeAtLocation(operand);
    const origin = type.aliasSymbol ?? type.getSymbol();
    return { holders: [input.checker.getSymbolAtLocation(operand), origin], origin, type };
  }
  const type = input.checker.getContextualType(input.node);
  if (type === undefined) return undefined;
  const origin = contextualOriginSymbol({
    checker: input.checker,
    contextualType: type,
    node: input.node,
  });
  return { holders: [declaredHolderSymbol(input), origin], origin, type };
};

const derivesFromOwners = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly checker: ts.TypeChecker;
  readonly owners: readonly CanonicalValuesEntry[];
  readonly program: ts.Program;
  readonly repositoryRoot: string;
  readonly site: CanonicalLiteralSite;
}): readonly CanonicalValuesEntry[] => {
  const context = literalContext({ checker: input.checker, node: input.site.node });
  if (context === undefined) return input.owners;
  const referenced = context.holders
    .map((holder) =>
      ownersReferencedBySymbol({ ...input, owners: input.catalog.entries }, holder).filter(
        (owner) => input.owners.includes(owner),
      ),
    )
    .find((holderOwners) => holderOwners.length > 0);
  if (referenced !== undefined) return referenced;
  const finiteMembers = finiteMembersOf({ checker: input.checker, type: context.type });
  if (finiteMembers === null) return input.owners;
  const { origin } = context;
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
  const skippedRanges = ownedRangesIn({ owners: declaredHere, sourceFile: input.sourceFile });
  const sites = canonicalLiteralSitesIn({ skippedRanges, sourceFile: input.sourceFile });
  const extensions = vocabularyExtensionsIn({
    ...input,
    isSkipped: (node) =>
      skippedRanges.some(
        (range) => range.start <= node.getStart(input.sourceFile) && node.getEnd() <= range.end,
      ),
    owners: input.catalog.entries,
  }).map((extension) => ({
    file: input.relativePath,
    line:
      input.sourceFile.getLineAndCharacterOfPosition(extension.node.getStart(input.sourceFile))
        .line + 1,
    message: `Extending a declared vocabulary with values its owner does not hold is forbidden. Add ${formatValues(extension.addedValues)} to the owner, or register the wider set as its own concept: ${conceptSummary(extension.owners)}.`,
  }));
  const literalProblems = sites.flatMap((site) => {
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
  return [...extensions, ...literalProblems];
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
  const candidates = measureStage("canonical-literal-types.prefilter", () => {
    if (needles.length === 0) return [];
    const derivedNames = ownerDerivedNames({ catalog: input.catalog, repositoryRoot });
    return input.declarationSources.filter((file) =>
      carriesNeedle({ derivedNames, file, needles }),
    );
  });
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
