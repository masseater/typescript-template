import { setTimeout as sleep } from "node:timers/promises";

import { ghText, repository } from "./context.ts";
import { parsePull } from "./parse.ts";
import type { PullRequest } from "./queue.ts";

const FIELDS =
  "number,isDraft,headRefName,headRefOid,baseRefName,createdAt,mergeStateStatus,author,statusCheckRollup,commits";
const LIST_LIMIT = "200";
const RETRY_DELAY_MS = 5000;
const NONE = 0;
const ONE = 1;

const listOf = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

export const listOpen = async (
  required: ReadonlySet<string>,
  retries: number,
): Promise<readonly PullRequest[]> => {
  const parsed: unknown = JSON.parse(
    ghText([
      "pr",
      "list",
      "--repo",
      repository,
      "--state",
      "open",
      "--limit",
      LIST_LIMIT,
      "--json",
      FIELDS,
    ]),
  );
  const pulls = listOf(parsed).map((entry) => parsePull(entry, required));
  if (retries > NONE && pulls.some((pull) => pull.state === "UNKNOWN")) {
    await sleep(RETRY_DELAY_MS);
    return listOpen(required, retries - ONE);
  }
  return pulls;
};
