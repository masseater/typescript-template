export interface Check {
  readonly name: string;
  readonly result: string;
  readonly at: string;
}

export interface PullRequest {
  readonly number: number;
  readonly draft: boolean;
  readonly branch: string;
  readonly head: string;
  readonly base: string;
  readonly createdAt: string;
  readonly state: string;
  readonly bot: boolean;
  readonly commits: readonly string[];
  readonly checks: readonly Check[];
}

export interface Ordering {
  readonly defaultBranch: string;
  readonly redMain: boolean;
}

const MERGEABLE: ReadonlySet<string> = new Set(["CLEAN", "UNSTABLE", "HAS_HOOKS"]);
const BROKEN: ReadonlySet<string> = new Set(["ERROR", "FAILURE", "STARTUP_FAILURE", "TIMED_OUT"]);
const PENDING = "PENDING";
const NONE = 0;
const LATER = 1;
const EARLIER = -1;

export const isMergeable = (pull: PullRequest): boolean => MERGEABLE.has(pull.state);

const holdsHead = (pull: PullRequest, other: PullRequest): boolean => {
  if (other.head === pull.head) {
    return other.number < pull.number;
  }
  return pull.commits.includes(other.head);
};

export const parentsOf = (
  pull: PullRequest,
  open: readonly PullRequest[],
): readonly PullRequest[] =>
  open.filter(
    (other) =>
      other.number !== pull.number && (other.branch === pull.base || holdsHead(pull, other)),
  );

const compareQueued = (left: PullRequest, right: PullRequest): number => {
  if (left.createdAt !== right.createdAt) {
    if (left.createdAt < right.createdAt) {
      return EARLIER;
    }
    return LATER;
  }
  return left.number - right.number;
};

export const readyToMerge = (
  open: readonly PullRequest[],
  { defaultBranch, redMain }: Ordering,
): readonly PullRequest[] =>
  open
    .filter(
      (pull) =>
        !pull.draft &&
        pull.base === defaultBranch &&
        isMergeable(pull) &&
        parentsOf(pull, open).length === NONE &&
        !(redMain && pull.bot),
    )
    .toSorted(compareQueued);

export const orphaned = (
  open: readonly PullRequest[],
  defaultBranch: string,
): readonly PullRequest[] =>
  open.filter(
    (pull) => pull.base !== defaultBranch && !open.some((other) => other.branch === pull.base),
  );

export const latestChecks = (
  entries: readonly Check[],
  required: ReadonlySet<string>,
): readonly Check[] => {
  const names = [...new Set(entries.map((entry) => entry.name))].filter((name) =>
    required.has(name),
  );
  return names.flatMap((name) => {
    const mine = entries.filter((entry) => entry.name === name);
    const pending = mine.find((entry) => entry.result === PENDING);
    if (pending !== undefined) {
      return [pending];
    }
    const [latest] = mine.toSorted((left, right) => right.at.localeCompare(left.at));
    if (latest === undefined) {
      return [];
    }
    return [latest];
  });
};

const brokenChecks = (pull: PullRequest): readonly string[] =>
  pull.checks.filter((check) => BROKEN.has(check.result)).map((check) => check.name);

export const problemOf = (pull: PullRequest, defaultBranch: string): string | undefined => {
  if (pull.draft) {
    return undefined;
  }
  if (pull.state === "DIRTY") {
    return `it conflicts with \`${pull.base}\`. GitHub runs no checks on a conflicting pull request, so it cannot move until the conflict is resolved`;
  }
  const broken = brokenChecks(pull);
  if (pull.base === defaultBranch && broken.length > NONE) {
    return `a required check failed: ${broken.map((name) => `\`${name}\``).join(", ")}`;
  }
  return undefined;
};
