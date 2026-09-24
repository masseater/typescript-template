import { createDontReviewItRule } from "../../../../create-rule.ts";
import { environmentKeyVisitor } from "../../lib/environment-keys.ts";

import type { Visitor } from "@oxlint/plugins";

const TEST_ONLY_KEY = /^(?:DUMMY|FAKE|MOCK|SKIP|STUB|TEST)_/u;

export const noTestOnlyEnvironmentKey = createDontReviewItRule({
  name: "no-test-only-environment-key--use-real-dependencies-and-http-doubles",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow environment keys that exist only to change behaviour under test (`MOCK_*`, `SKIP_*`, `FAKE_*`, `STUB_*`, `DUMMY_*`, `TEST_*`), so the code under test runs the same path it runs in production",
      relatedGuidelines: [".claude/skills/reviews/references/minimal-environment-variables.md"],
    },
    messages: {
      testOnlyKey:
        "An environment key such as `{{name}}` must not change behaviour only for tests. Use the real dependency in the test and replace only external HTTP at the network boundary.",
    },
    schema: [],
  },
  create(inspection): Visitor {
    return environmentKeyVisitor(({ name, node }) => {
      if (name === null || !TEST_ONLY_KEY.test(name)) return;
      inspection.report({ node, messageId: "testOnlyKey", data: { name } });
    });
  },
});
