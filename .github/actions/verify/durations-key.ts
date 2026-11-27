import { appendTo, env, field, ghJson, optionalEnv, stringField } from "../shared/runner.ts";
import { DURATIONS_PREFIX, chosenKey } from "./durations.ts";

const token = env("GH_TOKEN");
const repository = env("GITHUB_REPOSITORY");
const attempt = ghJson(
  [
    `repos/${repository}/actions/runs/${env("GITHUB_RUN_ID")}/attempts/${env("GITHUB_RUN_ATTEMPT")}`,
  ],
  token,
);
const listed = field(
  ghJson(
    [
      "-X",
      "GET",
      `repos/${repository}/actions/caches`,
      "-f",
      `key=${DURATIONS_PREFIX}`,
      "-f",
      "sort=created_at",
      "-f",
      "direction=desc",
      "-f",
      "per_page=100",
    ],
    token,
  ),
  "actions_caches",
);
const base = optionalEnv("GITHUB_BASE_REF") ?? env("DEFAULT_BRANCH");
const key = chosenKey({
  listed,
  refs: new Set([env("GITHUB_REF"), `refs/heads/${base}`]),
  startedAt: Date.parse(stringField(attempt, "run_started_at")),
});
console.log(
  `every shard of this attempt splits by ${key}, the newest durations saved before it started`,
);
appendTo("GITHUB_OUTPUT", { key });
