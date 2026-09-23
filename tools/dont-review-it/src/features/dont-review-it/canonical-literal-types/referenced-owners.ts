import { relative } from "node:path";

import * as ts from "typescript-6";

import { resolveTypeScriptSymbol } from "../lint/oxlint/lib/canonical-values/typescript-symbol.ts";
import { toPosixPath } from "../lint/oxlint/lib/posix-path.ts";
import { isDependencySource } from "./contextual-origin.ts";

import type { CanonicalValuesEntry } from "../lint/oxlint/lib/canonical-values/catalog.ts";

export type OwnerReferenceLookup = {
  readonly checker: ts.TypeChecker;
  readonly owners: readonly CanonicalValuesEntry[];
  readonly program: ts.Program;
  readonly repositoryRoot: string;
};

const annotatedTypeNodes = (declaration: ts.Declaration): readonly ts.TypeNode[] => {
  if (ts.isTypeAliasDeclaration(declaration)) return [declaration.type];
  const annotated = (declaration as { readonly type?: ts.Node }).type;
  return annotated !== undefined && ts.isTypeNode(annotated) ? [annotated] : [];
};

const ownersDeclaredBy = (
  lookup: OwnerReferenceLookup,
  declaration: ts.Declaration,
): readonly CanonicalValuesEntry[] => {
  if (!ts.isVariableDeclaration(declaration) || !ts.isIdentifier(declaration.name)) return [];
  const declarationPath = toPosixPath(
    relative(lookup.repositoryRoot, declaration.getSourceFile().fileName),
  );
  const binding = declaration.name.text;
  return lookup.owners.filter(
    (owner) => owner.declarationPath === declarationPath && owner.binding === binding,
  );
};

const repositoryDeclarationsOf = (
  lookup: OwnerReferenceLookup,
  symbol: ts.Symbol | undefined,
): readonly ts.Declaration[] =>
  symbol === undefined
    ? []
    : (resolveTypeScriptSymbol(lookup.checker, symbol).getDeclarations() ?? []).filter(
        (declaration) =>
          !isDependencySource({ program: lookup.program, sourceFile: declaration.getSourceFile() }),
      );

const ownersUnderTypeNode = (
  lookup: OwnerReferenceLookup,
  node: ts.Node,
  visited: Set<ts.Declaration>,
): readonly CanonicalValuesEntry[] => {
  const nested = node.getChildren().flatMap((child) => ownersUnderTypeNode(lookup, child, visited));
  if (ts.isTypeQueryNode(node)) {
    const queried = repositoryDeclarationsOf(
      lookup,
      lookup.checker.getSymbolAtLocation(node.exprName),
    );
    return [...nested, ...queried.flatMap((declaration) => ownersDeclaredBy(lookup, declaration))];
  }
  if (!ts.isTypeReferenceNode(node)) return nested;
  const referenced = repositoryDeclarationsOf(
    lookup,
    lookup.checker.getSymbolAtLocation(node.typeName),
  );
  return [
    ...nested,
    ...referenced.flatMap((declaration) => ownersUnderDeclaration(lookup, declaration, visited)),
  ];
};

const ownersUnderDeclaration = (
  lookup: OwnerReferenceLookup,
  declaration: ts.Declaration,
  visited: Set<ts.Declaration>,
): readonly CanonicalValuesEntry[] => {
  if (visited.has(declaration)) return [];
  visited.add(declaration);
  return annotatedTypeNodes(declaration).flatMap((typeNode) =>
    ownersUnderTypeNode(lookup, typeNode, visited),
  );
};

export const ownersReferencedByTypeNode = (
  lookup: OwnerReferenceLookup,
  typeNode: ts.TypeNode,
): readonly CanonicalValuesEntry[] => [
  ...new Set(ownersUnderTypeNode(lookup, typeNode, new Set())),
];

export const ownersReferencedBySymbol = (
  lookup: OwnerReferenceLookup,
  holder: ts.Symbol | undefined,
): readonly CanonicalValuesEntry[] => {
  const visited = new Set<ts.Declaration>();
  return [
    ...new Set(
      repositoryDeclarationsOf(lookup, holder).flatMap((declaration) =>
        ownersUnderDeclaration(lookup, declaration, visited),
      ),
    ),
  ];
};
