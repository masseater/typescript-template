import { repositoryRoot } from "@repo/config/repository-root";
import { Effect } from "effect";
import { createLinter } from "textlint";

import { textlintDescriptor } from "./text-lint-descriptor.ts";

const linter = createLinter({
  cwd: repositoryRoot,
  descriptor: await Effect.runPromise(textlintDescriptor),
});

const reportedRuleIds = (markdown: string): Effect.Effect<readonly string[]> =>
  Effect.map(
    Effect.promise(() => linter.lintText(markdown, "probe.md")),
    (result) => result.messages.map((message) => message.ruleId).toSorted(),
  );

export { reportedRuleIds };
