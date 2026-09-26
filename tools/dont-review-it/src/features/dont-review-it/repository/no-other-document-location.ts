import type { TxtCodeNode, TxtLinkNode, TxtNode } from "@textlint/ast-node-types";
import type { TextlintRuleModule } from "@textlint/types";

const documentPath = /\.md(?:#[^\s`]*)?$/u;

const locationPhrase =
  /^\s*(?:にある|にあります|に置く|に置きます|に置いてある|に置いてあります|に書いてある|に書いてあります|にまとめてある|にまとめてあります|を参照|を見よ|を見ること)/u;

const followingText = (node: TxtNode): string | undefined => {
  const siblings = node.parent?.children ?? [];
  const index = siblings.findIndex((sibling) => sibling === node);
  const following = siblings[index + 1];
  return following?.type === "Str" ? following.raw : undefined;
};

const message = (document: string): string =>
  `「\`${document}\` にある」のように別の文書の置き場所を述べない。その文書が命じる内容をこの文に書くか、文ごと消す。`;

const noOtherDocumentLocation: TextlintRuleModule = (context) => {
  const { Syntax, RuleError, report } = context;
  const check = (node: TxtNode, document: string): void => {
    if (!documentPath.test(document)) {
      return;
    }
    const following = followingText(node);
    if (following === undefined || !locationPhrase.test(following)) {
      return;
    }
    report(node, new RuleError(message(document)));
  };
  return {
    [Syntax.Code](node: TxtCodeNode): void {
      check(node, node.value);
    },
    [Syntax.Link](node: TxtLinkNode): void {
      check(node, node.url);
    },
  };
};

export { noOtherDocumentLocation };
