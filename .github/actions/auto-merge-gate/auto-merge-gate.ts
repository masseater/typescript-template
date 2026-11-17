import { readFileSync } from "node:fs";

import { EXIT_FAILURE, env, field } from "../shared/runner.ts";

const event: unknown = JSON.parse(readFileSync(env("GITHUB_EVENT_PATH"), "utf8"));
if (field(field(event, "pull_request"), "auto_merge") !== null) {
  process.exit();
}
if (field(field(event, "repository"), "private") === true) {
  console.log("Private repositories on the Free plan cannot turn auto-merge on");
  process.exit();
}
console.log(
  "::error::Turn on auto-merge (gh pr merge --auto --squash) so the update-branches queue merges this pull request",
);
process.exit(EXIT_FAILURE);
