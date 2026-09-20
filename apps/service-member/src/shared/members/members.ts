import { ACCOUNT_STATE, ROLE } from "@repo/config";
import { UserNotFound, containsKeyword, query, schema } from "@repo/db";
import { and, count, desc, eq, or } from "drizzle-orm";
import { Effect } from "effect";

const { user } = schema;

type Member = Readonly<{
  id: string;
  joined: string;
  name: string;
  profile: string;
  socialLinks: readonly string[];
}>;

const monthLength = "YYYY-MM".length;
const memberColumns = {
  createdAt: user.createdAt,
  id: user.id,
  name: user.name,
  profile: user.profile,
  socialLinks: user.socialLinks,
};

const profileColumns = {
  email: user.email,
  id: user.id,
  name: user.name,
  profile: user.profile,
  socialLinks: user.socialLinks,
};

function shown({
  createdAt,
  ...member
}: Readonly<{
  createdAt: Readonly<Date>;
  id: string;
  name: string;
  profile: string;
  socialLinks: readonly string[];
}>): Member {
  return { ...member, joined: createdAt.toISOString().slice(0, monthLength) };
}

const getMember = Effect.fn("getMember")(function* getMember(viewerId: string, memberId: string) {
  const visible = and(
    eq(user.role, ROLE.member),
    or(
      eq(user.id, viewerId),
      and(eq(user.emailVerified, true), eq(user.accountState, ACCOUNT_STATE.active)),
    ),
  );
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
  const listed = and(
    eq(user.emailVerified, true),
    eq(user.role, ROLE.member),
    eq(user.accountState, ACCOUNT_STATE.active),
    named,
  );
  const members = yield* query((database) =>
    database
      .select(memberColumns)
      .from(user)
      .where(listed)
      .orderBy(desc(user.createdAt), user.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  const [total] = yield* query((database) =>
    database.select({ count: count() }).from(user).where(listed),
  );
  return { members: members.map((member) => shown(member)), total: total?.count ?? 0 };
});

const getProfile = Effect.fn("getProfile")(function* getProfile(userId: string) {
  const [profile] = yield* query((database) =>
    database.select(profileColumns).from(user).where(eq(user.id, userId)).limit(1),
  );
  // oxlint-disable-next-line unicorn/no-null
  return profile ?? null;
});

const updateProfile = Effect.fn("updateProfile")(function* updateProfile(
  userId: string,
  values: {
    readonly name: string;
    readonly profile: string;
    readonly socialLinks: readonly string[];
  },
) {
  const [profile] = yield* query((database) =>
    database
      .update(user)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning(profileColumns),
  );
  if (!profile) {
    return yield* new UserNotFound();
  }
  return profile;
});

export { getMember, getProfile, listMembers, updateProfile };
