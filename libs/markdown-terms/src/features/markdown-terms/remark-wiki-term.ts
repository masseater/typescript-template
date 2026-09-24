import { findAndReplace } from "mdast-util-find-and-replace";

import type { Root } from "mdast";
import type { MdxJsxAttribute, MdxJsxTextElement } from "mdast-util-mdx-jsx";

declare module "mdast-util-mdx-jsx" {
  interface MdxJsxTextElementData {
    _mdxExplicitJsx?: boolean | null | undefined;
  }
}

type SyntaxNode = Readonly<{ type: string }>;

const isRoot = (node: SyntaxNode): node is Root => node.type === "root";

const termLinkPattern = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/gu;

const termAttribute = (attributeName: string, attributeValue: string): MdxJsxAttribute => ({
  name: attributeName,
  type: "mdxJsxAttribute",
  value: attributeValue,
});

const termLink = (
  ...[, writtenTerm = "", writtenLabel]: readonly [string, string?, string?]
): MdxJsxTextElement | false => {
  const term = writtenTerm.trim();
  const shownLabel = writtenLabel?.trim() ?? "";
  const labelAttributes =
    shownLabel === "" || shownLabel === term ? [] : [termAttribute("label", shownLabel)];
  return term === ""
    ? false
    : {
        attributes: [termAttribute("term", term), ...labelAttributes],
        children: [],
        data: { _mdxExplicitJsx: true },
        name: "TermLink",
        type: "mdxJsxTextElement",
      };
};

const remarkWikiTerm =
  () =>
  (tree: SyntaxNode): void => {
    if (isRoot(tree)) {
      findAndReplace(tree, [termLinkPattern, termLink], {
        ignore: ["link", "linkReference", "mdxJsxFlowElement", "mdxJsxTextElement"],
      });
    }
  };

const wikiTermSyntax = (term: string, shownLabel: string | undefined): string =>
  shownLabel === undefined || shownLabel === term ? `[[${term}]]` : `[[${term}|${shownLabel}]]`;

export { remarkWikiTerm, wikiTermSyntax };
