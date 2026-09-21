import { ADMIN_PERMISSION, AUDIT_ACTION } from "@repo/config";
import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { query, type DrizzleDatabase } from "./database.ts";
import { InquiryForbidden } from "./inquiry-forbidden.ts";
import { InquiryNotFound } from "./inquiry-not-found.ts";
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
} from "./schema.ts";
import { user } from "./schema.ts";

const MAX_PAGE_SIZE = 100;

export const InquiryPage = Schema.Struct({
  limit: Schema.Int.check(Schema.isBetween({ maximum: MAX_PAGE_SIZE, minimum: 1 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.optionalKey(Schema.Literals(inquiryStatuses)),
});

interface InquirySummary {
  readonly createdAt: Date;
  readonly id: string;
  readonly status: InquiryStatus;
  readonly subject: string;
  readonly updatedAt: Date;
}

interface InquiryMessage {
  readonly authorId: string;
  readonly authorKind: "admin" | "member";
  readonly body: string;
  readonly createdAt: Date;
  readonly id: string;
}

interface InquiryThread extends InquirySummary {
  readonly messages: readonly InquiryMessage[];
}

interface AdminInquirySummary extends InquirySummary {
  readonly memberId: string;
  readonly memberName: string;
}

interface AdminInquiryThread extends AdminInquirySummary {
  readonly messages: readonly InquiryMessage[];
}

interface MemberSummary {
  readonly email: string;
  readonly id: string;
  readonly name: string;
}

const requireInquiryResponder = (sessionId: string): ReturnType<typeof requireAdmin> =>
  requireAdmin(sessionId, ADMIN_PERMISSION.operator);

const auditInquiryReply = (
  database: DrizzleDatabase,
  {
    action,
    actorId,
    inquiryId,
    sessionId,
  }: Readonly<{
    action: AuditAction;
    actorId: string;
    inquiryId: string;
    sessionId: string;
  }>,
): SQL => {
  const auditColumns = [
    [auditEvent.action, action],
    [auditEvent.actorId, actorId],
    [auditEvent.createdAt, Date.now()],
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
  const targeted = sql`SELECT 1 FROM ${inquiry} WHERE ${inquiry.id} = ${inquiryId} AND ${liveAdmin(database, sessionId, ADMIN_PERMISSION.operator)}`;
  return sql`INSERT INTO ${auditEvent} (${columnNames}) SELECT ${columnValues} WHERE EXISTS (${targeted})`;
};

const listMemberInquiries = Effect.fn("listMemberInquiries")(function* listMemberInquiries(
  memberId: string,
) {
  return yield* query((database) =>
    database
      .select({
        createdAt: inquiry.createdAt,
        id: inquiry.id,
        status: inquiry.status,
        subject: inquiry.subject,
        updatedAt: inquiry.updatedAt,
      })
      .from(inquiry)
      .where(eq(inquiry.memberId, memberId))
      .orderBy(desc(inquiry.updatedAt), inquiry.id),
  );
});

const getMemberInquiry = Effect.fn("getMemberInquiry")(function* getMemberInquiry(
  memberId: string,
  inquiryId: string,
) {
  const [row] = yield* query((database) =>
    database
      .select({
        createdAt: inquiry.createdAt,
        id: inquiry.id,
        status: inquiry.status,
        subject: inquiry.subject,
        updatedAt: inquiry.updatedAt,
      })
      .from(inquiry)
      .where(and(eq(inquiry.id, inquiryId), eq(inquiry.memberId, memberId)))
      .limit(1),
  );
  if (!row) {
    return yield* new InquiryNotFound();
  }
  const messages = yield* query((database) =>
    database
      .select({
        authorId: inquiryMessage.authorId,
        authorKind: inquiryMessage.authorKind,
        body: inquiryMessage.body,
        createdAt: inquiryMessage.createdAt,
        id: inquiryMessage.id,
      })
      .from(inquiryMessage)
      .where(eq(inquiryMessage.inquiryId, inquiryId))
      .orderBy(asc(inquiryMessage.createdAt), inquiryMessage.id),
  );
  return { ...row, messages } satisfies InquiryThread;
});

const createMemberInquiry = Effect.fn("createMemberInquiry")(function* createMemberInquiry(
  memberId: string,
  values: { readonly body: string; readonly subject: string },
) {
  const inquiryId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const now = new Date();
  yield* query(async (database) => {
    await database.batch([
      database.insert(inquiry).values({
        createdAt: now,
        id: inquiryId,
        memberId,
        status: INQUIRY_STATUS.open,
        subject: values.subject,
        updatedAt: now,
      }),
      database.insert(inquiryMessage).values({
        authorId: memberId,
        authorKind: INQUIRY_AUTHOR_KIND.member,
        body: values.body,
        createdAt: now,
        id: messageId,
        inquiryId,
      }),
    ]);
  });
  return yield* getMemberInquiry(memberId, inquiryId);
});

const replyAsMember = Effect.fn("replyAsMember")(function* replyAsMember(
  memberId: string,
  inquiryId: string,
  body: string,
) {
  const thread = yield* getMemberInquiry(memberId, inquiryId);
  if (thread.status === INQUIRY_STATUS.closed) {
    return yield* new InquiryForbidden();
  }
  const now = new Date();
  yield* query(async (database) => {
    await database.batch([
      database.insert(inquiryMessage).values({
        authorId: memberId,
        authorKind: INQUIRY_AUTHOR_KIND.member,
        body,
        createdAt: now,
        id: crypto.randomUUID(),
        inquiryId,
      }),
      database
        .update(inquiry)
        .set({ updatedAt: now })
        .where(and(eq(inquiry.id, inquiryId), eq(inquiry.memberId, memberId))),
    ]);
  });
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
  const inquiries = yield* query((database) =>
    database
      .select({
        createdAt: inquiry.createdAt,
        id: inquiry.id,
        memberId: inquiry.memberId,
        memberName: user.name,
        status: inquiry.status,
        subject: inquiry.subject,
        updatedAt: inquiry.updatedAt,
      })
      .from(inquiry)
      .innerJoin(user, eq(inquiry.memberId, user.id))
      .where(where)
      .orderBy(desc(inquiry.updatedAt), inquiry.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  const [matching] = yield* query((database) =>
    database.select({ count: count() }).from(inquiry).where(where),
  );
  return { inquiries, total: matching?.count ?? 0 };
});

const getAdminInquiry = Effect.fn("getAdminInquiry")(function* getAdminInquiry(
  sessionId: string,
  inquiryId: string,
) {
  yield* requireAdmin(sessionId);
  const [row] = yield* query((database) =>
    database
      .select({
        createdAt: inquiry.createdAt,
        id: inquiry.id,
        memberId: inquiry.memberId,
        memberName: user.name,
        status: inquiry.status,
        subject: inquiry.subject,
        updatedAt: inquiry.updatedAt,
      })
      .from(inquiry)
      .innerJoin(user, eq(inquiry.memberId, user.id))
      .where(eq(inquiry.id, inquiryId))
      .limit(1),
  );
  if (!row) {
    return yield* new InquiryNotFound();
  }
  const messages = yield* query((database) =>
    database
      .select({
        authorId: inquiryMessage.authorId,
        authorKind: inquiryMessage.authorKind,
        body: inquiryMessage.body,
        createdAt: inquiryMessage.createdAt,
        id: inquiryMessage.id,
      })
      .from(inquiryMessage)
      .where(eq(inquiryMessage.inquiryId, inquiryId))
      .orderBy(asc(inquiryMessage.createdAt), inquiryMessage.id),
  );
  return { ...row, messages } satisfies AdminInquiryThread;
});

const countPendingInquiries = Effect.fn("countPendingInquiries")(function* countPendingInquiries(
  sessionId: string,
) {
  yield* requireAdmin(sessionId);
  const [matching] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(inquiry)
      .where(eq(inquiry.status, INQUIRY_STATUS.open)),
  );
  return matching?.count ?? 0;
});

const replyAsAdmin = Effect.fn("replyAsAdmin")(function* replyAsAdmin(
  sessionId: string,
  inquiryId: string,
  body: string,
) {
  const actor = yield* requireInquiryResponder(sessionId);
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
  const now = new Date();
  const change = {
    action: AUDIT_ACTION.inquiryReplied,
    actorId: actor.user.id,
    inquiryId,
    sessionId,
  } as const;
  yield* query(async (database) => {
    await database.batch([
      database.run(auditInquiryReply(database, change)),
      database.insert(inquiryMessage).values({
        authorId: actor.user.id,
        authorKind: INQUIRY_AUTHOR_KIND.admin,
        body,
        createdAt: now,
        id: crypto.randomUUID(),
        inquiryId,
      }),
      database
        .update(inquiry)
        .set({ status: INQUIRY_STATUS.answered, updatedAt: now })
        .where(eq(inquiry.id, inquiryId)),
    ]);
  });
  return yield* getAdminInquiry(sessionId, inquiryId);
});

const closeInquiry = Effect.fn("closeInquiry")(function* closeInquiry(
  sessionId: string,
  inquiryId: string,
) {
  yield* requireInquiryResponder(sessionId);
  const now = new Date();
  const [closed] = yield* query((database) =>
    database
      .update(inquiry)
      .set({ status: INQUIRY_STATUS.closed, updatedAt: now })
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
  requireInquiryResponder,
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
