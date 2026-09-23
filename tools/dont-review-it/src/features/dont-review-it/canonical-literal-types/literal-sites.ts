import * as ts from "typescript-6";

import type { CanonicalValue } from "../lint/oxlint/lib/canonical-values/fingerprint.ts";

export type CanonicalLiteralSite = {
  readonly node: ts.Expression;
  readonly spelling: CanonicalValue;
};

const scalarSpelling = (node: ts.Node): CanonicalValue | undefined => {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return node.kind === ts.SyntaxKind.NullKeyword ? null : undefined;
};

const negatedSpelling = (node: ts.PrefixUnaryExpression): CanonicalValue | undefined => {
  if (node.operator !== ts.SyntaxKind.MinusToken) return undefined;
  const operand = scalarSpelling(node.operand);
  return typeof operand === "number" ? -operand : undefined;
};

const spellingOf = (node: ts.Node): CanonicalValue | undefined => {
  if (ts.isPrefixUnaryExpression(node)) return negatedSpelling(node);
  return scalarSpelling(node);
};

const isSignedOperand = (node: ts.Node): boolean =>
  ts.isPrefixUnaryExpression(node.parent) &&
  (node.parent.operator === ts.SyntaxKind.MinusToken ||
    node.parent.operator === ts.SyntaxKind.PlusToken);

const NAMED_MEMBER_PARENTS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.EnumMember,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.SetAccessor,
]);

const isNamePosition = (node: ts.Node): boolean => {
  const parent = node.parent as ts.Node & { readonly name?: ts.Node };
  return NAMED_MEMBER_PARENTS.has(parent.kind) && parent.name === node;
};

const MODULE_SYNTAX_PARENTS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExternalModuleReference,
  ts.SyntaxKind.ImportAttribute,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.ExportSpecifier,
  ts.SyntaxKind.JSDocImportTag,
  ts.SyntaxKind.ModuleDeclaration,
]);

const isValuePosition = (node: ts.Node): boolean =>
  !ts.isLiteralTypeNode(node.parent) &&
  !MODULE_SYNTAX_PARENTS.has(node.parent.kind) &&
  !isNamePosition(node) &&
  !isSignedOperand(node);

const childrenOf = (node: ts.Node, sourceFile: ts.SourceFile): readonly ts.Node[] =>
  node
    .getChildren(sourceFile)
    .flatMap((child) =>
      child.kind === ts.SyntaxKind.SyntaxList ? child.getChildren(sourceFile) : [child],
    );

const sitesUnder = (input: {
  readonly isSkipped: (node: ts.Node) => boolean;
  readonly node: ts.Node;
  readonly sourceFile: ts.SourceFile;
}): readonly CanonicalLiteralSite[] => {
  const nested = childrenOf(input.node, input.sourceFile).flatMap((child) =>
    sitesUnder({ ...input, node: child }),
  );
  const spelling = spellingOf(input.node);
  if (spelling === undefined || !isValuePosition(input.node) || input.isSkipped(input.node)) {
    return nested;
  }
  return [...nested, { node: input.node as ts.Expression, spelling }];
};

export const canonicalLiteralSitesIn = (input: {
  readonly skippedRanges: readonly { readonly start: number; readonly end: number }[];
  readonly sourceFile: ts.SourceFile;
}): readonly CanonicalLiteralSite[] => {
  const isSkipped = (node: ts.Node): boolean =>
    input.skippedRanges.some(
      (range) => range.start <= node.getStart(input.sourceFile) && node.getEnd() <= range.end,
    );
  return childrenOf(input.sourceFile, input.sourceFile).flatMap((node) =>
    sitesUnder({ isSkipped, node, sourceFile: input.sourceFile }),
  );
};
