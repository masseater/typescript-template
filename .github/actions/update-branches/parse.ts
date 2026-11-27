import { field } from "../shared/runner.ts";
import { latestChecks } from "./queue.ts";
import type { Check, PullRequest } from "./queue.ts";

const PENDING = "PENDING";
const COMPLETED = "COMPLETED";

const text = (value: unknown, key: string): string => {
  const found = field(value, key);
  if (typeof found === "string") {
    return found;
  }
  return "";
};

const firstText = (value: unknown, keys: readonly string[]): string =>
  keys.map((key) => text(value, key)).find((found) => found !== "") ?? "";

const items = (value: unknown, key: string): readonly unknown[] => {
  const found = field(value, key);
  if (Array.isArray(found)) {
    return found;
  }
  return [];
};

const parseCheck = (entry: unknown): Check => {
  const status = text(entry, "status");
  const at = firstText(entry, ["startedAt", "createdAt"]);
  const name = firstText(entry, ["name", "context"]);
  if (status !== "" && status !== COMPLETED) {
    return { name, result: PENDING, at };
  }
  return { name, result: firstText(entry, ["conclusion", "state"]), at };
};

export const parsePull = (
  value: unknown,
  required: ReadonlySet<string>,
  commits: readonly string[],
): PullRequest => ({
  number: Number(field(value, "number")),
  draft: field(value, "isDraft") === true,
  branch: text(value, "headRefName"),
  head: text(value, "headRefOid"),
  base: text(value, "baseRefName"),
  createdAt: text(value, "createdAt"),
  state: text(value, "mergeStateStatus"),
  bot: field(field(value, "author"), "is_bot") === true,
  commits,
  checks: latestChecks(
    items(value, "statusCheckRollup").map((entry) => parseCheck(entry)),
    required,
  ),
});
