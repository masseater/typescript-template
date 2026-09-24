import { ADMIN_PERMISSION, AUDIT_ACTION, maximumAdminPageSize } from "@repo/config";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { DateTime, Effect, Schema } from "effect";

import { countRows } from "./count-rows.ts";
import { query, type DrizzleDatabase } from "./database.ts";
import { InquiryForbidden } from "./inquiry-forbidden.ts";
import { InquiryNotFound } from "./inquiry-not-found.ts";
import { adminInquiryColumns, inquiryColumns, inquiryThread } from "./inquiry-thread.ts";
import { liveAdmin, requireAdmin } from "./privileged-session.ts";
import {
  auditEvent,
  INQUIRY_AUTHOR_KIND,
  INQUIRY_STATUS,
  inquiry,
  inquiryMessage,
  inquiryStatuses,
  type AuditAction,
  type InquiryStatus,
  user,
} from "./schema.ts";

export const InquiryPage = Schema.Struct({
  limit: Schema.Int.check(Schema.isBetween({ maximum: maximumAdminPageSize, minimum: 1 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.optionalKey(Schema.Literals(inquiryStatuses)),
});

type InquirySummary = Readonly<{
  createdAt: Date;
  id: string;
  status: InquiryStatus;
  subject: string;
  updatedAt: Date;
}>;

type InquiryMessage = Readonly<{
  authorId: string;
  authorKind: "admin" | "member";
  body: string;
  createdAt: Date;
  id: string;
}>;

type InquiryThread = InquirySummary & Readonly<{ messages: readonly InquiryMessage[] }>;

type AdminInquirySummary = InquirySummary &
  Readonly<{
    memberId: string;
    memberName: string;
  }>;

type AdminInquiryThread = AdminInquirySummary & Readonly<{ messages: readonly InquiryMessage[] }>;

type MemberSummary = Readonly<{
  email: string;
  id: string;
  name: string;
}>;

const auditInquiryReply = (
  database: DrizzleDatabase,
  {
    action,
    actorId,
    checkedAt,
    inquiryId,
    sessionId,
  }: Readonly<{
    action: AuditAction;
    actorId: string;
    checkedAt: Date;
    inquiryId: string;
    sessionId: string;
  }>,
): SQL => {
  const auditColumns = [
    [auditEvent.action, action],
    [auditEvent.actorId, actorId],
    [auditEvent.createdAt, checkedAt.getTime()],
    [auditEvent.id, crypto.randomUUID()],
    [auditEvent.targetId, inquiryId],
  ] as const;
  const columnNames = sql.join(
    auditColumns.map(([column]) => sql.identifier(column.name)),
    sql`, `,
  );
  const columnValues = sql.join(
    auditColumns.map(([, columnValue]) => sql`${columnValue}`),
    sql`, `,
  );
  const targeted = sql`SELECT 1 FROM ${inquiry} WHERE ${inquiry.id} = ${inquiryId} AND ${liveAdmin(database, { checkedAt, required: ADMIN_PERMISSION.operator, sessionId })}`;
  return sql`INSERT INTO ${auditEvent} (${columnNames}) SELECT ${columnValues} WHERE EXISTS (${targeted})`;
};

const adminInquiryRows = Effect.fn("adminInquiryRows")(function* adminInquiryRows(
  where: () => SQL | undefined,
  window: Readonly<{ limit: number; offset: number }>,
) {
  return yield* query((database) =>
    database
      .select(adminInquiryColumns)
      .from(inquiry)
      .innerJoin(user, eq(inquiry.memberId, user.id))
      .where(where())
      .orderBy(desc(inquiry.updatedAt), inquiry.id)
      .limit(window.limit)
      .offset(window.offset),
  );
});

const listMemberInquiries = Effect.fn("listMemberInquiries")(function* listMemberInquiries(
  memberId: string,
) {
  return yield* query((database) =>
    database
      .select(inquiryColumns)
      .from(inquiry)
      .where(eq(inquiry.memberId, memberId))
      .orderBy(desc(inquiry.updatedAt), inquiry.id),
  );
});

const getMemberInquiry = Effect.fn("getMemberInquiry")(function* getMemberInquiry(
  memberId: string,
  inquiryId: string,
) {
  const found = query((database) =>
    database
      .select(inquiryColumns)
      .from(inquiry)
      .where(and(eq(inquiry.id, inquiryId), eq(inquiry.memberId, memberId)))
      .limit(1),
  );
  return (yield* inquiryThread(inquiryId, found)) satisfies InquiryThread;
});

const createMemberInquiry = Effect.fn("createMemberInquiry")(function* createMemberInquiry(
  memberId: string,
  draft: { readonly body: string; readonly subject: string },
) {
  const inquiryId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const openedAt = DateTime.toDate(yield* DateTime.now);
  yield* query((database) =>
    database.batch([
      database.insert(inquiry).values({
        createdAt: openedAt,
        id: inquiryId,
        memberId,
        status: INQUIRY_STATUS.open,
        subject: draft.subject,
        updatedAt: openedAt,
      }),
      database.insert(inquiryMessage).values({
        authorId: memberId,
        authorKind: INQUIRY_AUTHOR_KIND.member,
        body: draft.body,
        createdAt: openedAt,
        id: messageId,
        inquiryId,
      }),
    ]),
  );
  return yield* getMemberInquiry(memberId, inquiryId);
});

const replyAsMember = Effect.fn("replyAsMember")(function* replyAsMember({
  body: replyBody,
  inquiryId,
  memberId,
}: Readonly<{ body: string; inquiryId: string; memberId: string }>) {
  const thread = yield* getMemberInquiry(memberId, inquiryId);
  if (thread.status === INQUIRY_STATUS.closed) {
    return yield* new InquiryForbidden();
  }
  const repliedAt = DateTime.toDate(yield* DateTime.now);
  yield* query((database) =>
    database.batch([
      database.insert(inquiryMessage).values({
        authorId: memberId,
        authorKind: INQUIRY_AUTHOR_KIND.member,
        body: replyBody,
        createdAt: repliedAt,
        id: crypto.randomUUID(),
        inquiryId,
      }),
      database
        .update(inquiry)
        .set({ updatedAt: repliedAt })
        .where(and(eq(inquiry.id, inquiryId), eq(inquiry.memberId, memberId))),
    ]),
  );
  return yield* getMemberInquiry(memberId, inquiryId);
});

const matchesInquiryPage = (page: typeof InquiryPage.Type): SQL | undefined => {
  const { status } = page;
  return status === undefined ? undefined : eq(inquiry.status, status);
};

const listAdminInquiries = Effect.fn("listAdminInquiries")(function* listAdminInquiries(
  sessionId: string,
  page: typeof InquiryPage.Type,
) {
  yield* requireAdmin(sessionId);
  const where = matchesInquiryPage(page);
  const inquiries = yield* adminInquiryRows(() => where, page);
  const matchingCount = yield* countRows(inquiry, () => where);
  return { inquiries, total: matchingCount };
});

const getAdminInquiry = Effect.fn("getAdminInquiry")(function* getAdminInquiry(
  sessionId: string,
  inquiryId: string,
) {
  yield* requireAdmin(sessionId);
  const found = adminInquiryRows(() => eq(inquiry.id, inquiryId), { limit: 1, offset: 0 });
  return (yield* inquiryThread(inquiryId, found)) satisfies AdminInquiryThread;
});

const countPendingInquiries = Effect.fn("countPendingInquiries")(function* countPendingInquiries(
  sessionId: string,
) {
  yield* requireAdmin(sessionId);
  return yield* countRows(inquiry, () => eq(inquiry.status, INQUIRY_STATUS.open));
});

const replyAsAdmin = Effect.fn("replyAsAdmin")(function* replyAsAdmin({
  body: replyBody,
  inquiryId,
  sessionId,
}: Readonly<{ body: string; inquiryId: string; sessionId: string }>) {
  const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const [existing] = yield* query((database) =>
    database
      .select({ id: inquiry.id, status: inquiry.status })
      .from(inquiry)
      .where(eq(inquiry.id, inquiryId))
      .limit(1),
  );
  if (!existing) {
    return yield* new InquiryNotFound();
  }
  if (existing.status === INQUIRY_STATUS.closed) {
    return yield* new InquiryForbidden();
  }
  const repliedAt = DateTime.toDate(yield* DateTime.now);
  const change = {
    action: AUDIT_ACTION.inquiryReplied,
    actorId: actor.user.id,
    checkedAt: repliedAt,
    inquiryId,
    sessionId,
  } as const;
  yield* query((database) =>
    database.batch([
      database.run(auditInquiryReply(database, change)),
      database.insert(inquiryMessage).values({
        authorId: actor.user.id,
        authorKind: INQUIRY_AUTHOR_KIND.admin,
        body: replyBody,
        createdAt: repliedAt,
        id: crypto.randomUUID(),
        inquiryId,
      }),
      database
        .update(inquiry)
        .set({ status: INQUIRY_STATUS.answered, updatedAt: repliedAt })
        .where(eq(inquiry.id, inquiryId)),
    ]),
  );
  return yield* getAdminInquiry(sessionId, inquiryId);
});

const closeInquiry = Effect.fn("closeInquiry")(function* closeInquiry(
  sessionId: string,
  inquiryId: string,
) {
  yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const closedAt = DateTime.toDate(yield* DateTime.now);
  const [closed] = yield* query((database) =>
    database
      .update(inquiry)
      .set({ status: INQUIRY_STATUS.closed, updatedAt: closedAt })
      .where(eq(inquiry.id, inquiryId))
      .returning({ id: inquiry.id }),
  );
  if (!closed) {
    return yield* new InquiryNotFound();
  }
  return yield* getAdminInquiry(sessionId, inquiryId);
});

const getInquiryMemberSummary = Effect.fn("getInquiryMemberSummary")(
  function* getInquiryMemberSummary(sessionId: string, memberId: string) {
    yield* requireAdmin(sessionId);
    const [member] = yield* query((database) =>
      database
        .select({ email: user.email, id: user.id, name: user.name })
        .from(user)
        .where(eq(user.id, memberId))
        .limit(1),
    );
    if (!member) {
      return yield* new InquiryNotFound();
    }
    return member satisfies MemberSummary;
  },
);

export {
  closeInquiry,
  countPendingInquiries,
  createMemberInquiry,
  getAdminInquiry,
  getInquiryMemberSummary,
  getMemberInquiry,
  listAdminInquiries,
  listMemberInquiries,
  replyAsAdmin,
  replyAsMember,
};
export { InquiryForbidden } from "./inquiry-forbidden.ts";
export { InquiryNotFound } from "./inquiry-not-found.ts";
export type {
  AdminInquirySummary,
  AdminInquiryThread,
  InquiryMessage,
  InquirySummary,
  InquiryThread,
  MemberSummary,
};
