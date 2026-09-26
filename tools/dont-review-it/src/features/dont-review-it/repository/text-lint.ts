#!/usr/bin/env node
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { repositoryRoot } from "@repo/config/repository-root";
import { TextlintRuleSeverityLevelKeys } from "@textlint/kernel";
import { Effect } from "effect";
import { createLinter, loadLinterFormatter } from "textlint";

import { path } from "../platform/path.ts";
import { textlintDescriptor } from "./text-lint-descriptor.ts";

runCli(
  Effect.gen(function* lintText() {
    const descriptor = yield* textlintDescriptor;
    const results = yield* Effect.tryPromise(() =>
      createLinter({
        cwd: repositoryRoot,
        descriptor,
        ignoreFilePath: path.join(repositoryRoot, ".textlintignore"),
      }).lintFiles(["**/*.md"]),
    );
    const formatter = yield* Effect.tryPromise(() =>
      loadLinterFormatter({ color: true, formatterName: "stylish" }),
    );
    yield* Effect.sync(() => process.stdout.write(formatter.format(results)));
    if (
      results.some((result) =>
        result.messages.some((message) => message.severity === TextlintRuleSeverityLevelKeys.error),
      )
    ) {
      yield* markFailed;
    }
  }),
  (cause) => causeRecord("quality.text_lint_failed", { cause }),
);
