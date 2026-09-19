import type { ESTree } from "@oxlint/plugins";

export type LiteralNode =
  | ESTree.BigIntLiteral
  | ESTree.BooleanLiteral
  | ESTree.NullLiteral
  | ESTree.NumericLiteral
  | ESTree.RegExpLiteral
  | ESTree.StringLiteral;
