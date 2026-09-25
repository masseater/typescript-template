import { createDontReviewItRule } from "../../../../create-rule.ts";
import { environmentKeyVisitor } from "../../lib/environment-keys.ts";

import type { Visitor } from "@oxlint/plugins";

const BEHAVIOR_SWITCH_KEY = /_(?:DISABLED|ENABLED|MODE)$|^DEBUG(?:_|$)|^VERBOSE$/u;

export const noBehaviorSwitchEnvironmentKey = createDontReviewItRule({
  name: "no-behavior-switch-environment-key--decide-from-the-value-or-a-feature-flag",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow environment keys named as switches (`*_ENABLED`, `*_DISABLED`, `*_MODE`, `DEBUG`), so behaviour follows from whether the real value is present or from a feature flag instead of from a second key that can disagree with it",
      relatedGuidelines: [
        ".claude/skills/reviews/references/never-add-an-environment-variable-for-a-known-value.md",
      ],
    },
    messages: {
      behaviorSwitch:
        "An environment key such as `{{name}}` must not switch behaviour. Decide from whether the value the behaviour needs is present, move the switch to a feature flag, or write the fixed choice in the code.",
    },
    schema: [],
  },
  create(inspection): Visitor {
    return environmentKeyVisitor(({ name, node }) => {
      if (name === null || !BEHAVIOR_SWITCH_KEY.test(name)) return;
      inspection.report({ node, messageId: "behaviorSwitch", data: { name } });
    });
  },
});
