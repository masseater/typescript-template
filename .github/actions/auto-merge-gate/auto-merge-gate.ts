import { readFileSync } from "node:fs";

import { EXIT_FAILURE, env, field } from "../shared/runner.ts";

const event: unknown = JSON.parse(readFileSync(env("GITHUB_EVENT_PATH"), "utf8"));
const pullRequest = field(event, "pull_request");
const allowAutoMerge = field(field(event, "repository"), "allow_auto_merge");
console.log(
  `auto_merge: ${JSON.stringify(field(pullRequest, "auto_merge"))}, allow_auto_merge: ${String(allowAutoMerge)}`,
);
if (field(pullRequest, "auto_merge") !== null || allowAutoMerge === false) {
  process.exit();
}
console.log(
  "::error::Turn on auto-merge (gh pr merge --auto --squash) so the update-branches queue merges this pull request",
);
process.exit(EXIT_FAILURE);
