import { type InquiryStatus } from "@repo/config";
import { asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { query } from "./database.ts";
import { InquiryNotFound } from "./inquiry-not-found.ts";
import {
  INQUIRY_AUTHOR_KIND,
  inquiry,
  inquiryAuthorKinds,
  inquiryMessage,
  inquiryStatuses,
  user,
} from "./schema.ts";

import type { InquiryMessage } from "./inquiry.ts";

type StaffInquirySummary = Readonly<{
  createdAt: Date;
  id: string;
  memberId: string;
  status: InquiryStatus;
  subject: string;
  updatedAt: Date;
}>;

type StaffInquiryThread = StaffInquirySummary & Readonly<{ messages: readonly InquiryMessage[] }>;

type InquiryStatusCount = Readonly<{
  answered: number;
  closed: number;
  open: number;
}>;

type InquiryDailyTrend = Readonly<{
  answered: number;
  closed: number;
  day: string;
  open: number;
}>;

type InquiryStaffCounts = Readonly<{
  byStatus: InquiryStatusCount;
  trend: readonly InquiryDailyTrend[];
}>;

const statusTally = (
  statusCounts: readonly Readonly<{ count: number; status: InquiryStatus }>[],
): InquiryStatusCount =>
  statusCounts.reduce<InquiryStatusCount>(
    (tally, statusCount) => ({ ...tally, [statusCount.status]: statusCount.count }),
    { answered: 0, closed: 0, open: 0 },
  );

const dailyTrend = (
  dailyCounts: readonly Readonly<{ count: number; day: string; status: InquiryStatus }>[],
): readonly InquiryDailyTrend[] =>
  [...Map.groupBy(dailyCounts, (dailyCount) => dailyCount.day)].map(([day, dayCounts]) =>
    dayCounts.reduce<InquiryDailyTrend>(
      (daily, dayCount) => ({ ...daily, [dayCount.status]: dayCount.count }),
      { answered: 0, closed: 0, day, open: 0 },
    ),
  );

const staffInquiryCounts = Effect.fn("staffInquiryCounts")(function* staffInquiryCounts() {
  const statusCounts = yield* query((database) =>
    database
      .select({ count: count(), status: inquiry.status })
      .from(inquiry)
      .groupBy(inquiry.status),
  );
  const since = DateTime.toDate(
    DateTime.startOf(DateTime.subtract(yield* DateTime.now, { days: 30 }), "day"),
  );
  const dailyCounts = yield* query((database) =>
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
  return {
    byStatus: statusTally(statusCounts),
    trend: dailyTrend(dailyCounts),
  } satisfies InquiryStaffCounts;
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
  const [staffInquiry] = yield* query((database) =>
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
  if (!staffInquiry) {
    return yield* new InquiryNotFound();
  }
  const threadMessages = yield* query((database) =>
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
  return { ...staffInquiry, messages: threadMessages } satisfies StaffInquiryThread;
});

type ReadOnlyInquiryStaff = Readonly<{
  getInquiry: typeof staffGetInquiry;
  inquiryCounts: typeof staffInquiryCounts;
  listMemberInquiries: typeof staffListMemberInquiries;
}>;

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
  StaffInquirySummary,
  StaffInquiryThread,
};
