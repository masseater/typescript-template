import { stringField } from "../shared/runner.ts";

const PREFIX = "verify-durations-";

export const DURATIONS_PREFIX = PREFIX;

export const NO_DURATIONS = `${PREFIX}none`;

interface CacheEntry {
  readonly key: string;
  readonly ref: string;
  readonly createdAt: number;
}

interface Choice {
  readonly listed: unknown;
  readonly refs: ReadonlySet<string>;
  readonly startedAt: number;
}

const entryOf = (value: unknown): CacheEntry => ({
  key: stringField(value, "key"),
  ref: stringField(value, "ref"),
  createdAt: Date.parse(stringField(value, "created_at")),
});

const entriesOf = (listed: unknown): readonly CacheEntry[] => {
  if (!Array.isArray(listed)) {
    return [];
  }
  return listed.map((value) => entryOf(value));
};

const newerFirst = (left: CacheEntry, right: CacheEntry): number =>
  right.createdAt - left.createdAt || left.key.localeCompare(right.key, "en");

export const chosenKey = ({ listed, refs, startedAt }: Choice): string => {
  const [chosen] = entriesOf(listed)
    .filter((entry) => refs.has(entry.ref) && entry.createdAt < startedAt)
    .toSorted(newerFirst);
  if (chosen === undefined) {
    return NO_DURATIONS;
  }
  return chosen.key;
};
