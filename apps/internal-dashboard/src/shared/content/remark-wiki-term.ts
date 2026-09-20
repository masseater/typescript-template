import { SKIP, visitParents } from "unist-util-visit-parents";

import type { PhrasingContent, Root, Text } from "mdast";
import type { MdxJsxAttribute, MdxJsxTextElement } from "mdast-util-mdx-jsx";

const wikiTermPattern = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;

const skippedAncestors = new Set([
  "code",
  "inlineCode",
  "link",
  "linkReference",
  "mdxJsxFlowElement",
  "mdxJsxTextElement",
]);

function termAttribute(name: string, value: string): MdxJsxAttribute {
  return { name, type: "mdxJsxAttribute", value };
}

function termElement(term: string, label: string | undefined): MdxJsxTextElement {
  const attributes = [termAttribute("term", term.trim())];
  const trimmedLabel = label?.trim();
  if (trimmedLabel !== undefined && trimmedLabel.length > 0 && trimmedLabel !== term.trim()) {
    attributes.push(termAttribute("label", trimmedLabel));
  }
  return {
    attributes,
    children: [],
    data: { _mdxExplicitJsx: true },
    name: "TermLink",
    type: "mdxJsxTextElement",
  };
}

function splitText(value: string): PhrasingContent[] {
  const parts: PhrasingContent[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(wikiTermPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: value.slice(lastIndex, index) });
    }
    const term = match[1] ?? "";
    const label = match[2];
    if (term.trim().length > 0) {
      parts.push(termElement(term, label));
    } else {
      parts.push({ type: "text", value: match[0] ?? "" });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex === 0) {
    return [];
  }
  if (lastIndex < value.length) {
    parts.push({ type: "text", value: value.slice(lastIndex) });
  }
  return parts;
}

function remarkWikiTerm() {
  return (tree: Root): void => {
    visitParents(tree, "text", (node: Text, ancestors) => {
      if (ancestors.some((ancestor) => skippedAncestors.has(ancestor.type))) {
        return SKIP;
      }
      const parent = ancestors.at(-1);
      if (
        parent === undefined ||
        !("children" in parent) ||
        !Array.isArray((parent as { children?: unknown }).children)
      ) {
        return SKIP;
      }
      const parts = splitText(node.value);
      if (parts.length === 0) {
        return SKIP;
      }
      const children = (parent as { children: PhrasingContent[] }).children;
      const index = children.indexOf(node);
      if (index < 0) {
        return SKIP;
      }
      children.splice(index, 1, ...parts);
      return SKIP;
    });
  };
}

export { remarkWikiTerm, splitText, wikiTermPattern };
