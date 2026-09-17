import { and, eq, or } from "drizzle-orm";
import { Effect } from "effect";
import { UserNotFound } from "./user-not-found.ts";
import { query } from "./database.ts";
import { user } from "./schema.ts";

const monthLength = "YYYY-MM".length;

const getMember = Effect.fn("getMember")(function* getMember(viewerId: string, memberId: string) {
  const visible = or(eq(user.emailVerified, true), eq(user.id, viewerId));
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [member] = yield* query((database) =>
    database
      .select({ createdAt: user.createdAt, id: user.id, name: user.name, profile: user.profile })
      .from(user)
      .where(and(eq(user.id, memberId), visible))
      .limit(1),
  );
  if (!member) {
    return yield* new UserNotFound();
  }
  const { createdAt, ...shown } = member;
  return { ...shown, joined: createdAt.toISOString().slice(0, monthLength) };
});

export { getMember };
