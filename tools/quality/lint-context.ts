import type { Context, ESTree, Scope, Visitor } from "vite-plus/lint/plugins";

type DeepReadonly<Type> = unknown extends Type
  ? Type
  : Type extends (...parameters: readonly never[]) => unknown
    ? Type
    : { readonly [Key in keyof Type]: DeepReadonly<Type[Key]> };
type LintContext = Readonly<
  Pick<Context, "filename" | "report"> & {
    sourceCode: Readonly<Pick<Context["sourceCode"], "getDeclaredVariables" | "getScope">>;
  }
>;
type Node = DeepReadonly<ESTree.Node>;
type NodeOf<Type extends Node["type"]> = Extract<Node, { type: Type }>;

function filename(context: LintContext): string {
  return context.filename.replaceAll("\\", "/");
}

function scopeOf(context: LintContext, node: Node): Scope {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return context.sourceCode.getScope(node as ESTree.Node);
}

function importVisitor(checkSource: (node: Node) => void): Visitor {
  return {
    ExportAllDeclaration(node: Node): void {
      if (node.type === "ExportAllDeclaration") {
        checkSource(node.source);
      }
    },
    ExportNamedDeclaration(node: Node): void {
      if (node.type === "ExportNamedDeclaration" && node.source) {
        checkSource(node.source);
      }
    },
    ImportDeclaration(node: Node): void {
      if (node.type === "ImportDeclaration") {
        checkSource(node.source);
      }
    },
    ImportExpression(node: Node): void {
      if (node.type === "ImportExpression") {
        checkSource(node.source);
      }
    },
    TSExternalModuleReference(node: Node): void {
      if (node.type === "TSExternalModuleReference") {
        checkSource(node.expression);
      }
    },
    TSImportType(node: Node): void {
      if (node.type === "TSImportType") {
        checkSource(node.source);
      }
    },
  };
}

function reportViolation(context: LintContext, node: Node): void {
  context.report({ messageId: "violation", node: { range: [node.range[0], node.range[1]] } });
}

export { filename, importVisitor, reportViolation, scopeOf };
export type { DeepReadonly, LintContext, Node, NodeOf };
