import { and, count, desc, eq, or } from "drizzle-orm";
import { Effect } from "effect";
import { UserNotFound } from "./user-not-found.ts";
import { containsKeyword } from "./contains-keyword.ts";
import { query } from "./database.ts";
import { user } from "./schema.ts";

type Member = Readonly<{ id: string; joined: string; name: string; profile: string }>;

const monthLength = "YYYY-MM".length;
const memberColumns = {
  createdAt: user.createdAt,
  id: user.id,
  name: user.name,
  profile: user.profile,
};

function shown({
  createdAt,
  ...member
}: Readonly<{ createdAt: Readonly<Date>; id: string; name: string; profile: string }>): Member {
  return { ...member, joined: createdAt.toISOString().slice(0, monthLength) };
}

const getMember = Effect.fn("getMember")(function* getMember(viewerId: string, memberId: string) {
  const visible = or(eq(user.emailVerified, true), eq(user.id, viewerId));
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [member] = yield* query((database) =>
    database
      .select(memberColumns)
      .from(user)
      .where(and(eq(user.id, memberId), visible))
      .limit(1),
  );
  if (!member) {
    return yield* new UserNotFound();
  }
  return shown(member);
});

const listMembers = Effect.fn("listMembers")(function* listMembers(page: {
  readonly keyword?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}) {
  const named = page.keyword === undefined ? undefined : containsKeyword(user.name, page.keyword);
  const listed = and(eq(user.emailVerified, true), named);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const members = yield* query((database) =>
    database
      .select(memberColumns)
      .from(user)
      .where(listed)
      .orderBy(desc(user.createdAt), user.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [total] = yield* query((database) =>
    database.select({ count: count() }).from(user).where(listed),
  );
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return { members: members.map((member) => shown(member)), total: total?.count ?? 0 };
});

export { getMember, listMembers };
