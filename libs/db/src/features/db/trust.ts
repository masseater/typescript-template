import {
  ACCOUNT_STATE,
  REPORT_STATUS,
  REPORT_SUBJECT,
  ROLE,
  type ReportReason,
  type ReportSubject,
} from "@repo/config";
import { and, eq, or, sql, type Column, type SQL } from "drizzle-orm";
import { Effect } from "effect";

import { boardPost } from "./board-schema.ts";
import { clockDate } from "./clock-date.ts";
import { query } from "./database.ts";
import { freshId } from "./fresh-id.ts";
import { user } from "./identity-schema.ts";
import { follow } from "./member-social-schema.ts";
import {
  CONVERSATION_KIND,
  conversation,
  conversationParticipant,
  directMessage,
} from "./messaging-schema.ts";
import { memberBlock, memberReport } from "./trust-schema.ts";
import { TrustSubjectNotFound } from "./trust-subject-not-found.ts";
import { TrustTargetUnavailable } from "./trust-target-unavailable.ts";

const blockBetween = (viewerId: string, memberColumn: Column): SQL =>
  sql`exists (select 1 from ${memberBlock} where (${memberBlock.blockerId} = ${viewerId} and ${memberBlock.blockedId} = ${memberColumn}) or (${memberBlock.blockedId} = ${viewerId} and ${memberBlock.blockerId} = ${memberColumn}))`;

const blockHides = (viewerId: string): SQL => blockBetween(viewerId, user.id);

const viewerBlockedTarget = (viewerId: string): SQL =>
  sql`exists (select 1 from ${memberBlock} where ${memberBlock.blockerId} = ${viewerId} and ${memberBlock.blockedId} = ${user.id})`;

const pairBlocked = Effect.fn("pairBlocked")(function* pairBlocked(
  leftId: string,
  rightId: string,
) {
  const [block] = yield* query((database) =>
    database
      .select({ blockerId: memberBlock.blockerId })
      .from(memberBlock)
      .where(
        or(
          and(eq(memberBlock.blockerId, leftId), eq(memberBlock.blockedId, rightId)),
          and(eq(memberBlock.blockerId, rightId), eq(memberBlock.blockedId, leftId)),
        ),
      )
      .limit(1),
  );
  return block !== undefined;
});

const activeMember = and(
  eq(user.role, ROLE.member),
  eq(user.emailVerified, true),
  eq(user.accountState, ACCOUNT_STATE.active),
);

const requireActiveMember = Effect.fn("requireActiveMember")(function* requireActiveMember(
  memberId: string,
) {
  const [member] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, memberId), activeMember))
      .limit(1),
  );
  if (member === undefined) {
    return yield* new TrustTargetUnavailable();
  }
});

const blockMember = Effect.fn("blockMember")(function* blockMember(
  blockerId: string,
  blockedId: string,
) {
  if (blockerId === blockedId) {
    return yield* new TrustTargetUnavailable();
  }
  yield* requireActiveMember(blockerId);
  const [blockedMember] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, blockedId), eq(user.role, ROLE.member)))
      .limit(1),
  );
  if (blockedMember === undefined) {
    return yield* new TrustTargetUnavailable();
  }
  const blockedAt = yield* clockDate;
  yield* query((database) =>
    database
      .insert(memberBlock)
      .values({ blockedId, blockerId, createdAt: blockedAt })
      .onConflictDoNothing(),
  );
  yield* query((database) =>
    database
      .delete(follow)
      .where(
        or(
          and(eq(follow.followerId, blockerId), eq(follow.followeeId, blockedId)),
          and(eq(follow.followerId, blockedId), eq(follow.followeeId, blockerId)),
        ),
      ),
  );
});

const unblockMember = Effect.fn("unblockMember")(function* unblockMember(
  blockerId: string,
  blockedId: string,
) {
  yield* requireActiveMember(blockerId);
  yield* query((database) =>
    database
      .delete(memberBlock)
      .where(and(eq(memberBlock.blockerId, blockerId), eq(memberBlock.blockedId, blockedId))),
  );
});

type ReportSnapshot = Readonly<{
  body: string;
  kind: ReportSubject;
  targetMemberId: string | null;
}>;

