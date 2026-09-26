import { createDontReviewItRule } from "../../../../create-rule.ts";
import { environmentKeyVisitor } from "../../lib/environment-keys.ts";

import type { Visitor } from "@oxlint/plugins";

const ENVIRONMENT_NAME_KEY = /(?:^|_)(?:ENV|ENVIRONMENT|STAGE)$|^(?:DEV|MODE|PROD)$/u;

export const noEnvironmentNameBranch = createDontReviewItRule({
  name: "no-environment-name-branch--list-the-values-per-stage",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading or declaring an environment key that names the environment itself (`NODE_ENV`, `APP_ENV`, `STAGE`, `import.meta.env.MODE`), so the differences between environments live in one table of values per stage instead of in comparisons spread through the code",
      relatedGuidelines: [
        ".claude/skills/reviews/references/never-add-an-environment-variable-for-a-known-value.md",
      ],
    },
    messages: {
      environmentName:
        "An environment key that names the environment, such as `{{name}}`, must not be read or declared. Write what differs between environments as one table of values per stage, select the row where the process is configured, and hand the selected values down.",
    },
    schema: [],
  },
  create(inspection): Visitor {
    return environmentKeyVisitor(({ name, node }) => {
      if (name === null || !ENVIRONMENT_NAME_KEY.test(name)) return;
      inspection.report({ node, messageId: "environmentName", data: { name } });
    });
  },
});
