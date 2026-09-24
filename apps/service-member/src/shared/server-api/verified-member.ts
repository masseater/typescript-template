import { ROLE } from "@repo/config";
import { and, eq, query, schema } from "@repo/db";
import { DateTime, Effect } from "effect";

import { MessagingMemberRequired } from "./messaging-member-required.ts";

const { user } = schema;

interface MemberReference {
  readonly id: string;
  readonly name: string;
}

interface OffsetPage {
  readonly limit: number;
  readonly offset: number;
}

const verifiedMember = and(eq(user.role, ROLE.member), eq(user.emailVerified, true));
const clockDate = Effect.map(DateTime.now, DateTime.toDate);

const requireMessagingMember = Effect.fn("requireMessagingMember")(function* requireMessagingMember(
  userId: string,
) {
  const [member] = yield* query((database) =>
    database
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, userId), verifiedMember))
      .limit(1),
  );
  if (member === undefined) {
    return yield* new MessagingMemberRequired();
  }
  return member;
});

export { clockDate, requireMessagingMember, verifiedMember };
export type { MemberReference, OffsetPage };
