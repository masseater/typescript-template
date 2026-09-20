import { createDontReviewItRule } from "../../../../create-rule.ts";
import { staticMemberOf } from "../../lib/static-member.ts";

import type { ESTree } from "@oxlint/plugins";

const FETCH_NAME = "fetch";

const isFetchCallee = (callee: ESTree.Expression): boolean => {
  const written = callee;
  if (written.type === "Identifier") {
    return written.name === FETCH_NAME;
  }
  return staticMemberOf(written)?.name === FETCH_NAME;
};

export const noHandRolledServerRead = createDontReviewItRule({
  name: "no-hand-rolled-server-read--use-tanstack-query",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow combining useState with fetch for server data in member and auth UI surfaces after TanStack Query migration",
    },
    messages: {
      handRolledServerRead:
        "Server data in this package must be read through TanStack Query option factories instead of fetch combined with useState.",
    },
    schema: [],
  },
  create(inspection) {
    let importsUseState = false;

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (node.source.value !== "react") {
          return;
        }
        importsUseState = node.specifiers.some(
          (specifier) =>
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.imported.name === "useState",
        );
      },
      CallExpression(node: ESTree.CallExpression) {
        if (!importsUseState || !isFetchCallee(node.callee)) {
          return;
        }
        inspection.report({ node, messageId: "handRolledServerRead" });
      },
    };
  },
});
