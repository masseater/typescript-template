import {
  UserNotFound,
  containsKeyword,
  profileListed,
  profileVisibleTo,
  query,
  requirePaid,
  schema,
} from "@repo/db";
import { and, count, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import { photoVersion } from "#shared/photo/index.ts";

const { follow, user } = schema;

type PhotoVersions = Readonly<{ company: string | null; face: string | null }>;

type Member = Readonly<{
  id: string;
  joined: string;
  name: string;
  photos: PhotoVersions;
  profile: string;
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

function shown({
  companyPhotoKey,
  createdAt,
  facePhotoKey,
  ...member
}: PhotoKeyColumns &
  Readonly<{
    createdAt: Readonly<Date>;
    id: string;
    name: string;
    profile: string;
    socialLinks: readonly string[];
  }>): Member {
  return {
    ...member,
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
  return { ...shown(member), following };
});

const listMembers = Effect.fn("listMembers")(function* listMembers(page: {
  readonly keyword?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}) {
  const named = page.keyword === undefined ? undefined : containsKeyword(user.name, page.keyword);
  const listed = and(profileListed, named);
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

const searchMembers = Effect.fn("searchMembers")(function* searchMembers(
  viewerId: string,
  page: { readonly keyword?: string | undefined; readonly limit: number; readonly offset: number },
) {
  yield* requirePaid(viewerId);
  return yield* listMembers(page);
});

const getProfile = Effect.fn("getProfile")(function* getProfile(userId: string) {
  const [profile] = yield* query((database) =>
    database.select(profileColumns).from(user).where(eq(user.id, userId)).limit(1),
  );
  // oxlint-disable-next-line unicorn/no-null
  return profile === undefined ? null : ownProfile(profile);
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
  return ownProfile(profile);
});

export { getMember, getProfile, searchMembers, updateProfile };
