const trustedAssociations: ReadonlySet<string> = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const canNotNowLimit = 3;

export type IssueRecord = Readonly<{
  author_association: string;
  body: string | null;
  number: number;
  pull_request?: unknown;
  title: string;
}>;

export type CommentRecord = Readonly<{
  author_association: string;
  body: string | null;
  user: Readonly<{ login: string }> | null;
}>;

export type PullRecord = Readonly<{
  head: Readonly<{ ref: string; repo: Readonly<{ full_name: string }> | null }>;
}>;

const canNotNowHead = (issueNumber: number): string => `can-not-now/issue-${issueNumber}`;

export const pendingIssues = ({
  issues,
  openPulls,
  repository,
}: {
  readonly issues: readonly IssueRecord[];
  readonly openPulls: readonly PullRecord[];
  readonly repository: string;
}): readonly IssueRecord[] => {
  const openHeads = new Set(
    openPulls.flatMap((pull) => (pull.head.repo?.full_name === repository ? [pull.head.ref] : [])),
  );
  return issues
    .filter(
      (issue) =>
        issue.pull_request === undefined &&
        trustedAssociations.has(issue.author_association) &&
        !openHeads.has(canNotNowHead(issue.number)),
    )
    .toSorted((left, right) => left.number - right.number)
    .slice(0, canNotNowLimit);
};

export const trustedComments = (
  comments: readonly CommentRecord[],
): readonly Readonly<{ author: string; body: string }>[] =>
  comments.flatMap((comment) =>
    trustedAssociations.has(comment.author_association) && comment.user !== null
      ? [{ author: comment.user.login, body: comment.body ?? "" }]
      : [],
  );
