import { createDontReviewItRule } from "../../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const REPLACING_METHODS = new Set(["replace", "replaceAll"]);

const CHARACTER_REFERENCE = /^&(?:[a-z]+|#\d+|#x[\da-f]+);$/iu;

const isCharacterReferenceReplacement = (
  node: ESTree.Node | null | undefined,
): node is ESTree.CallExpression => {
  if (node?.type !== "CallExpression") return false;
  const { callee } = node;
  if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return false;
  if (!REPLACING_METHODS.has(callee.property.name)) return false;
  const replacement = node.arguments[1];
  return (
    replacement?.type === "Literal" &&
    typeof replacement.value === "string" &&
    CHARACTER_REFERENCE.test(replacement.value)
  );
};

const replacedReceiver = (node: ESTree.CallExpression): ESTree.Node | null =>
  node.callee.type === "MemberExpression" ? node.callee.object : null;

export const noHandWrittenHtmlEscape = createDontReviewItRule({
  name: "no-hand-written-html-escape--use-es-toolkit-escape",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow escaping HTML by chaining `replace` or `replaceAll` calls that turn special characters into character references, so every escape covers the full set `es-toolkit`'s `escape` covers",
      relatedGuidelines: [".claude/skills/reviews/references/ownership-and-duplication.md"],
    },
    messages: {
      handWrittenEscape:
        "HTML special characters must not be escaped by chaining `replace` or `replaceAll` into character references. Call `escape` from `es-toolkit`, which replaces all five characters including the single quote.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (!isCharacterReferenceReplacement(node)) return;
        if (!isCharacterReferenceReplacement(replacedReceiver(node))) return;
        const { parent } = node;
        if (parent.type === "MemberExpression" && isCharacterReferenceReplacement(parent.parent)) {
          return;
        }
        inspection.report({ node, messageId: "handWrittenEscape" });
      },
    };
  },
});
