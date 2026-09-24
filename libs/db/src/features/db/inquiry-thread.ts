import { asc, eq } from "drizzle-orm";
import { Effect } from "effect";

import { query, type Database } from "./database.ts";
import { InquiryNotFound } from "./inquiry-not-found.ts";
import { inquiry, inquiryMessage, user } from "./schema.ts";

import type { DatabaseFailure } from "./database-failure.ts";

const inquiryColumns = {
  createdAt: inquiry.createdAt,
  id: inquiry.id,
  status: inquiry.status,
  subject: inquiry.subject,
  updatedAt: inquiry.updatedAt,
};

const { createdAt, id, ...inquiryDetails } = inquiryColumns;
const memberInquiryColumns = { createdAt, id, memberId: inquiry.memberId, ...inquiryDetails };
const adminInquiryColumns = {
  createdAt,
  id,
  memberId: inquiry.memberId,
  memberName: user.name,
  ...inquiryDetails,
};

const inquiryMessages = Effect.fn("inquiryMessages")(function* inquiryMessages(inquiryId: string) {
  return yield* query((database) =>
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
});

type InquiryMessageRow = Effect.Success<ReturnType<typeof inquiryMessages>>[number];

const inquiryThread = <Row extends object>(
  inquiryId: string,
  found: Effect.Effect<readonly Row[], DatabaseFailure, Database>,
): Effect.Effect<
  Row & { readonly messages: InquiryMessageRow[] },
  DatabaseFailure | InquiryNotFound,
  Database
> =>
  Effect.gen(function* inquiryThreadProgram() {
    const [foundInquiry] = yield* found;
    if (!foundInquiry) {
      return yield* new InquiryNotFound();
    }
    const threadMessages = yield* inquiryMessages(inquiryId);
    return { ...foundInquiry, messages: threadMessages };
  });

export { adminInquiryColumns, inquiryColumns, inquiryThread, memberInquiryColumns };
export type { InquiryMessageRow };
