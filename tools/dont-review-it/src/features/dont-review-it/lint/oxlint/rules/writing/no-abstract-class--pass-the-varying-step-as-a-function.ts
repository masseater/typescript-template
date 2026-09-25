import { createDontReviewItRule } from "../../../../create-rule.ts";

export const noAbstractClass = createDontReviewItRule({
  name: "no-abstract-class--pass-the-varying-step-as-a-function",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow declaring an abstract class, so shared behaviour is reached through calls a reader can follow instead of through members a subclass inherits and overrides",
      relatedGuidelines: [".claude/skills/reviews/references/forbid-excessive-code-sharing.md"],
    },
    messages: {
      abstractClass:
        "A class must not be declared `abstract`. Write the shared steps as functions and pass the step that varies to them as a function argument.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      ClassDeclaration(node) {
        if (!node.abstract) return;
        inspection.report({ node, messageId: "abstractClass" });
      },
      ClassExpression(node) {
        if (!node.abstract) return;
        inspection.report({ node, messageId: "abstractClass" });
      },
    };
  },
});
