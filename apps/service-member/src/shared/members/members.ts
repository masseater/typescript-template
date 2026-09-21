import {
  UserNotFound,
  and,
  blockHides,
  containsKeyword,
  count,
  desc,
  eq,
  findInterview,
  not,
  profileListed,
  profileVisibleTo,
  query,
  schema,
  viewerBlockedTarget,
} from "@repo/db";
import { DateTime, Effect } from "effect";

import { photoVersion } from "#shared/photo/index.ts";
import { baselineProfileLayout, interviewProfileLayout } from "#shared/profile-layout/index.ts";
import { readSavedSheet } from "#shared/profile-layout/saved-sheet.ts";

import type { SheetData } from "#shared/interview/sheet.ts";
import type { ProfileLayoutData } from "#shared/profile-layout/schema.ts";
import type { Database, DatabaseFailure } from "@repo/db";

const { follow, user } = schema;

type PhotoVersions = Readonly<{ company: string | null; face: string | null }>;

type Member = Readonly<{
  id: string;
  joined: string;
  name: string;
  photos: PhotoVersions;
  profile: string;
  profileLayout: ProfileLayoutData;
  sheet: SheetData;
  socialLinks: readonly string[];
}>;

type Profile = Readonly<{
  email: string;
  id: string;
  name: string;
  photos: PhotoVersions;
  profile: string;
  socialLinks: readonly string[];
}>;

type PhotoKeyColumns = Readonly<{ companyPhotoKey: string | null; facePhotoKey: string | null }>;

const monthLength = "YYYY-MM".length;
const photoColumns = { companyPhotoKey: user.companyPhotoKey, facePhotoKey: user.facePhotoKey };
const memberColumns = {
  ...photoColumns,
  createdAt: user.createdAt,
  id: user.id,
  name: user.name,
  profile: user.profile,
  socialLinks: user.socialLinks,
};

const profileColumns = {
  ...photoColumns,
  email: user.email,
  id: user.id,
  name: user.name,
  profile: user.profile,
  socialLinks: user.socialLinks,
};

function photosOf({ companyPhotoKey, facePhotoKey }: PhotoKeyColumns): PhotoVersions {
  return { company: photoVersion(companyPhotoKey), face: photoVersion(facePhotoKey) };
}

const emptyPresentation = {
  profileLayout: baselineProfileLayout,
  sheet: {},
} as const;

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
      return emptyPresentation;
    }
    const saved = readSavedSheet(interview.savedSheet);
    return {
      profileLayout: saved.layout ?? interviewProfileLayout,
      sheet: saved.sheet,
    };
  });
}

function shown(
  member: PhotoKeyColumns &
    Readonly<{
      createdAt: Readonly<Date>;
      id: string;
      name: string;
      profile: string;
      socialLinks: readonly string[];
    }>,
  presentation: Readonly<{ profileLayout: ProfileLayoutData; sheet: SheetData }>,
): Member {
  const { companyPhotoKey, createdAt, facePhotoKey, ...rest } = member;
  return {
    ...rest,
    ...presentation,
    joined: createdAt.toISOString().slice(0, monthLength),
    photos: photosOf({ companyPhotoKey, facePhotoKey }),
  };
}

function ownProfile({
  companyPhotoKey,
  facePhotoKey,
  ...profile
}: PhotoKeyColumns &
  Readonly<{
    email: string;
    id: string;
    name: string;
    profile: string;
    socialLinks: readonly string[];
  }>): Profile {
  return { ...profile, photos: photosOf({ companyPhotoKey, facePhotoKey }) };
}

const getMember = Effect.fn("getMember")(function* getMember(viewerId: string, memberId: string) {
  const [hidden] = yield* query((database) =>
    database
      .select(memberColumns)
      .from(user)
      .where(and(eq(user.id, memberId), viewerBlockedTarget(viewerId)))
      .limit(1),
  );
  if (hidden !== undefined) {
    return {
      ...shown(hidden, emptyPresentation),
      blocked: true,
      following: false,
      photos: { company: null, face: null },
      profile: "",
      socialLinks: [],
    };
  }
  const [member] = yield* query((database) =>
    database
      .select(memberColumns)
      .from(user)
      .where(and(eq(user.id, memberId), profileVisibleTo(viewerId)))
      .limit(1),
  );
  if (!member) {
    return yield* new UserNotFound();
  }
  let following: boolean | undefined;
  if (viewerId !== memberId) {
    const [row] = yield* query((database) =>
      database
        .select({ followeeId: follow.followeeId })
        .from(follow)
        .where(and(eq(follow.followerId, viewerId), eq(follow.followeeId, memberId)))
        .limit(1),
    );
    following = row !== undefined;
  }
  const base = shown(member, yield* profilePresentation(memberId));
  if (following === undefined) {
    return base;
  }
  return { ...base, following };
});

const listMembers = Effect.fn("listMembers")(function* listMembers(
  viewerId: string,
  page: {
    readonly keyword?: string | undefined;
    readonly limit: number;
    readonly offset: number;
  },
) {
  const named = page.keyword === undefined ? undefined : containsKeyword(user.name, page.keyword);
  const listed = and(profileListed, not(blockHides(viewerId)), named);
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
  return profile === undefined ? undefined : ownProfile(profile);
});

const updateProfile = Effect.fn("updateProfile")(function* updateProfile(
  userId: string,
  values: {
    readonly name: string;
    readonly profile: string;
    readonly socialLinks: readonly string[];
  },
) {
  const now = DateTime.toDate(yield* DateTime.now);
  const [profile] = yield* query((database) =>
    database
      .update(user)
      .set({ ...values, updatedAt: now })
      .where(eq(user.id, userId))
      .returning(profileColumns),
  );
  if (!profile) {
    return yield* new UserNotFound();
  }
  return ownProfile(profile);
});

export { getMember, getProfile, listMembers, updateProfile };
