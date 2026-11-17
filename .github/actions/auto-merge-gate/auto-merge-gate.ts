import { readFileSync } from "node:fs";

import { EXIT_FAILURE, env, field, ghJson } from "../shared/runner.ts";

const event: unknown = JSON.parse(readFileSync(env("GITHUB_EVENT_PATH"), "utf8"));
const pullRequest = field(event, "pull_request");
if (pullRequest === undefined) {
  process.exit();
}
if (field(pullRequest, "auto_merge") !== null) {
  process.exit();
}
const repository = ghJson([`repos/${env("GITHUB_REPOSITORY")}`], env("GH_TOKEN"));
if (field(repository, "allow_auto_merge") !== true) {
  process.exit();
}
console.log(
  "::error::Turn on auto-merge (gh pr merge --auto --squash) so the update-branches queue merges this pull request",
);
process.exit(EXIT_FAILURE);
