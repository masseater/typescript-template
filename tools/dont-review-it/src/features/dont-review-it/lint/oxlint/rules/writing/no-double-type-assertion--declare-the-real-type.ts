import { createDontReviewItRule } from "../../../../create-rule.ts";
import { isTypeAssertion } from "../../lib/loose-type-claims.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";

import type { ESTree } from "@oxlint/plugins";

const TEST_FIXTURE_SUFFIXES: readonly string[] = ["-test-fixture.ts", "-test-fixture.tsx"];

export const noDoubleTypeAssertion = createDontReviewItRule({
  name: "no-double-type-assertion--declare-the-real-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow asserting the type of an expression that is already the result of a type assertion, so no value arrives at its declared type through a route the type checker was told to stop checking",
      relatedGuidelines: [".claude/skills/reviews/references/io-boundaries-and-types.md"],
    },
    messages: {
      neverAssertionInSpec:
        "A spec or a test fixture must not assert a value to `never`. `never` is assignable to every type, so the value reaches the parameter it is handed to without being compared with the type that parameter declares. Build a value of the declared type instead, annotating it with that type so the type checker names every field the double is missing.",
      stackedTypeAssertion:
        "A type assertion must not be applied to an expression that is already a type assertion. Declare the type the value really has: annotate the place the value comes from, narrow it with a guard that inspects the value, or parse it into the target type and let the parse fail on input that does not match.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const inTestCode =
      isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options)) ||
      isSpecFile(inspection.filename, TEST_FIXTURE_SUFFIXES);
    const reportWhenStacked = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      if (isTypeAssertion(node.expression)) {
        inspection.report({ node, messageId: "stackedTypeAssertion" });
        return;
      }
      if (inTestCode && node.typeAnnotation.type === "TSNeverKeyword") {
        inspection.report({ node, messageId: "neverAssertionInSpec" });
      }
    };

    return {
      TSAsExpression: reportWhenStacked,
      TSTypeAssertion: reportWhenStacked,
    };
  },
});
