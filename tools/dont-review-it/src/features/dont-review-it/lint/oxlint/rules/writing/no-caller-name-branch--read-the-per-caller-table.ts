import { createDontReviewItRule } from "../../../../create-rule.ts";
import { importedNameOf } from "../../lib/imported-binding.ts";
import { isRecord } from "../../lib/record-value.ts";

import type { ESTree, Options, Visitor } from "@oxlint/plugins";

type CallerVocabulary = {
  readonly source: string;
  readonly name: string;
};

const EQUALITY_OPERATORS: ReadonlySet<string> = new Set(["===", "!==", "==", "!="]);

const isCallerVocabulary = (held: unknown): held is CallerVocabulary =>
  isRecord(held) && typeof held.source === "string" && typeof held.name === "string";

const callersFrom = (ruleOptions: Readonly<Options>): readonly CallerVocabulary[] => {
  const [first] = ruleOptions;
  const declared = isRecord(first) ? first.callers : undefined;
  return Array.isArray(declared) ? declared.filter(isCallerVocabulary) : [];
};

const namesCaller = (
  expression: ESTree.Expression | ESTree.PrivateIdentifier,
  callerNames: ReadonlySet<string>,
): boolean =>
  expression.type === "MemberExpression" &&
  expression.object.type === "Identifier" &&
  callerNames.has(expression.object.name);

export const noCallerNameBranch = createDontReviewItRule({
  name: "no-caller-name-branch--read-the-per-caller-table",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow shared code comparing its input against one named caller from a configured vocabulary, so what differs per caller lives in one table keyed by the vocabulary instead of in branches repeated wherever the difference is needed",
      relatedGuidelines: [
        ".claude/skills/reviews/references/forbid-excessive-code-sharing.md",
        ".claude/skills/reviews/references/ownership-and-duplication.md",
      ],
    },
    messages: {
      callerBranch:
        "Shared code must not branch on one named caller. `{{caller}}` is compared here, so the behaviour for that caller hides in this branch. Put the difference in a table keyed by every value of the vocabulary and read the row for the caller.",
    },
    schema: [
      {
        type: "object",
        properties: {
          callers: {
            type: "array",
            items: {
              type: "object",
              properties: { source: { type: "string" }, name: { type: "string" } },
              required: ["source", "name"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection): Visitor {
    const callers = callersFrom(inspection.options);
    if (callers.length === 0) return {};
    const callerNames = new Set<string>();
    const reportCaller = (node: ESTree.Expression): void => {
      inspection.report({
        node,
        messageId: "callerBranch",
        data: { caller: inspection.sourceCode.getText(node) },
      });
    };
    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const named = importedNameOf(specifier);
          if (callers.some((caller) => caller.source === node.source.value && caller.name === named)) {
            callerNames.add(specifier.local.name);
          }
        }
      },
      BinaryExpression(node: ESTree.BinaryExpression) {
        if (!EQUALITY_OPERATORS.has(node.operator)) return;
        for (const operand of [node.left, node.right]) {
          if (namesCaller(operand, callerNames)) reportCaller(operand as ESTree.Expression);
        }
      },
      SwitchCase(node: ESTree.SwitchCase) {
        if (node.test !== null && namesCaller(node.test, callerNames)) reportCaller(node.test);
      },
    };
  },
});
