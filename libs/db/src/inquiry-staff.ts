import { inquiryStatuses } from "@repo/config";
import { asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { Effect } from "effect";

import { query } from "./database.ts";
import { InquiryNotFound } from "./inquiry-not-found.ts";
import { INQUIRY_AUTHOR_KIND, inquiry, inquiryAuthorKinds, inquiryMessage } from "./schema.ts";
import { user } from "./schema.ts";

interface StaffInquirySummary {
  readonly createdAt: Date;
  readonly id: string;
  readonly memberId: string;
  readonly status: "answered" | "closed" | "open";
  readonly subject: string;
  readonly updatedAt: Date;
}

interface StaffInquiryMessage {
  readonly authorId: string;
  readonly authorKind: "admin" | "member";
  readonly body: string;
  readonly createdAt: Date;
  readonly id: string;
}

interface StaffInquiryThread extends StaffInquirySummary {
  readonly messages: readonly StaffInquiryMessage[];
}

interface InquiryStatusCount {
  readonly answered: number;
  readonly closed: number;
  readonly open: number;
}

interface InquiryDailyTrend {
  readonly answered: number;
  readonly closed: number;
  readonly day: string;
  readonly open: number;
}

interface InquiryStaffCounts {
  readonly byStatus: InquiryStatusCount;
  readonly trend: readonly InquiryDailyTrend[];
}

const staffInquiryCounts = Effect.fn("staffInquiryCounts")(function* staffInquiryCounts() {
  const rows = yield* query((database) =>
    database
      .select({ count: count(), status: inquiry.status })
      .from(inquiry)
      .groupBy(inquiry.status),
  );
  const byStatus = { answered: 0, closed: 0, open: 0 };
  for (const row of rows) {
    byStatus[row.status] = row.count;
  }
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  since.setUTCHours(0, 0, 0, 0);
  const trendRows = yield* query((database) =>
    database
      .select({
        count: count(),
        day: sql<string>`strftime('%Y-%m-%d', ${inquiry.createdAt} / 1000, 'unixepoch')`,
        status: inquiry.status,
      })
      .from(inquiry)
      .where(gte(inquiry.createdAt, since))
      .groupBy(sql`strftime('%Y-%m-%d', ${inquiry.createdAt} / 1000, 'unixepoch')`, inquiry.status)
      .orderBy(sql`strftime('%Y-%m-%d', ${inquiry.createdAt} / 1000, 'unixepoch')`),
  );
  const trendMap = new Map<string, InquiryDailyTrend>();
  for (const row of trendRows) {
    const existing = trendMap.get(row.day) ?? { answered: 0, closed: 0, day: row.day, open: 0 };
    trendMap.set(row.day, { ...existing, [row.status]: row.count });
  }
  return { byStatus, trend: [...trendMap.values()] } satisfies InquiryStaffCounts;
});

const staffListMemberInquiries = Effect.fn("staffListMemberInquiries")(
  function* staffListMemberInquiries(memberId: string) {
    const [member] = yield* query((database) =>
      database.select({ id: user.id }).from(user).where(eq(user.id, memberId)).limit(1),
    );
    if (!member) {
      return yield* new InquiryNotFound();
    }
    return yield* query((database) =>
      database
        .select({
          createdAt: inquiry.createdAt,
          id: inquiry.id,
          memberId: inquiry.memberId,
          status: inquiry.status,
          subject: inquiry.subject,
          updatedAt: inquiry.updatedAt,
        })
        .from(inquiry)
        .where(eq(inquiry.memberId, memberId))
        .orderBy(desc(inquiry.updatedAt), inquiry.id),
    );
  },
);

const staffGetInquiry = Effect.fn("staffGetInquiry")(function* staffGetInquiry(inquiryId: string) {
  const [row] = yield* query((database) =>
    database
      .select({
        createdAt: inquiry.createdAt,
        id: inquiry.id,
        memberId: inquiry.memberId,
        status: inquiry.status,
        subject: inquiry.subject,
        updatedAt: inquiry.updatedAt,
      })
      .from(inquiry)
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
  return { ...row, messages } satisfies StaffInquiryThread;
});

interface ReadOnlyInquiryStaff {
  readonly getInquiry: typeof staffGetInquiry;
  readonly inquiryCounts: typeof staffInquiryCounts;
  readonly listMemberInquiries: typeof staffListMemberInquiries;
}

const inquiryStaff: ReadOnlyInquiryStaff = {
  getInquiry: staffGetInquiry,
  inquiryCounts: staffInquiryCounts,
  listMemberInquiries: staffListMemberInquiries,
};

export {
  INQUIRY_AUTHOR_KIND,
  inquiryAuthorKinds,
  inquiryStaff,
  inquiryStatuses,
  staffGetInquiry,
  staffInquiryCounts,
  staffListMemberInquiries,
};
export type {
  InquiryDailyTrend,
  InquiryStaffCounts,
  InquiryStatusCount,
  ReadOnlyInquiryStaff,
  StaffInquiryMessage,
  StaffInquirySummary,
  StaffInquiryThread,
};
