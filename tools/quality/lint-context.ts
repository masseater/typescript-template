import type { Context, ESTree, Scope } from "vite-plus/lint/plugins";

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

function scopeOf(context: LintContext, node: Node): Scope {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return context.sourceCode.getScope(node as ESTree.Node);
}

function reportViolation(context: LintContext, node: Node): void {
  context.report({ messageId: "violation", node: { range: [node.range[0], node.range[1]] } });
}

export { reportViolation, scopeOf };
export type { DeepReadonly, LintContext, Node, NodeOf };
