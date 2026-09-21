import { ACCOUNT_STATE, REPORT_STATUS, REPORT_SUBJECT, ROLE } from "@repo/config";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { Clock, Effect, Schema } from "effect";

import { boardPost } from "./board-schema.ts";
import { query } from "./database.ts";
import { user } from "./identity-schema.ts";
import { follow } from "./member-social-schema.ts";
import {
  CONVERSATION_KIND,
  conversation,
  conversationParticipant,
  directMessage,
} from "./messaging-schema.ts";
import { memberBlock, memberReport } from "./trust-schema.ts";

import type { ReportReason, ReportSubject } from "@repo/config";

class TrustSubjectNotFound extends Schema.TaggedError<TrustSubjectNotFound>()(
  "TrustSubjectNotFound",
  {},
) {}

class TrustTargetUnavailable extends Schema.TaggedError<TrustTargetUnavailable>()(
  "TrustTargetUnavailable",
  {},
) {}

const clockDate = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));
const activeMember = and(
  eq(user.role, ROLE.member),
  eq(user.emailVerified, true),
  eq(user.accountState, ACCOUNT_STATE.active),
);

function blockBetween(viewerId: string, memberId: SQL): SQL {
  return sql`exists (select 1 from ${memberBlock} where (${memberBlock.blockerId} = ${viewerId} and ${memberBlock.blockedId} = ${memberId}) or (${memberBlock.blockedId} = ${viewerId} and ${memberBlock.blockerId} = ${memberId}))`;
}

const blockHides = (viewerId: string): SQL => blockBetween(viewerId, sql`${user.id}`);

const viewerBlockedTarget = (viewerId: string): SQL =>
  sql`exists (select 1 from ${memberBlock} where ${memberBlock.blockerId} = ${viewerId} and ${memberBlock.blockedId} = ${user.id})`;

const pairBlocked = Effect.fn("pairBlocked")(function* pairBlocked(
  leftId: string,
  rightId: string,
) {
  const [row] = yield* query((database) =>
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
  return row !== undefined;
});

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
  const [target] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, blockedId), eq(user.role, ROLE.member)))
      .limit(1),
  );
  if (target === undefined) {
    return yield* new TrustTargetUnavailable();
  }
  const now = yield* clockDate;
  yield* query((database) =>
    database
      .insert(memberBlock)
      .values({ blockedId, blockerId, createdAt: now })
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

interface ReportSnapshot {
  readonly body: string;
  readonly kind: ReportSubject;
  readonly targetMemberId: string | null;
}

const messageSnapshot = Effect.fn("messageSnapshot")(function* messageSnapshot(
  reporterId: string,
  messageId: string,
  kind: typeof REPORT_SUBJECT.message | typeof REPORT_SUBJECT.groupMessage,
) {
  const conversationKind =
    kind === REPORT_SUBJECT.groupMessage ? CONVERSATION_KIND.group : CONVERSATION_KIND.direct;
  const [row] = yield* query((database) =>
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
  if (row === undefined || row.senderId === reporterId) {
    return yield* new TrustSubjectNotFound();
  }
  if (row.senderId !== null && (yield* pairBlocked(reporterId, row.senderId))) {
    return yield* new TrustSubjectNotFound();
  }
  return {
    body: row.body,
    kind,
    targetMemberId: row.senderId,
  } satisfies ReportSnapshot;
});

const boardSnapshot = Effect.fn("boardSnapshot")(function* boardSnapshot(
  reporterId: string,
  postId: string,
) {
  const [row] = yield* query((database) =>
    database
      .select({ authorId: boardPost.authorId, body: boardPost.body })
      .from(boardPost)
      .where(eq(boardPost.id, postId))
      .limit(1),
  );
  if (row === undefined || row.authorId === reporterId) {
    return yield* new TrustSubjectNotFound();
  }
  if (row.authorId !== null && (yield* pairBlocked(reporterId, row.authorId))) {
    return yield* new TrustSubjectNotFound();
  }
  return {
    body: row.body,
    kind: REPORT_SUBJECT.boardPost,
    targetMemberId: row.authorId,
  } satisfies ReportSnapshot;
});

const fileReport = Effect.fn("fileReport")(function* fileReport(
  reporterId: string,
  subject: { readonly id: string; readonly kind: ReportSubject },
  reason: ReportReason,
) {
  yield* requireActiveMember(reporterId);
  const snapshot =
    subject.kind === REPORT_SUBJECT.boardPost
      ? yield* boardSnapshot(reporterId, subject.id)
      : yield* messageSnapshot(reporterId, subject.id, subject.kind);
  const now = yield* clockDate;
  const id = crypto.randomUUID();
  const inserted = yield* query((database) =>
    database
      .insert(memberReport)
      .values({
        body: snapshot.body,
        createdAt: now,
        id,
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
  const filed = inserted[0];
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
