import { Schema } from "effect";

const trustedAssociations: ReadonlySet<string> = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const canNotNowLimit = 3;

export const Issue = Schema.Struct({
  author_association: Schema.String,
  body: Schema.NullOr(Schema.String),
  number: Schema.Int,
  pull_request: Schema.optionalKey(Schema.Unknown),
  title: Schema.String,
});

export const Comment = Schema.Struct({
  author_association: Schema.String,
  body: Schema.NullOr(Schema.String),
  user: Schema.NullOr(Schema.Struct({ login: Schema.String })),
});

export const Pull = Schema.Struct({
  head: Schema.Struct({
    ref: Schema.String,
    repo: Schema.NullOr(Schema.Struct({ full_name: Schema.String })),
  }),
});

export type IssueRecord = typeof Issue.Type;
export type CommentRecord = typeof Comment.Type;
export type PullRecord = typeof Pull.Type;

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
