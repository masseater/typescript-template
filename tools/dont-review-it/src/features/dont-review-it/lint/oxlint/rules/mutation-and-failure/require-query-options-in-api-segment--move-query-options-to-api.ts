import { createDontReviewItRule } from "../../../../create-rule.ts";
import { path } from "../../../../platform/path.ts";
import { segmentsOf } from "../../lib/path-segments.ts";
import { staticMemberOf } from "../../lib/static-member.ts";

import type { ESTree } from "@oxlint/plugins";

const QUERY_FACTORY_NAMES = new Set(["infiniteQueryOptions", "mutationOptions", "queryOptions"]);

const isQueryFactoryCallee = (callee: ESTree.Expression): boolean => {
  if (callee.type === "Identifier") {
    return QUERY_FACTORY_NAMES.has(callee.name);
  }
  const member = staticMemberOf(callee);
  return member !== null && QUERY_FACTORY_NAMES.has(member.name);
};

const sitsInApiSegment = (filename: string): boolean =>
  segmentsOf({ path: filename, separator: path.sep }).includes("api");

export const requireQueryOptionsInApiSegment = createDontReviewItRule({
  name: "require-query-options-in-api-segment--move-query-options-to-api",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require queryOptions, infiniteQueryOptions, and mutationOptions factories to live in an FSD api segment",
      relatedGuidelines: [
        ".claude/skills/reviews/references/build-ui-on-libs-ui-and-keep-server-state-in-query.md",
      ],
    },
    messages: {
      queryOptionsOutsideApi:
        "`queryOptions`, `infiniteQueryOptions`, and `mutationOptions` must not be declared outside an FSD `api` segment. Move the factory into a module under an `api` directory.",
    },
    schema: [],
  },
  create(inspection) {
    if (sitsInApiSegment(inspection.filename)) {
      return {};
    }
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (!isQueryFactoryCallee(node.callee)) {
          return;
        }
        inspection.report({ node, messageId: "queryOptionsOutsideApi" });
      },
    };
  },
});
