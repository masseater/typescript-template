import { UserNotFound, containsKeyword, findInterview, query, schema } from "@repo/db";
import { and, count, desc, eq, or } from "drizzle-orm";
import { Effect } from "effect";

import {
  baselineProfileLayout,
  interviewProfileLayout,
  readSavedSheet,
} from "#shared/profile-layout/index.ts";

import type { SheetData } from "#shared/interview/sheet.ts";
import type { ProfileLayoutData } from "#shared/profile-layout/schema.ts";
import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;

type Member = Readonly<{
  id: string;
  joined: string;
  name: string;
  profile: string;
  profileLayout: ProfileLayoutData;
  sheet: SheetData;
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

function profilePresentation(
  memberId: string,
): Effect.Effect<
  Readonly<{ profileLayout: ProfileLayoutData; sheet: SheetData }>,
  DatabaseFailure,
  Database
> {
  return Effect.gen(function* program() {
    const interview = yield* findInterview(memberId);
    if (interview?.savedSheet === null || interview?.savedSheet === undefined) {
      return { profileLayout: baselineProfileLayout, sheet: {} };
    }
    const saved = readSavedSheet(interview.savedSheet);
    return {
      profileLayout: saved.layout ?? interviewProfileLayout,
      sheet: saved.sheet,
    };
  });
}

function shown(
  member: Readonly<{
    createdAt: Readonly<Date>;
    id: string;
    name: string;
    profile: string;
    socialLinks: readonly string[];
  }>,
  presentation: Readonly<{ profileLayout: ProfileLayoutData; sheet: SheetData }>,
): Member {
  const { createdAt, ...rest } = member;
  return {
    ...rest,
    ...presentation,
    joined: createdAt.toISOString().slice(0, monthLength),
  };
}

const getMember = Effect.fn("getMember")(function* getMember(viewerId: string, memberId: string) {
  const visible = or(eq(user.emailVerified, true), eq(user.id, viewerId));
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
  const presentation = yield* profilePresentation(memberId);
  return shown(member, presentation);
});

const listMembers = Effect.fn("listMembers")(function* listMembers(page: {
  readonly keyword?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}) {
  const named = page.keyword === undefined ? undefined : containsKeyword(user.name, page.keyword);
  const listed = and(eq(user.emailVerified, true), named);
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
  const presented = yield* Effect.forEach(members, (member) =>
    Effect.map(profilePresentation(member.id), (presentation) => shown(member, presentation)),
  );
  return { members: presented, total: total?.count ?? 0 };
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
