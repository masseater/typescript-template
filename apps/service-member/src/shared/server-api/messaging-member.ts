import { ROLE } from "@repo/config";
import { and, eq, query, schema } from "@repo/db";
import { Effect } from "effect";

import { MessagingMemberRequired } from "./messaging-member-required.ts";

const { user } = schema;

const messagingMember = and(eq(user.role, ROLE.member), eq(user.emailVerified, true));

const requireMessagingMember = Effect.fn("requireMessagingMember")(function* requireMessagingMember(
  userId: string,
) {
  const [member] = yield* query((database) =>
    database
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, userId), messagingMember))
      .limit(1),
  );
  if (member === undefined) {
    return yield* new MessagingMemberRequired();
  }
  return member;
});

export { messagingMember, requireMessagingMember };