const messageSnapshot = Effect.fn("messageSnapshot")(function* messageSnapshot(reported: {
  readonly messageId: string;
  readonly reporterId: string;
  readonly subjectKind: typeof REPORT_SUBJECT.directMessage | typeof REPORT_SUBJECT.groupMessage;
}) {
  const { messageId, reporterId, subjectKind } = reported;
  const conversationKind =
    subjectKind === REPORT_SUBJECT.groupMessage
      ? CONVERSATION_KIND.group
      : CONVERSATION_KIND.direct;
  const [reportedMessage] = yield* query((database) =>
    database
      .select({
        body: directMessage.body,
        senderId: directMessage.senderId,
      })
      .from(directMessage)
      .innerJoin(conversation, eq(conversation.id, directMessage.conversationId))
      .innerJoin(
        conversationParticipant,
        and(
          eq(conversationParticipant.conversationId, directMessage.conversationId),
          eq(conversationParticipant.memberId, reporterId),
        ),
      )
      .where(and(eq(directMessage.id, messageId), eq(conversation.kind, conversationKind)))
      .limit(1),
  );
  if (reportedMessage === undefined || reportedMessage.senderId === reporterId) {
    return yield* new TrustSubjectNotFound();
  }
  if (
    reportedMessage.senderId !== null &&
    (yield* pairBlocked(reporterId, reportedMessage.senderId))
  ) {
    return yield* new TrustSubjectNotFound();
  }
  return {
    body: reportedMessage.body,
    kind: subjectKind,
    targetMemberId: reportedMessage.senderId,
  } satisfies ReportSnapshot;
});

const boardSnapshot = Effect.fn("boardSnapshot")(function* boardSnapshot(
  reporterId: string,
  postId: string,
) {
  const [reportedPost] = yield* query((database) =>
    database
      .select({ authorId: boardPost.authorId, body: boardPost.body })
      .from(boardPost)
      .where(eq(boardPost.id, postId))
      .limit(1),
  );
  if (reportedPost === undefined || reportedPost.authorId === reporterId) {
    return yield* new TrustSubjectNotFound();
  }
  if (reportedPost.authorId !== null && (yield* pairBlocked(reporterId, reportedPost.authorId))) {
    return yield* new TrustSubjectNotFound();
  }
  return {
    body: reportedPost.body,
    kind: REPORT_SUBJECT.boardPost,
    targetMemberId: reportedPost.authorId,
  } satisfies ReportSnapshot;
});

const fileReport = Effect.fn("fileReport")(function* fileReport({
  reason,
  reporterId,
  subject,
}: {
  readonly reason: ReportReason;
  readonly reporterId: string;
  readonly subject: { readonly id: string; readonly kind: ReportSubject };
}) {
  yield* requireActiveMember(reporterId);
  const snapshot =
    subject.kind === REPORT_SUBJECT.boardPost
      ? yield* boardSnapshot(reporterId, subject.id)
      : yield* messageSnapshot({ messageId: subject.id, reporterId, subjectKind: subject.kind });
  const [filedAt, reportId] = yield* Effect.all([clockDate, freshId]);
  const [filed] = yield* query((database) =>
    database
      .insert(memberReport)
      .values({
        body: snapshot.body,
        createdAt: filedAt,
        id: reportId,
        reason,
        reporterId,
        status: REPORT_STATUS.open,
        subjectId: subject.id,
        subjectKind: snapshot.kind,
        targetMemberId: snapshot.targetMemberId,
      })
      .onConflictDoNothing()
      .returning({ id: memberReport.id }),
  );
  if (filed !== undefined) {
    return filed;
  }
  const [existing] = yield* query((database) =>
    database
      .select({ id: memberReport.id })
      .from(memberReport)
      .where(
        and(
          eq(memberReport.reporterId, reporterId),
          eq(memberReport.subjectKind, snapshot.kind),
          eq(memberReport.subjectId, subject.id),
        ),
      )
      .limit(1),
  );
  if (existing === undefined) {
    return yield* new TrustSubjectNotFound();
  }
  return existing;
});

export {
  TrustSubjectNotFound,
  TrustTargetUnavailable,
  blockBetween,
  blockHides,
  blockMember,
  fileReport,
  pairBlocked,
  unblockMember,
  viewerBlockedTarget,
};
