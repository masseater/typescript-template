import {
  SessionIdentity,
  type MemberDirectoryList,
  type MemberDirectoryView,
} from "@repo/core-api";
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
import { Effect, Option, Schema } from "effect";

import type { Database, DatabaseFailure } from "@repo/db";

const { follow, user } = schema;

const monthLength = "YYYY-MM".length;
const photoSeparator = "/";

const blockKinds = [
  "actions",
  "biography",
  "identity",
  "joined",
  "sheet-area",
  "sheet-interests",
  "sheet-message",
  "sheet-nickname",
  "sheet-occupation",
  "social-links",
] as const;

const ProfileLayout = Schema.Struct({
  blocks: Schema.Array(Schema.Struct({ kind: Schema.Literals(blockKinds) })).check(
    Schema.isNonEmpty(),
  ),
});

const Sheet = Schema.Struct({
  area: Schema.optionalKey(Schema.String),
  interests: Schema.optionalKey(Schema.Array(Schema.String)),
  message: Schema.optionalKey(Schema.String),
  nickname: Schema.optionalKey(Schema.String),
  occupation: Schema.optionalKey(Schema.String),
});

const StoredSheet = Schema.Struct({
  layout: ProfileLayout,
  sheet: Sheet,
});

const decodeStored = Schema.decodeUnknownOption(StoredSheet);
const decodeLegacy = Schema.decodeUnknownOption(Sheet);


const interviewProfileLayout = {
  blocks: [
    { kind: "identity" },
    { kind: "biography" },
    { kind: "sheet-nickname" },
    { kind: "sheet-occupation" },
    { kind: "sheet-interests" },
    { kind: "sheet-area" },
    { kind: "sheet-message" },
    { kind: "social-links" },
    { kind: "joined" },
    { kind: "actions" },
  ],
} as const satisfies typeof ProfileLayout.Type;

const baselineProfileLayout = {
  blocks: [
    { kind: "identity" },
    { kind: "biography" },
    { kind: "social-links" },
    { kind: "joined" },
    { kind: "actions" },
  ],
} as const satisfies typeof ProfileLayout.Type;

const emptyPresentation = {
  profileLayout: baselineProfileLayout,
  sheet: {},
} as const;


const photoColumns = { companyPhotoKey: user.companyPhotoKey, facePhotoKey: user.facePhotoKey };
const memberColumns = {
  ...photoColumns,
  createdAt: user.createdAt,
  id: user.id,
  name: user.name,
  profile: user.profile,
  socialLinks: user.socialLinks,
};

const dieDatabase = {
  DatabaseFailure: (failure: DatabaseFailure) => Effect.die(failure),
} as const;

const readSavedSheet = (
  saved: unknown,
): Readonly<{ layout?: typeof ProfileLayout.Type; sheet: typeof Sheet.Type }> => {
  const stored = Option.getOrUndefined(decodeStored(saved));
  if (stored !== undefined) {
    return stored;
  }
  const legacy = Option.getOrUndefined(decodeLegacy(saved));
  if (legacy !== undefined) {
    return { sheet: legacy };
  }
  return { sheet: {} };
};

const profilePresentation = (
  memberId: string,
): Effect.Effect<
  Readonly<{ profileLayout: typeof ProfileLayout.Type; sheet: typeof Sheet.Type }>,
  DatabaseFailure,
  Database
> =>
  Effect.gen(function* profilePresentationProgram() {
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

const photoVersion = (key: string | null): string | null =>
  key === null ? key : key.slice(key.lastIndexOf(photoSeparator) + 1);

const shown = (
  member: {
    readonly companyPhotoKey: string | null;
    readonly createdAt: Readonly<Date>;
    readonly facePhotoKey: string | null;
    readonly id: string;
    readonly name: string;
    readonly profile: string;
    readonly socialLinks: readonly string[];
  },
  presentation: Readonly<{
    profileLayout: typeof ProfileLayout.Type;
    sheet: typeof Sheet.Type;
  }>,
): typeof MemberDirectoryView.Type => {
  const { companyPhotoKey, createdAt, facePhotoKey, ...rest } = member;
  return {
    ...rest,
    ...presentation,
    joined: createdAt.toISOString().slice(0, monthLength),
    photos: {
      company: photoVersion(companyPhotoKey),
      face: photoVersion(facePhotoKey),
    },
  };
};

const getMember = (
  memberId: string,
): Effect.Effect<typeof MemberDirectoryView.Type, UserNotFound, SessionIdentity | Database> =>
  Effect.gen(function* getMemberProgram() {
    const identity = yield* SessionIdentity;
    const viewerId = identity.user.id;
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
    if (member === undefined) {
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
  }).pipe(Effect.catchTags(dieDatabase));

const listMembers = (page: {
  readonly keyword?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}): Effect.Effect<typeof MemberDirectoryList.Type, never, SessionIdentity | Database> =>
  Effect.gen(function* listMembersProgram() {
    const identity = yield* SessionIdentity;
    const viewerId = identity.user.id;
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
  }).pipe(Effect.catchTags(dieDatabase));

export { getMember, listMembers, photoVersion };
